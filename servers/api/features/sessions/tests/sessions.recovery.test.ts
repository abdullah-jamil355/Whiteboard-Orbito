import test from "node:test";
import assert from "node:assert/strict";
import { mongoose } from "../../../integrations/mongodb/index.js";
import { WbBoardSessionModel } from "../sessions.model.js";
import { WbBoardSnapshotModel } from "../sessions.snapshot.model.js";
import { WbBoardOperationModel } from "../sessions.operation.model.js";
import { findSessionWithRecovery, mapSession, recoverBoardState, requireCreatedSession, validateStoredBoard, type SessionRecord } from "../sessions.recovery.js";
import type { BoardSnapshot } from "../sessions.validation.js";

const board: BoardSnapshot = { id: "board-1", title: "Plan", templateId: "blank", canvas: { gridStyle: "graph-paper", gridSpacing: 20 }, objects: [] };
const id = new mongoose.Types.ObjectId();

void test("maps persistence records to immutable public session data", () => {
  const record: SessionRecord = {
    _id: id, ownerIdentityId: id, title: "Plan", status: "active", board, sequence: 4,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), endedAt: null
  };
  const mapped = mapSession(record);
  assert.deepEqual(mapped, {
    id: id.toHexString(), ownerIdentityId: id.toHexString(), title: "Plan", status: "active", board, sequence: 4,
    createdAt: record.createdAt, updatedAt: record.updatedAt, endedAt: null
  });
  assert.equal(Object.isFrozen(mapped), true);
});

void test("requires transaction creation to return a committed session", () => {
  assert.throws(() => requireCreatedSession(null), /transaction did not commit/);
});

void test("validates stored boards and rejects malformed snapshots", () => {
  assert.deepEqual(validateStoredBoard(board), board);
  assert.throws(() => validateStoredBoard({ ...board, unknown: true }), /Stored board data failed validation/);
});

void test("recovery returns null for a malformed session ID without querying storage", async () => {
  assert.equal(await findSessionWithRecovery("bad-id"), null);
});

void test("replays every operation after the latest snapshot in sequence order", () => {
  const recovered = recoverBoardState({
    recordBoard: board,
    recordSequence: 4,
    snapshot: { board, sequence: 2 },
    operations: [
      { sequence: 3, changes: [{ kind: "board.title", value: "Draft" }] },
      { sequence: 4, changes: [{ kind: "board.title", value: "Final" }] }
    ]
  });
  assert.equal(recovered.title, "Final");
});

void test("uses the initial board only when sequence zero has no snapshot", () => {
  assert.deepEqual(recoverBoardState({ recordBoard: board, recordSequence: 0, snapshot: null, operations: [] }), board);
  assert.throws(() => recoverBoardState({ recordBoard: board, recordSequence: 1, snapshot: null, operations: [] }), /No recoverable board snapshot/);
});

void test("rejects operation gaps, incomplete history and malformed snapshot data", () => {
  assert.throws(() => recoverBoardState({
    recordBoard: board, recordSequence: 4, snapshot: { board, sequence: 2 },
    operations: [{ sequence: 4, changes: [{ kind: "board.title", value: "Skipped" }] }]
  }), /recovery gap/);
  assert.throws(() => recoverBoardState({ recordBoard: board, recordSequence: 3, snapshot: { board, sequence: 2 }, operations: [] }), /history is incomplete/);
  assert.throws(() => recoverBoardState({ recordBoard: board, recordSequence: 0, snapshot: { board: { invalid: true }, sequence: 0 }, operations: [] }), /Stored board data failed validation/);
});

void test("loads the persisted session snapshot and replays only later operations", async (context) => {
  const record = {
    _id: id, ownerIdentityId: id, title: "Plan", status: "active" as const, board, sequence: 2,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), endedAt: null,
    toObject: () => ({ _id: id, ownerIdentityId: id, title: "Plan", status: "active" as const, board, sequence: 2,
      createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), endedAt: null })
  };
  let snapshotQuery: unknown;
  let operationQuery: unknown;
  context.mock.method(WbBoardSessionModel, "findById", (() => ({ exec: () => Promise.resolve(record) })) as never);
  const snapshotChain = {
    sort(order: unknown) { assert.deepEqual(order, { sequence: -1 }); return this; },
    lean() { return this; },
    exec: () => Promise.resolve({ board, sequence: 1 })
  };
  context.mock.method(WbBoardSnapshotModel, "findOne", ((query: unknown) => { snapshotQuery = query; return snapshotChain; }) as never);
  const operationChain = {
    sort(order: unknown) { assert.deepEqual(order, { sequence: 1 }); return this; },
    lean() { return this; },
    exec: () => Promise.resolve([{ sequence: 2, changes: [{ kind: "board.title" as const, value: "Recovered" }] }])
  };
  context.mock.method(WbBoardOperationModel, "find", ((query: unknown) => { operationQuery = query; return operationChain; }) as never);

  const recovered = await findSessionWithRecovery(id.toHexString());
  assert.equal(recovered?.board.title, "Recovered");
  assert.deepEqual(snapshotQuery, { sessionId: id, sequence: { $lte: 2 } });
  assert.deepEqual(operationQuery, { sessionId: id, sequence: { $gt: 1, $lte: 2 } });
});

void test("uses the sequence-zero stored board when a legacy session has no snapshot", async (context) => {
  const legacyRecord = {
    _id: id, ownerIdentityId: id, title: "Legacy", status: "active" as const, board, sequence: 0,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), endedAt: null,
    toObject: () => ({ _id: id, ownerIdentityId: id, title: "Legacy", status: "active" as const, board, sequence: 0,
      createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-01T00:00:00Z"), endedAt: null })
  };
  context.mock.method(WbBoardSessionModel, "findById", (() => ({ exec: () => Promise.resolve(legacyRecord) })) as never);
  const noSnapshot = { sort() { return this; }, lean() { return this; }, exec: () => Promise.resolve(null) };
  context.mock.method(WbBoardSnapshotModel, "findOne", (() => noSnapshot) as never);
  const legacy = await findSessionWithRecovery(id.toHexString());
  assert.equal(legacy?.board.title, "Plan");
});

void test("returns null when the requested session does not exist", async (context) => {
  context.mock.method(WbBoardSessionModel, "findById", (() => ({ exec: () => Promise.resolve(null) })) as never);
  assert.equal(await findSessionWithRecovery(id.toHexString()), null);
});

void test("rejects a stored session with no snapshot after its initial sequence", async (context) => {
  const changedRecord = {
    _id: id, ownerIdentityId: id, title: "Plan", status: "active" as const, board, sequence: 1,
    createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), endedAt: null,
    toObject: () => ({ _id: id, ownerIdentityId: id, title: "Plan", status: "active" as const, board, sequence: 1,
      createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), endedAt: null })
  };
  context.mock.method(WbBoardSessionModel, "findById", (() => ({ exec: () => Promise.resolve(changedRecord) })) as never);
  const noSnapshot = { sort() { return this; }, lean() { return this; }, exec: () => Promise.resolve(null) };
  context.mock.method(WbBoardSnapshotModel, "findOne", (() => noSnapshot) as never);
  await assert.rejects(findSessionWithRecovery(id.toHexString()), /No recoverable board snapshot/);
});
