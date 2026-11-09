import test from "node:test";
import assert from "node:assert/strict";
import type { BoardEditChange, BoardSnapshot } from "../sessions.validation.js";
import { appendForwardHistoryAction, applyBoardHistoryTransition, boardHistoryGuardsMatch, createBoardHistoryGuards } from "../sessions.history.js";

const shape = { id: "shape-1", type: "shape" as const, shape: "rectangle" as const, geometry: { x: 1, y: 2, width: 30, height: 40 }, style: { fill: "none" as const, stroke: "#111111", lineWeight: "thin" as const } };
const board: BoardSnapshot = { id: "board-1", title: "Plan", templateId: "blank", canvas: { gridStyle: "graph-paper", gridSpacing: 20 }, objects: [shape] };

void test("history guards capture board metadata, object state, order and nested object properties", () => {
  const changes: readonly BoardEditChange[] = [
    { kind: "board.title", value: "Next" },
    { kind: "board.template", value: "flowchart" },
    { kind: "object.add", object: { ...shape, id: "added" } },
    { kind: "objects.order", objectIds: ["shape-1"] }
  ];
  const changed: BoardSnapshot = { ...board, title: "Next", templateId: "flowchart", objects: [{ ...shape, id: "added" }] };
  const guards = createBoardHistoryGuards(changes, changed);
  assert.equal(Object.isFrozen(guards), true);
  assert.equal(guards.length, 4);
  assert.equal(boardHistoryGuardsMatch(changed, guards), true);
  assert.equal(boardHistoryGuardsMatch({ ...changed, title: "Different" }, guards), false);
  assert.equal(boardHistoryGuardsMatch({ ...changed, templateId: "other" }, guards), false);
  assert.equal(boardHistoryGuardsMatch({ ...changed, objects: [] }, guards), false);
});

void test("object state guards detect additions, removals and missing nested values", () => {
  const addedBoard: BoardSnapshot = { ...board, objects: [...board.objects, { ...shape, id: "added" }] };
  const addedGuard = createBoardHistoryGuards([{ kind: "object.add", object: { ...shape, id: "added" } }], addedBoard);
  assert.equal(boardHistoryGuardsMatch(addedBoard, addedGuard), true);
  assert.equal(boardHistoryGuardsMatch(board, addedGuard), false);
  const removedBoard: BoardSnapshot = { ...board, objects: [] };
  const removedGuard = createBoardHistoryGuards([{ kind: "object.remove", objectId: "shape-1" }], removedBoard);
  assert.equal(boardHistoryGuardsMatch(removedBoard, removedGuard), true);
  assert.equal(boardHistoryGuardsMatch(board, removedGuard), false);
  const movedShape = { ...shape, geometry: { ...shape.geometry, x: 10 } };
  const changedBoard: BoardSnapshot = { ...board, objects: [movedShape] };
  const propertyGuard = createBoardHistoryGuards([{ kind: "object.set", objectId: "shape-1", property: "geometry.x", value: 10 }], changedBoard);
  assert.equal(boardHistoryGuardsMatch(changedBoard, propertyGuard), true);
  assert.equal(boardHistoryGuardsMatch({ ...changedBoard, objects: [shape] }, propertyGuard), false);
  const missingProperty = createBoardHistoryGuards([{ kind: "object.set", objectId: "missing", property: "geometry.x", value: 0 }], board);
  assert.equal(boardHistoryGuardsMatch(board, missingProperty), true);
});

void test("forward history skips no-ops, truncates old undo actions and resets redo", () => {
  const initial = { undo: ["old"], redo: ["redo"] };
  assert.equal(appendForwardHistoryAction(initial, "noop", false, 2), initial);
  assert.deepEqual(appendForwardHistoryAction(initial, "new", true, 2), { undo: ["old", "new"], redo: [] });
  assert.deepEqual(appendForwardHistoryAction({ undo: ["one", "two"], redo: [] }, "three", true, 2), { undo: ["two", "three"], redo: [] });
});

void test("undo and redo require the latest target and bound their stacks", () => {
  const stacks = { undo: ["a", "b"], redo: [] };
  assert.throws(() => applyBoardHistoryTransition(stacks, "undo", "a", 2), /no longer the latest/);
  const undone = applyBoardHistoryTransition(stacks, "undo", "b", 2);
  assert.deepEqual(undone, { undo: ["a"], redo: ["b"] });
  assert.throws(() => applyBoardHistoryTransition(undone, "redo", "a", 2), /no longer the latest/);
  assert.deepEqual(applyBoardHistoryTransition(undone, "redo", "b", 2), { undo: ["a", "b"], redo: [] });
  assert.deepEqual(applyBoardHistoryTransition({ undo: ["a", "b"], redo: ["c", "d"] }, "undo", "b", 1), { undo: ["a"], redo: ["b"] });
});
