import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mongoose } from "../../../integrations/mongodb/index.js";
import { createSessionRepository, ensureSessionIndexes, findActiveRooms } from "../sessions.repository.js";
import { WbBoardSessionModel } from "../sessions.model.js";
import { WbBoardSnapshotModel } from "../sessions.snapshot.model.js";
import { WbBoardOperationModel } from "../sessions.operation.model.js";
import { WbBoardHistoryModel } from "../sessions.history.model.js";
import type { BoardSnapshot } from "../sessions.validation.js";
import { BoardEditRejected } from "../sessions.contracts.js";

const id = new mongoose.Types.ObjectId();
const owner = new mongoose.Types.ObjectId();
const now = new Date("2026-01-01T00:00:00Z");
const board: BoardSnapshot = { id: "board-1", title: "Plan", templateId: "blank", canvas: { gridStyle: "graph-paper", gridSpacing: 20 }, objects: [] };
const sessionRecord = (overrides: Record<string, unknown> = {}) => ({
  _id: id, ownerIdentityId: owner, memberIdentityIds: [owner], title: "Plan", status: "active" as const, board,
  sequence: 0, createdAt: now, updatedAt: now, endedAt: null, activeConnections: [], ...overrides
});
const exec = <T>(value: T) => ({ exec: () => Promise.resolve(value) });
const mock = (context: TestContext, model: object, method: string, implementation: (...args: never[]) => unknown): void => {
  context.mock.method(model as Record<string, (...args: never[]) => unknown>, method, implementation as never);
};
const transaction = () => ({ withTransaction: (callback: () => Promise<unknown>) => callback(), endSession: () => Promise.resolve() });

void test("creates a server session and initial snapshot in one transaction", async (context) => {
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction())));
  let sessionInput: unknown;
  mock(context, WbBoardSessionModel, "create", ((records: unknown[]) => {
    sessionInput = records[0];
    return Promise.resolve([sessionRecord({ title: "Team", board, sequence: 0 })]);
  }));
  let snapshotInput: unknown;
  mock(context, WbBoardSnapshotModel, "create", ((records: unknown[]) => { snapshotInput = records[0]; return Promise.resolve([]); }));
  const created = await createSessionRepository().create({ ownerIdentityId: owner.toHexString(), title: "Team", board, now });
  assert.equal(created.title, "Team");
  assert.equal((sessionInput as { status: string }).status, "active");
  assert.equal((snapshotInput as { sequence: number }).sequence, 0);
  assert.equal((snapshotInput as { sessionId: mongoose.Types.ObjectId }).sessionId.toHexString(), id.toHexString());
});

void test("closes the transaction and fails if MongoDB does not return a new session", async (context) => {
  let ended = false;
  mock(context, mongoose, "startSession", (() => Promise.resolve({
    withTransaction: (callback: () => Promise<unknown>) => callback(), endSession: () => { ended = true; return Promise.resolve(); }
  })));
  mock(context, WbBoardSessionModel, "create", (() => Promise.resolve([])));
  await assert.rejects(createSessionRepository().create({ ownerIdentityId: owner.toHexString(), title: "Team", board, now }), /did not return a record/);
  assert.equal(ended, true);
});

void test("lists active sessions for valid members and returns an empty list for invalid IDs", async (context) => {
  let query: unknown;
  mock(context, WbBoardSessionModel, "find", ((filter: unknown) => {
    query = filter;
    return { sort(order: unknown) { assert.deepEqual(order, { updatedAt: -1 }); return this; }, select(fields: unknown) { assert.deepEqual(fields, { _id: 1, title: 1, sequence: 1, updatedAt: 1 }); return this; }, lean() { return this; }, exec: () => Promise.resolve([{ _id: id, title: "Plan", sequence: 5, updatedAt: now }]) };
  }));
  const repository = createSessionRepository();
  assert.deepEqual(await repository.findActiveForMember("bad"), []);
  assert.deepEqual(await repository.findActiveForMember(owner.toHexString()), [{ id: id.toHexString(), title: "Plan", sequence: 5, updatedAt: now }]);
  assert.deepEqual(query, { status: "active", memberIdentityIds: owner });
});

