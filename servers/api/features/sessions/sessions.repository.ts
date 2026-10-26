import mongoose, { isObjectIdString, objectIdFromString, objectIdToString, type MongoObjectId } from "../../integrations/mongodb/index.js";
import type { ActiveBoardSession, BoardHistoryAction, BoardSession, RealtimeSessionRepository } from "./sessions.contracts.js";
import { WbBoardSessionModel } from "./sessions.model.js";
import { WbBoardOperationModel } from "./sessions.operation.model.js";
import { WbBoardSnapshotModel } from "./sessions.snapshot.model.js";
import { WbBoardHistoryModel } from "./sessions.history.model.js";
import { applyBoardChanges, diffBoardChanges } from "./sessions.collaboration.js";
import { BoardEditRejected } from "./sessions.contracts.js";
import { boardSnapshotSchema } from "./sessions.validation.js";
import { appendForwardHistoryAction, applyBoardHistoryTransition, boardHistoryGuardsMatch, createBoardHistoryGuards, type BoardHistoryStacks } from "./sessions.history.js";
import { acceptedOperationSizeBytes, assertBoardFitsPersistenceLimit, BoardPersistenceLimitError, maximumPersistedBsonBytes } from "./sessions.persistence.js";

const maximumHistoryActions = 500;
const historyFor = (history: Readonly<{ undoActionIds: readonly string[]; redoActionIds: readonly string[] }> | null) =>
  Object.freeze({ canUndo: (history?.undoActionIds.length ?? 0) > 0, canRedo: (history?.redoActionIds.length ?? 0) > 0 });

type SessionRecord = {
  _id: MongoObjectId;
  ownerIdentityId: MongoObjectId;
  title: string;
  status: BoardSession["status"];
  board: BoardSession["board"];
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
};

const mapSession = (record: SessionRecord): BoardSession => Object.freeze({
  id: objectIdToString(record._id),
  ownerIdentityId: objectIdToString(record.ownerIdentityId),
  title: record.title,
  status: record.status,
  board: record.board,
  sequence: record.sequence,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt,
  endedAt: record.endedAt
});

const requireCreatedSession = (session: BoardSession | null): BoardSession => {
  if (session === null) throw new Error("Session creation transaction did not commit.");
  return session;
};

const validateStoredBoard = (value: unknown): BoardSession["board"] => {
  const result = boardSnapshotSchema.safeParse(value);
  if (!result.success) throw new Error("Stored board data failed validation.");
  return result.data;
};

const findSessionWithRecovery = async (sessionId: string): Promise<BoardSession | null> => {
  if (!isObjectIdString(sessionId)) return null;
  const record = await WbBoardSessionModel.findById(sessionId).exec();
  if (!record) return null;
  const snapshot = await WbBoardSnapshotModel.findOne({ sessionId: record._id, sequence: { $lte: record.sequence } }).sort({ sequence: -1 }).lean().exec();
  if (!snapshot) {
    if (record.sequence === 0) return mapSession({ ...record.toObject(), board: validateStoredBoard(record.board) });
    throw new Error("No recoverable board snapshot exists.");
  }
  let board = validateStoredBoard(snapshot.board);
  const operations = await WbBoardOperationModel.find({ sessionId: record._id, sequence: { $gt: snapshot.sequence, $lte: record.sequence } }).sort({ sequence: 1 }).lean().exec();
  let expectedSequence = snapshot.sequence;
  for (const operation of operations) {
    if (operation.sequence !== expectedSequence + 1) throw new Error("Board operation sequence has a recovery gap.");
    board = applyBoardChanges(board, operation.changes);
    expectedSequence = operation.sequence;
  }
  if (expectedSequence !== record.sequence) throw new Error("Board operation history is incomplete.");
  return mapSession({ ...record.toObject(), board });
};

