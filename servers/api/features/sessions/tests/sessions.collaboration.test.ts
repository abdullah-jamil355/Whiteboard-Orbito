import assert from "node:assert/strict";
import test from "node:test";
import { applyBoardChanges, diffBoardChanges } from "../sessions.collaboration.js";
import { boardEditCommandSchema } from "../sessions.validation.js";
import type { BoardSnapshot } from "../sessions.validation.js";
import { appendForwardHistoryAction, applyBoardHistoryTransition, boardHistoryGuardsMatch, createBoardHistoryGuards, type BoardHistoryStacks } from "../sessions.history.js";

const board: BoardSnapshot = {
  id: "board-1",
  title: "Planning",
  templateId: "blank",
  canvas: { gridStyle: "graph-paper", gridSpacing: 22 },
  objects: [
    { id: "shape-1", type: "shape", shape: "rectangle", geometry: { x: 10, y: 20, width: 100, height: 60 }, style: { fill: "none", stroke: "#111111", lineWeight: "thin" } },
    { id: "text-1", type: "text", geometry: { x: 20, y: 30, width: 60, height: 24 }, text: "Old", alignment: "left", fontSize: 16, bold: false, color: "#111111", parentShapeId: "shape-1" }
  ]
};

void test("board diff emits atomic property changes and applies them to the current board", () => {
  const local = { ...board, objects: board.objects.map((object) => object.id === "shape-1" && object.type === "shape" ? { ...object, geometry: { ...object.geometry, x: 50 } } : object) };
  const changes = diffBoardChanges(board, local);
  const remoteStyle = { ...board, objects: board.objects.map((object) => object.id === "shape-1" && object.type === "shape" ? { ...object, style: { ...object.style, stroke: "#ff0000" } } : object) };
  const merged = applyBoardChanges(remoteStyle, changes);
  const shape = merged.objects.find((object) => object.id === "shape-1");
  assert.ok(shape?.type === "shape");
  assert.equal(shape.geometry.x, 50);
  assert.equal(shape.style.stroke, "#ff0000");
});

void test("latest accepted write to the same object property wins", () => {
  const first = { ...board, objects: board.objects.map((object) => object.id === "text-1" && object.type === "text" ? { ...object, text: "First" } : object) };
  const second = { ...board, objects: board.objects.map((object) => object.id === "text-1" && object.type === "text" ? { ...object, text: "Second" } : object) };
  const current = applyBoardChanges(board, diffBoardChanges(board, first));
  const merged = applyBoardChanges(current, diffBoardChanges(board, second));
  const text = merged.objects.find((object) => object.id === "text-1");
  assert.ok(text?.type === "text");
  assert.equal(text.text, "Second");
});

void test("rejects changes that break board references or try to change the object type", () => {
  assert.throws(() => applyBoardChanges(board, [{ kind: "object.remove", objectId: "shape-1" }]));
  assert.equal(boardEditCommandSchema.safeParse({ actionId: "4b25c8c0-2c45-4f8f-a7ab-b36f2eb6a0ad", baseSequence: 0, changes: [{ kind: "object.set", objectId: "shape-1", property: "type", value: "text" }] }).success, false);
});

void test("preserves insertion order when a new object is inserted between existing objects", () => {
  const withThree = { ...board, objects: [...board.objects, { id: "shape-2", type: "shape" as const, shape: "circle" as const, geometry: { x: 180, y: 20, width: 60, height: 60 }, style: { fill: "none" as const, stroke: "#111111", lineWeight: "thin" as const } }] };
  const [first, second, third] = withThree.objects;
  assert.ok(first && second && third);
  const inserted = { ...withThree, objects: [first, third, second] };
  const changes = diffBoardChanges(withThree, inserted);
  assert.ok(changes.some((change) => change.kind === "objects.order"));
  assert.deepEqual(applyBoardChanges(withThree, changes).objects.map(({ id }) => id), inserted.objects.map(({ id }) => id));
});