void test("renames and ends only matching valid sessions", async (context) => {
  let renameQuery: unknown;
  mock(context, WbBoardSessionModel, "findOneAndUpdate", ((filter: unknown) => { renameQuery = filter; return exec(sessionRecord({ title: "Renamed" })); }));
  const repository = createSessionRepository();
  assert.equal(await repository.rename("bad", owner.toHexString(), "X", now), null);
  assert.equal((await repository.rename(id.toHexString(), owner.toHexString(), "Renamed", now))?.title, "Renamed");
  assert.deepEqual(renameQuery, { _id: id, ownerIdentityId: owner, status: "active" });
  mock(context, WbBoardSessionModel, "findOneAndUpdate", ((filter: unknown) => { renameQuery = filter; return exec(sessionRecord({ status: "ended", endedAt: now })); }));
  assert.equal((await repository.end(id.toHexString(), owner.toHexString(), now, 9))?.status, "ended");
  assert.deepEqual(renameQuery, { _id: id, ownerIdentityId: owner, status: "active", sequence: 9 });
  mock(context, WbBoardSessionModel, "findOneAndUpdate", (() => exec(null)));
  assert.equal(await repository.end(id.toHexString(), owner.toHexString(), now), null);
});

void test("deletes associated records only for an ended session", async (context) => {
  const repository = createSessionRepository();
  let existsQuery: unknown;
  mock(context, WbBoardSessionModel, "exists", ((filter: unknown) => { existsQuery = filter; return Promise.resolve({ _id: id }); }));
  const deleted: string[] = [];
  mock(context, WbBoardOperationModel, "deleteMany", (() => { deleted.push("operations"); return exec({ deletedCount: 2 }); }));
  mock(context, WbBoardHistoryModel, "deleteOne", (() => { deleted.push("history"); return exec({ deletedCount: 1 }); }));
  mock(context, WbBoardSnapshotModel, "deleteMany", (() => { deleted.push("snapshots"); return exec({ deletedCount: 2 }); }));
  mock(context, WbBoardSessionModel, "deleteOne", (() => { deleted.push("session"); return exec({ deletedCount: 1 }); }));
  await repository.deleteEndedSession("bad", owner.toHexString());
  await repository.deleteEndedSession(id.toHexString(), owner.toHexString());
  assert.deepEqual(existsQuery, { _id: id, ownerIdentityId: owner, status: "ended" });
  assert.deepEqual(deleted, ["operations", "history", "snapshots", "session"]);
  mock(context, WbBoardSessionModel, "exists", (() => Promise.resolve(null)));
  await assert.rejects(repository.deleteEndedSession(id.toHexString(), owner.toHexString()), /Only an ended session/);
});

void test("reads shared undo and redo availability", async (context) => {
  const repository = createSessionRepository();
  assert.deepEqual(await repository.getHistoryState("bad"), { canUndo: false, canRedo: false });
  mock(context, WbBoardHistoryModel, "findOne", (() => ({ lean() { return this; }, exec: () => Promise.resolve({ undoActionIds: ["edit"], redoActionIds: [] }) })));
  assert.deepEqual(await repository.getHistoryState(id.toHexString()), { canUndo: true, canRedo: false });
});

void test("applies a shared board edit transactionally and rejects edits for missing members", async (context) => {
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction())));
  mock(context, WbBoardSessionModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve(sessionRecord()) })));
  mock(context, WbBoardOperationModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve(null) })));
  mock(context, WbBoardHistoryModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve(null) })));
  mock(context, WbBoardOperationModel, "create", (() => Promise.resolve([{}])));
  mock(context, WbBoardSessionModel, "updateOne", (() => exec({ modifiedCount: 1 })));
  mock(context, WbBoardHistoryModel, "findOneAndUpdate", (() => exec({})));
  const command = { actionId: "action-1", baseSequence: 0, changes: [{ kind: "board.title" as const, value: "Updated" }] };
  const result = await createSessionRepository().applyEdit(id.toHexString(), owner.toHexString(), command, now);
  assert.ok(result);
  assert.equal(result.board.title, "Updated");
  assert.equal(result.sequence, 1);
  assert.deepEqual(result.history, { canUndo: true, canRedo: false });
  assert.equal(await createSessionRepository().applyEdit("bad", owner.toHexString(), command, now), null);
});

void test("applies a shared undo by checking saved guards and moving the action to redo", async (context) => {
  const currentBoard = { ...board, title: "Updated" };
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction())));
  mock(context, WbBoardSessionModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve(sessionRecord({ sequence: 1, board: currentBoard })) })));
  let operationReads = 0;
  mock(context, WbBoardOperationModel, "findOne", (() => ({
    session() { return this; }, lean() { return this; },
    exec: () => {
      operationReads += 1;
      return Promise.resolve(operationReads === 1 ? null : {
        actionId: "edit-1", actorIdentityId: owner, historyKind: "edit",
        inverseChanges: [{ kind: "board.title", value: "Plan" }],
        guards: [{ kind: "board.title", value: "Updated" }],
        inverseGuards: [{ kind: "board.title", value: "Plan" }], changes: [{ kind: "board.title", value: "Updated" }]
      });
    }
  })));
  mock(context, WbBoardHistoryModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve({ undoActionIds: ["edit-1"], redoActionIds: [] }) })));
  mock(context, WbBoardOperationModel, "create", (() => Promise.resolve([{}])));
  mock(context, WbBoardSessionModel, "updateOne", (() => exec({ modifiedCount: 1 })));
  mock(context, WbBoardHistoryModel, "findOneAndUpdate", (() => exec({})));
  const result = await createSessionRepository().applyHistoryAction(id.toHexString(), owner.toHexString(), "undo-action", "undo", now);
  assert.ok(result);
  assert.equal(result.board.title, "Plan");
  assert.equal(result.sequence, 2);
  assert.deepEqual(result.history, { canUndo: false, canRedo: true });
  assert.equal(await createSessionRepository().applyHistoryAction("bad", owner.toHexString(), "undo-action", "undo", now), null);
});

