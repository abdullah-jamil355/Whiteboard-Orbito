import test from "node:test";
import assert from "node:assert/strict";
import { acceptedOperationSizeBytes, assertBoardFitsPersistenceLimit, maximumPersistedBsonBytes, persistedBoardSizeBytes } from "../sessions.persistence.js";
import type { BoardSnapshot } from "../sessions.validation.js";

const board: BoardSnapshot = { id: "board-1", title: "Untitled", templateId: "blank", canvas: { gridStyle: "graph-paper", gridSpacing: 22 }, objects: [] };

void test("allows a small board below the BSON persistence limit", () => {
  assert.ok(persistedBoardSizeBytes(board) < maximumPersistedBsonBytes);
  assert.doesNotThrow(() => { assertBoardFitsPersistenceLimit(board); });
});

void test("rejects boards that could exceed MongoDB's per-document limit", () => {
  const largeBoard: BoardSnapshot = {
    ...board,
    objects: Array.from({ length: 1_000 }, (_, index) => ({
      id: `text-${String(index)}`, type: "text" as const, geometry: { x: 0, y: 0, width: 100, height: 100 },
      text: "x".repeat(10_000), alignment: "left" as const, fontSize: 16, bold: false, color: "#000000"
    }))
  };
  assert.ok(persistedBoardSizeBytes(largeBoard) > maximumPersistedBsonBytes);
  assert.throws(() => { assertBoardFitsPersistenceLimit(largeBoard); }, /safe MongoDB document limit/);
});

void test("measures the operation payload including inverse and history guards", () => {
  const oneStroke = { id: "stroke-1", type: "stroke" as const, points: Array.from({ length: 100_000 }, () => ({ x: 1, y: 2 })), color: "#000000", lineWeight: "thin" as const };
  const changes = Array.from({ length: 5 }, (_, index) => ({ kind: "object.add" as const, object: { ...oneStroke, id: `stroke-${String(index)}` } }));
  const inverseChanges = changes.map(({ object }) => ({ kind: "object.remove" as const, objectId: object.id }));
  const size = acceptedOperationSizeBytes({ changes, inverseChanges, guards: [], inverseGuards: [] });
  assert.ok(size > maximumPersistedBsonBytes);
});