void test("allows an empty in-progress board title and unbinds shape text safely", () => {
  const emptyTitle = applyBoardChanges(board, [{ kind: "board.title", value: "" }]);
  const unboundText = applyBoardChanges(emptyTitle, [{ kind: "object.set", objectId: "text-1", property: "parentShapeId", value: null }]);
  const text = unboundText.objects.find((object) => object.id === "text-1");
  assert.equal(unboundText.title, "");
  assert.ok(text?.type === "text");
  assert.equal("parentShapeId" in text, false);
});

void test("accepts and applies realtime text formatting changes", () => {
  const formatted = {
    ...board,
    objects: board.objects.map((object) => object.id === "text-1" && object.type === "text"
      ? { ...object, italic: true, underline: true }
      : object)
  };
  const changes = diffBoardChanges(board, formatted);
  const command = boardEditCommandSchema.safeParse({
    actionId: "4b25c8c0-2c45-4f8f-a7ab-b36f2eb6a0ad",
    baseSequence: 0,
    changes
  });

  assert.equal(command.success, true);
  assert.deepEqual(applyBoardChanges(board, changes), formatted);
});

void test("accepts sticky-note shapes and clears optional formatting fields", () => {
  const stickyNote = {
    id: "note-1",
    type: "shape" as const,
    shape: "rectangle" as const,
    geometry: { x: 10, y: 20, width: 120, height: 80 },
    style: { fill: "#ffff00", stroke: "#111111", lineWeight: "thin" as const },
    stickyNote: true
  };
  const withNote = applyBoardChanges(board, [{ kind: "object.add", object: stickyNote }]);
  const formatted = applyBoardChanges(board, [
    { kind: "object.set", objectId: "text-1", property: "italic", value: true },
    { kind: "object.set", objectId: "text-1", property: "underline", value: true }
  ]);
  const cleared = applyBoardChanges(formatted, [
    { kind: "object.set", objectId: "text-1", property: "italic", value: null },
    { kind: "object.set", objectId: "text-1", property: "underline", value: null }
  ]);

  assert.equal(withNote.objects.some((object) => object.id === stickyNote.id && object.type === "shape" && object.stickyNote), true);
  const text = cleared.objects.find((object) => object.id === "text-1");
  assert.ok(text?.type === "text");
  assert.equal("italic" in text, false);
  assert.equal("underline" in text, false);
});

void test("shared history guards allow unrelated edits and reject an overwritten inverse", () => {
  const forward: BoardSnapshot = { ...board, objects: board.objects.map((object) => object.id === "shape-1" && object.type === "shape" ? { ...object, geometry: { ...object.geometry, x: 50 } } : object) };
  const guards = createBoardHistoryGuards([{ kind: "object.set", objectId: "shape-1", property: "geometry.x", value: 50 }], forward);
  const unrelatedEdit = { ...forward, objects: forward.objects.map((object) => object.id === "shape-1" && object.type === "shape" ? { ...object, style: { ...object.style, stroke: "#ff0000" } } : object) };
  assert.equal(boardHistoryGuardsMatch(unrelatedEdit, guards), true);
  const overwritten = { ...unrelatedEdit, objects: unrelatedEdit.objects.map((object) => object.id === "shape-1" && object.type === "shape" ? { ...object, geometry: { ...object.geometry, x: 72 } } : object) };
  assert.equal(boardHistoryGuardsMatch(overwritten, guards), false);
});

void test("shared history moves undone actions to Redo and a new edit clears that branch", () => {
  let stacks: BoardHistoryStacks = { undo: [], redo: [] };
  stacks = appendForwardHistoryAction(stacks, "a", true, 500);
  stacks = appendForwardHistoryAction(stacks, "b", true, 500);
  stacks = applyBoardHistoryTransition(stacks, "undo", "b", 500);
  stacks = applyBoardHistoryTransition(stacks, "undo", "a", 500);
  stacks = applyBoardHistoryTransition(stacks, "redo", "a", 500);
  assert.deepEqual(stacks, { undo: ["a"], redo: ["b"] });
  assert.deepEqual(appendForwardHistoryAction(stacks, "c", true, 500), { undo: ["a", "c"], redo: [] });
  assert.deepEqual(appendForwardHistoryAction(stacks, "noop", false, 500), stacks);
});
