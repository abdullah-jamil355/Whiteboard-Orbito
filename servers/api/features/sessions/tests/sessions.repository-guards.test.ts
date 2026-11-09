import test from "node:test";
import assert from "node:assert/strict";
import { createSessionRepository } from "../sessions.repository.js";

const board = { id: "board-1", title: "Board", templateId: "blank", canvas: { gridStyle: "graph-paper" as const, gridSpacing: 20 }, objects: [] };
const invalidId = "not-an-object-id";

void test("repository rejects invalid IDs without reaching MongoDB", async () => {
  const repository = createSessionRepository();
  assert.equal(await repository.findById(invalidId), null);
  assert.deepEqual(await repository.findActiveForMember(invalidId), []);
  assert.equal(await repository.rename(invalidId, invalidId, "Updated", new Date()), null);
  assert.equal(await repository.end(invalidId, invalidId, new Date()), null);
  await repository.deleteEndedSession(invalidId, invalidId);
  assert.equal(await repository.applyEdit(invalidId, invalidId, { actionId: "a", baseSequence: 0, changes: [] }, new Date()), null);
  assert.equal(await repository.applyHistoryAction(invalidId, invalidId, "a", "undo", new Date()), null);
  assert.deepEqual(await repository.getHistoryState(invalidId), { canUndo: false, canRedo: false });
  assert.equal(await repository.claimConnection(invalidId, invalidId, "connection", new Date(), new Date()), false);
  assert.equal(await repository.refreshConnection(invalidId, "connection", new Date()), false);
  await repository.releaseConnection(invalidId, "connection");
});

void test("create rejects malformed owner IDs and oversized board snapshots before opening a transaction", async () => {
  const repository = createSessionRepository();
  await assert.rejects(repository.create({ ownerIdentityId: invalidId, title: "Board", board, now: new Date() }), /Invalid owner identity/);
  const oversizedBoard = {
    ...board,
    objects: Array.from({ length: 1_000 }, (_, index) => ({
      id: `text-${String(index)}`, type: "text" as const, geometry: { x: 0, y: 0, width: 100, height: 100 },
      text: "x".repeat(10_000), alignment: "left" as const, fontSize: 16, bold: false, color: "#000000"
    }))
  };
  await assert.rejects(repository.create({ ownerIdentityId: "507f1f77bcf86cd799439011", title: "Board", board: oversizedBoard, now: new Date() }), /safe MongoDB document limit/);
});
