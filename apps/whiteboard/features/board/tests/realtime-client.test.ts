import assert from "node:assert/strict";
import test from "node:test";
import type { Board } from "@workspace/whiteboard";
import { applyLocalBoardChanges, diffBoardChanges } from "../realtime-client.js";

const board: Board = {
  id: "board-1",
  title: "Planning",
  templateId: "blank",
  canvas: { gridStyle: "graph-paper", gridSpacing: 22 },
  objects: [{
    id: "text-1",
    type: "text",
    geometry: { x: 20, y: 30, width: 60, height: 24 },
    text: "Hello",
    alignment: "left",
    fontSize: 16,
    bold: false,
    color: "#111111"
  }]
};

test("includes italic and underline changes in realtime board diffs", () => {
  const after: Board = {
    ...board,
    objects: board.objects.map((object) => object.type === "text"
      ? { ...object, italic: true, underline: true }
      : object)
  };

  const changes = diffBoardChanges(board, after);

  assert.deepEqual(changes, [
    { kind: "object.set", objectId: "text-1", property: "italic", value: true },
    { kind: "object.set", objectId: "text-1", property: "underline", value: true }
  ]);
  assert.deepEqual(applyLocalBoardChanges(board, changes), after);
});

test("includes sticky-note metadata when a shape is added", () => {
  const stickyNote: Board["objects"][number] = {
    id: "note-1",
    type: "shape",
    shape: "rectangle",
    geometry: { x: 10, y: 20, width: 120, height: 80 },
    style: { fill: "#ffff00", stroke: "#111111", lineWeight: "thin" },
    stickyNote: true
  };
  const after: Board = { ...board, objects: [...board.objects, stickyNote] };

  assert.deepEqual(diffBoardChanges(board, after), [{ kind: "object.add", object: stickyNote }]);
});