void test("rejects undo when no shared history action is available", async (context) => {
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction())));
  mock(context, WbBoardSessionModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve(sessionRecord()) })));
  mock(context, WbBoardOperationModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve(null) })));
  mock(context, WbBoardHistoryModel, "findOne", (() => ({ session() { return this; }, lean() { return this; }, exec: () => Promise.resolve({ undoActionIds: [], redoActionIds: [] }) })));
  await assert.rejects(createSessionRepository().applyHistoryAction(id.toHexString(), owner.toHexString(), "undo-action", "undo", now), (error: unknown) => error instanceof BoardEditRejected && error.reason === "history_unavailable");
});

void test("claims, refreshes and releases participant connections", async (context) => {
  const repository = createSessionRepository();
  let claimQuery: unknown;
  mock(context, WbBoardSessionModel, "updateOne", ((filter: unknown) => { claimQuery = filter; return exec({ modifiedCount: 1 }); }));
  assert.equal(await repository.claimConnection(id.toHexString(), owner.toHexString(), "connection-1", now, new Date(now.getTime() + 30_000)), true);
  assert.deepEqual(claimQuery, { _id: id, status: "active", memberIdentityIds: owner });
  assert.equal(await repository.claimConnection("bad", owner.toHexString(), "connection-1", now, now), false);
  mock(context, WbBoardSessionModel, "updateOne", (() => exec({ modifiedCount: 0 })));
  assert.equal(await repository.refreshConnection("bad", "connection-1", now), false);
  assert.equal(await repository.refreshConnection(id.toHexString(), "connection-1", now), false);
  mock(context, WbBoardSessionModel, "updateOne", (() => exec({ modifiedCount: 1 })));
  assert.equal(await repository.refreshConnection(id.toHexString(), "connection-1", now), true);
  await repository.releaseConnection("bad", "connection-1");
  await repository.releaseConnection(id.toHexString(), "connection-1");
});

void test("reports rooms with unexpired connections in stable order", async (context) => {
  mock(context, WbBoardSessionModel, "find", (() => ({ select() { return this; }, lean() { return this; }, exec: () => Promise.resolve([
    { _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439012"), activeConnections: [{ leaseExpiresAt: new Date(Date.now() + 30_000) }, { leaseExpiresAt: new Date(Date.now() - 1_000) }] },
    { _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"), activeConnections: [{ leaseExpiresAt: new Date(Date.now() + 30_000) }] },
    { _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439013"), activeConnections: [] }
  ]) })));
  assert.deepEqual(await findActiveRooms(), [
    { sessionId: "507f1f77bcf86cd799439011", connections: 1 },
    { sessionId: "507f1f77bcf86cd799439012", connections: 1 }
  ]);
});

void test("ensures indexes and initializes sequence-zero snapshots for legacy sessions", async (context) => {
  mock(context, WbBoardSessionModel, "updateMany", (() => exec({ modifiedCount: 0 })));
  const indexed: string[] = [];
  for (const [index, model] of [WbBoardSessionModel, WbBoardOperationModel, WbBoardSnapshotModel, WbBoardHistoryModel].entries()) {
    mock(context, model, "createIndexes", (() => { indexed.push(String(index)); return Promise.resolve([]); }));
  }
  mock(context, WbBoardSessionModel, "find", (() => ({ select() { return this; }, lean() { return this; }, exec: () => Promise.resolve([{ _id: id, board, createdAt: now }]) })));
  let snapshotUpdate: unknown[] = [];
  mock(context, WbBoardSnapshotModel, "updateOne", ((...args: unknown[]) => { snapshotUpdate = args; return exec({ upsertedCount: 1 }); }));
  await ensureSessionIndexes();
  assert.equal(indexed.length, 4);
  assert.deepEqual(snapshotUpdate[0], { sessionId: id, sequence: 0 });
  assert.deepEqual(snapshotUpdate[2], { upsert: true });
});