export const createSessionRepository = (): RealtimeSessionRepository => Object.freeze({
  create: async ({ ownerIdentityId, title, board, now }) => {
    if (!isObjectIdString(ownerIdentityId)) throw new Error("Invalid owner identity.");
    assertBoardFitsPersistenceLimit(board);
    const owner = objectIdFromString(ownerIdentityId);
    const transaction = await mongoose.startSession();
    try {
      let created: BoardSession | null = null;
      await transaction.withTransaction(async () => {
        const [record] = await WbBoardSessionModel.create([{ ownerIdentityId: owner, memberIdentityIds: [owner], title, status: "active", board, sequence: 0, createdAt: now, updatedAt: now, endedAt: null }], { session: transaction });
        if (!record) throw new Error("Session creation did not return a record.");
        await WbBoardSnapshotModel.create([{ sessionId: record._id, sequence: 0, board, createdAt: now }], { session: transaction });
        created = mapSession(record);
      });
      return requireCreatedSession(created);
    } finally { await transaction.endSession(); }
  },
  findById: async (sessionId) => {
    return findSessionWithRecovery(sessionId);
  },
  findActiveForMember: async (identityId) => {
    if (!isObjectIdString(identityId)) return Object.freeze([]);
    const records = await WbBoardSessionModel.find({ status: "active", memberIdentityIds: objectIdFromString(identityId) })
      .sort({ updatedAt: -1 }).select({ _id: 1, title: 1, sequence: 1, updatedAt: 1 }).lean().exec();
    return Object.freeze(records.map((record): ActiveBoardSession => Object.freeze({
      id: objectIdToString(record._id), title: record.title, sequence: record.sequence, updatedAt: record.updatedAt
    })));
  },
  rename: async (sessionId, ownerIdentityId, title, now) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(ownerIdentityId)) return null;
    const record = await WbBoardSessionModel.findOneAndUpdate(
      { _id: objectIdFromString(sessionId), ownerIdentityId: objectIdFromString(ownerIdentityId), status: "active" },
      { $set: { title, updatedAt: now } },
      { returnDocument: "after" }
    ).exec();
    return record ? mapSession(record) : null;
  },
  end: async (sessionId, ownerIdentityId, now, expectedSequence) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(ownerIdentityId)) return null;
    const record = await WbBoardSessionModel.findOneAndUpdate(
      { _id: objectIdFromString(sessionId), ownerIdentityId: objectIdFromString(ownerIdentityId), ...(expectedSequence === undefined ? {} : { status: "active", sequence: expectedSequence }) },
      { $set: { status: "ended", endedAt: now, updatedAt: now } },
      { returnDocument: "after" }
    ).exec();
    return record ? mapSession(record) : null;
  },
  deleteEndedSession: async (sessionId, ownerIdentityId) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(ownerIdentityId)) return;
    const id = objectIdFromString(sessionId);
    const owner = objectIdFromString(ownerIdentityId);
    const ended = await WbBoardSessionModel.exists({ _id: id, ownerIdentityId: owner, status: "ended" });
    if (!ended) throw new Error("Only an ended session can be cleaned up.");
    await WbBoardOperationModel.deleteMany({ sessionId: id }).exec();
    await WbBoardHistoryModel.deleteOne({ sessionId: id }).exec();
    await WbBoardSnapshotModel.deleteMany({ sessionId: id }).exec();
    await WbBoardSessionModel.deleteOne({ _id: id, ownerIdentityId: owner, status: "ended" }).exec();
  },
  applyEdit: async (sessionId, actorIdentityId, command, now) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(actorIdentityId)) return null;
    const sessionObjectId = objectIdFromString(sessionId);
    const actorObjectId = objectIdFromString(actorIdentityId);
    const transaction = await mongoose.startSession();
    try {
      let applied: Readonly<{ actionId: string; board: BoardSession["board"]; sequence: number; history: ReturnType<typeof historyFor> }> | null = null;
      await transaction.withTransaction(async () => {
        const [current, priorAction, history] = await Promise.all([
          WbBoardSessionModel.findOne({ _id: sessionObjectId, status: "active", memberIdentityIds: actorObjectId }).session(transaction).lean().exec(),
          WbBoardOperationModel.findOne({ sessionId: sessionObjectId, actionId: command.actionId }).session(transaction).lean().exec(),
          WbBoardHistoryModel.findOne({ sessionId: sessionObjectId }).session(transaction).lean().exec()
        ]);
        if (!current) { applied = null; return; }
        if (command.baseSequence > current.sequence) throw new BoardEditRejected("future_sequence");
        if (priorAction) {
          if (objectIdToString(priorAction.actorIdentityId) !== actorIdentityId || (priorAction.historyKind ?? "edit") !== "edit") throw new BoardEditRejected("action_conflict");
          applied = { actionId: command.actionId, board: current.board, sequence: current.sequence, history: historyFor(history) };
          return;
        }
        let nextBoard: BoardSession["board"];
        try { nextBoard = applyBoardChanges(current.board, command.changes); }
        catch { throw new BoardEditRejected("invalid"); }
        const inverseChanges = diffBoardChanges(nextBoard, current.board);
        const guards = createBoardHistoryGuards(command.changes, nextBoard);
        const inverseGuards = createBoardHistoryGuards(inverseChanges, current.board);
        try { assertBoardFitsPersistenceLimit(nextBoard); }
        catch (error) { if (error instanceof BoardPersistenceLimitError) throw new BoardEditRejected("document_too_large"); throw error; }
        if (acceptedOperationSizeBytes({ changes: command.changes, inverseChanges, guards, inverseGuards }) > maximumPersistedBsonBytes) {
          throw new BoardEditRejected("document_too_large");
        }
        const sequence = current.sequence + 1;
        const isMeaningful = inverseChanges.length > 0;
        const nextStacks = appendForwardHistoryAction({ undo: history?.undoActionIds ?? [], redo: history?.redoActionIds ?? [] }, command.actionId, isMeaningful, maximumHistoryActions);
        const undoActionIds = nextStacks.undo;
        const redoActionIds = nextStacks.redo;
        const [operation] = await WbBoardOperationModel.create([{
          sessionId: sessionObjectId, sequence, actionId: command.actionId, actorIdentityId: actorObjectId,
          baseSequence: command.baseSequence, changes: command.changes, historyKind: "edit",
          ...(inverseChanges.length > 0 ? { inverseChanges } : {}),
          guards,
          inverseGuards, createdAt: now
        }], { session: transaction });
        if (!operation) throw new Error("Accepted edit history was not persisted.");
        const [saved] = await Promise.all([
          WbBoardSessionModel.updateOne({ _id: sessionObjectId, status: "active", memberIdentityIds: actorObjectId, sequence: current.sequence }, { $set: { board: nextBoard, sequence, updatedAt: now } }, { session: transaction }).exec(),
          WbBoardHistoryModel.findOneAndUpdate({ sessionId: sessionObjectId }, { $set: { undoActionIds, redoActionIds, updatedAt: now } }, { upsert: true, session: transaction }).exec(),
          sequence % 100 === 0 ? WbBoardSnapshotModel.create([{ sessionId: sessionObjectId, sequence, board: nextBoard, createdAt: now }], { session: transaction }) : Promise.resolve()
        ]);
        if (saved.modifiedCount !== 1) throw new BoardEditRejected("action_conflict");
        applied = { actionId: command.actionId, board: nextBoard, sequence, history: historyFor({ undoActionIds, redoActionIds }) };
      });
      return applied;
    } finally { await transaction.endSession(); }
  },
  applyHistoryAction: async (sessionId: string, actorIdentityId: string, actionId: string, action: BoardHistoryAction, now: Date) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(actorIdentityId)) return null;
    const sessionObjectId = objectIdFromString(sessionId);
    const actorObjectId = objectIdFromString(actorIdentityId);
    const transaction = await mongoose.startSession();
    try {
      let applied: Readonly<{ actionId: string; board: BoardSession["board"]; sequence: number; history: ReturnType<typeof historyFor> }> | null = null;
      await transaction.withTransaction(async () => {
        const [current, priorAction, history] = await Promise.all([
          WbBoardSessionModel.findOne({ _id: sessionObjectId, status: "active", memberIdentityIds: actorObjectId }).session(transaction).lean().exec(),
          WbBoardOperationModel.findOne({ sessionId: sessionObjectId, actionId }).session(transaction).lean().exec(),
          WbBoardHistoryModel.findOne({ sessionId: sessionObjectId }).session(transaction).lean().exec()
        ]);
        if (!current) { applied = null; return; }
        if (priorAction) {
          if (objectIdToString(priorAction.actorIdentityId) !== actorIdentityId || priorAction.historyKind !== action) throw new BoardEditRejected("action_conflict");
          applied = { actionId, board: current.board, sequence: current.sequence, history: historyFor(history) };
          return;
        }
        const undoActionIds = [...(history?.undoActionIds ?? [])];
        const redoActionIds = [...(history?.redoActionIds ?? [])];
        const targetActionId = (action === "undo" ? undoActionIds : redoActionIds).at(-1);
        if (targetActionId === undefined) throw new BoardEditRejected("history_unavailable");
        const target = await WbBoardOperationModel.findOne({ sessionId: sessionObjectId, actionId: targetActionId }).session(transaction).lean().exec();
        if (!target) throw new BoardEditRejected("history_unavailable");
        const changes = action === "undo" ? target.inverseChanges : target.changes;
        const guards = action === "undo" ? target.guards : target.inverseGuards;
        if (changes === undefined || guards === undefined || !boardHistoryGuardsMatch(current.board, guards)) {
          throw new BoardEditRejected("unsafe_inverse");
        }
        let nextBoard: BoardSession["board"];
        try { nextBoard = applyBoardChanges(current.board, changes); }
        catch { throw new BoardEditRejected("unsafe_inverse"); }
        try { assertBoardFitsPersistenceLimit(nextBoard); }
        catch (error) { if (error instanceof BoardPersistenceLimitError) throw new BoardEditRejected("document_too_large"); throw error; }
        let nextStacks: BoardHistoryStacks;
        try { nextStacks = applyBoardHistoryTransition({ undo: undoActionIds, redo: redoActionIds }, action, targetActionId, maximumHistoryActions); }
        catch { throw new BoardEditRejected("history_unavailable"); }
        const inverseChanges = diffBoardChanges(nextBoard, current.board);
        const nextGuards = createBoardHistoryGuards(changes, nextBoard);
        const inverseGuards = createBoardHistoryGuards(inverseChanges, current.board);
        if (acceptedOperationSizeBytes({ changes, inverseChanges, guards: nextGuards, inverseGuards }) > maximumPersistedBsonBytes) {
          throw new BoardEditRejected("document_too_large");
        }
        const sequence = current.sequence + 1;
        const [operation] = await WbBoardOperationModel.create([{
          sessionId: sessionObjectId, sequence, actionId, actorIdentityId: actorObjectId,
          baseSequence: current.sequence, changes, historyKind: action, targetActionId, inverseChanges,
          guards: nextGuards,
          inverseGuards, createdAt: now
        }], { session: transaction });
        if (!operation) throw new Error("History action was not persisted.");
        const [saved] = await Promise.all([
          WbBoardSessionModel.updateOne({ _id: sessionObjectId, status: "active", memberIdentityIds: actorObjectId, sequence: current.sequence }, { $set: { board: nextBoard, sequence, updatedAt: now } }, { session: transaction }).exec(),
          WbBoardHistoryModel.findOneAndUpdate({ sessionId: sessionObjectId }, { $set: { undoActionIds: nextStacks.undo, redoActionIds: nextStacks.redo, updatedAt: now } }, { upsert: true, session: transaction }).exec()
        ]);
        if (saved.modifiedCount !== 1) throw new BoardEditRejected("action_conflict");
        const boundedUndoActionIds = nextStacks.undo;
        const boundedRedoActionIds = nextStacks.redo;
        if (sequence % 100 === 0) await WbBoardSnapshotModel.create([{ sessionId: sessionObjectId, sequence, board: nextBoard, createdAt: now }], { session: transaction });
        applied = { actionId, board: nextBoard, sequence, history: historyFor({ undoActionIds: boundedUndoActionIds, redoActionIds: boundedRedoActionIds }) };
      });
      return applied;
    } finally { await transaction.endSession(); }
  },
  getHistoryState: async (sessionId: string) => {
    if (!isObjectIdString(sessionId)) return Object.freeze({ canUndo: false, canRedo: false });
    return historyFor(await WbBoardHistoryModel.findOne({ sessionId: objectIdFromString(sessionId) }).lean().exec());
  },
  claimConnection: async (sessionId, identityId, connectionId, now, leaseExpiresAt) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(identityId)) return false;
    const validConnections = { $filter: { input: { $ifNull: ["$activeConnections", []] }, as: "connection", cond: { $and: [{ $gt: ["$$connection.leaseExpiresAt", now] }, { $ne: ["$$connection.connectionId", connectionId] }] } } };
    const result = await WbBoardSessionModel.updateOne({ _id: objectIdFromString(sessionId), status: "active", memberIdentityIds: objectIdFromString(identityId) }, [{ $set: { activeConnections: { $concatArrays: [validConnections, [{ identityId: objectIdFromString(identityId), connectionId, leaseExpiresAt }]] } } }], { updatePipeline: true }).exec();
    return result.modifiedCount === 1;
  },
  refreshConnection: async (sessionId, connectionId, leaseExpiresAt) => {
    if (!isObjectIdString(sessionId)) return false;
    const now = new Date();
    const result = await WbBoardSessionModel.updateOne({ _id: objectIdFromString(sessionId), status: "active", activeConnections: { $elemMatch: { connectionId, leaseExpiresAt: { $gt: now } } } }, { $set: { "activeConnections.$.leaseExpiresAt": leaseExpiresAt } }).exec();
    return result.modifiedCount === 1;
  },
  releaseConnection: async (sessionId, connectionId) => {
    if (!isObjectIdString(sessionId)) return;
    await WbBoardSessionModel.updateOne({ _id: objectIdFromString(sessionId) }, { $pull: { activeConnections: { connectionId } } }).exec();
  }
});

export const ensureSessionIndexes = async (): Promise<void> => {
  await WbBoardSessionModel.updateMany({ $or: [{ memberIdentityIds: { $exists: false } }, { sequence: { $exists: false } }] }, [{ $set: { memberIdentityIds: { $ifNull: ["$memberIdentityIds", ["$ownerIdentityId"]] }, sequence: { $ifNull: ["$sequence", 0] } } }], { updatePipeline: true }).exec();
  await Promise.all([WbBoardSessionModel.createIndexes(), WbBoardOperationModel.createIndexes(), WbBoardSnapshotModel.createIndexes(), WbBoardHistoryModel.createIndexes()]);
  const legacySessions = await WbBoardSessionModel.find({ sequence: 0 }).select({ _id: 1, board: 1, createdAt: 1 }).lean().exec();
  await Promise.all(legacySessions.map((session) => WbBoardSnapshotModel.updateOne({ sessionId: session._id, sequence: 0 }, { $setOnInsert: { board: session.board, createdAt: session.createdAt } }, { upsert: true }).exec()));
};
