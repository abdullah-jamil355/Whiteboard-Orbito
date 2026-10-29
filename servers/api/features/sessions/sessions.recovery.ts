import { isObjectIdString, objectIdToString, type MongoObjectId } from "../../integrations/mongodb/index.js";
import type { BoardSession } from "./sessions.contracts.js";
import { WbBoardSessionModel } from "./sessions.model.js";
import { WbBoardOperationModel } from "./sessions.operation.model.js";
import { WbBoardSnapshotModel } from "./sessions.snapshot.model.js";
import { applyBoardChanges } from "./sessions.collaboration.js";
import { boardSnapshotSchema } from "./sessions.validation.js";

export type SessionRecord = {
  _id: MongoObjectId;
  board: BoardSession["board"];
  createdAt: Date;
  endedAt: Date | null;
  ownerIdentityId: MongoObjectId;
  sequence: number;
  status: BoardSession["status"];
  title: string;
  updatedAt: Date;
};

export const mapSession = (record: SessionRecord): BoardSession =>
  Object.freeze({
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

export const requireCreatedSession = (session: BoardSession | null): BoardSession => {
  if (session === null) throw new Error("Session creation transaction did not commit.");
  return session;
};

export const validateStoredBoard = (value: unknown): BoardSession["board"] => {
  const result = boardSnapshotSchema.safeParse(value);
  if (!result.success) throw new Error("Stored board data failed validation.");
  return result.data;
};

export const findSessionWithRecovery = async (sessionId: string): Promise<BoardSession | null> => {
  if (!isObjectIdString(sessionId)) return null;
  const record = await WbBoardSessionModel.findById(sessionId).exec();
  if (!record) return null;
  const snapshot = await WbBoardSnapshotModel.findOne({
    sessionId: record._id,
    sequence: { $lte: record.sequence }
  })
    .sort({ sequence: -1 })
    .lean()
    .exec();

  if (!snapshot) {
    if (record.sequence === 0) {
      return mapSession({ ...record.toObject(), board: validateStoredBoard(record.board) });
    }
    throw new Error("No recoverable board snapshot exists.");
  }

  let board = validateStoredBoard(snapshot.board);
  const operations = await WbBoardOperationModel.find({
    sessionId: record._id,
    sequence: { $gt: snapshot.sequence, $lte: record.sequence }
  })
    .sort({ sequence: 1 })
    .lean()
    .exec();

  let expectedSequence = snapshot.sequence;
  for (const operation of operations) {
    if (operation.sequence !== expectedSequence + 1) {
      throw new Error("Board operation sequence has a recovery gap.");
    }
    board = applyBoardChanges(board, operation.changes);
    expectedSequence = operation.sequence;
  }
  if (expectedSequence !== record.sequence) {
    throw new Error("Board operation history is incomplete.");
  }
  return mapSession({ ...record.toObject(), board });
};
