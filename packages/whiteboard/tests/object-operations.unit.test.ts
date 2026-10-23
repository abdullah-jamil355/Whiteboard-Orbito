import assert from "node:assert/strict";
import test from "node:test";
import { createBoard, type BoardObject } from "../src/board/board.js";
import {
  cloneBoardObjects, getObjectBounds, getObjectIdsWithDependents, moveBoardObjects,
  removeBoardObjects, reorderBoardObjects, resizeBoardObject, selectObjectsInBox
} from "../src/board/object-operations.js";
import { arrow, label } from "../src/board/template-primitives.js";
import { shapeObject } from "./fixtures.js";

const objects: readonly BoardObject[] = [
  shapeObject("shape-a", 10, 10, 100, 60),
  label("label-a", "A", 20, 20, 40, 20, "shape-a"),
  shapeObject("shape-b", 200, 10, 100, 60),
  arrow("edge", { x: 110, y: 40, shapeId: "shape-a", connectionPoint: "right" }, { x: 200, y: 40, shapeId: "shape-b", connectionPoint: "left" }),
  { id: "stroke", type: "stroke", points: [{ x: 20, y: 100 }, { x: 40, y: 120 }], color: "#000000", lineWeight: "thin" }
];

void test("computes bounds and selects only fully enclosed objects", () => {
  assert.deepEqual(getObjectBounds(objects[0]!), { left: 10, top: 10, right: 110, bottom: 70 });
  assert.deepEqual(getObjectBounds(objects[4]!), { left: 20, top: 100, right: 40, bottom: 120 });
  assert.deepEqual(selectObjectsInBox(objects, { x: 0, y: 0 }, { x: 120, y: 80 }), ["shape-a", "label-a"]);
  assert.deepEqual(selectObjectsInBox(objects, { x: 120, y: 0 }, { x: 0, y: 80 }), ["shape-a", "label-a"]);
});

void test("moves selected shapes with bound text and keeps attached connectors joined", () => {
  const board = { ...createBoard("b"), objects };
  const moved = moveBoardObjects(board, ["shape-a"], 15, 25);
  assert.deepEqual(moved.objects[0]?.type === "shape" ? moved.objects[0].geometry : null,
    { x: 25, y: 35, width: 100, height: 60 });
  assert.deepEqual(moved.objects[1]?.type === "text" ? moved.objects[1].geometry : null,
    { x: 35, y: 45, width: 40, height: 20 });
  assert.deepEqual(moved.objects[3]?.type === "arrow" ? moved.objects[3].start : null,
    { x: 125, y: 65, shapeId: "shape-a", connectionPoint: "right" });
});

void test("clones selected objects and remaps cloned shape references", () => {
  let nextId = 0;
  const copies = cloneBoardObjects(objects, ["shape-a", "label-a", "edge"], () => `copy-${++nextId}`, 8);
  assert.deepEqual(copies.map(({ id }) => id), ["copy-1", "copy-2", "copy-3"]);
  assert.equal(copies[1]?.type === "text" ? copies[1].parentShapeId : undefined, "copy-1");
  assert.deepEqual(copies[2]?.type === "arrow" ? copies[2].start : null,
    { x: 110, y: 40, shapeId: "copy-1", connectionPoint: "right" });
  assert.deepEqual(copies[2]?.type === "arrow" ? copies[2].end : null, { x: 208, y: 48 });
});

void test("finds dependents, removes objects and detaches remaining connectors", () => {
  const ids = getObjectIdsWithDependents(objects, ["shape-a"]);
  assert.deepEqual([...ids].sort(), ["label-a", "shape-a"]);
  const removed = removeBoardObjects({ ...createBoard("b"), objects }, new Set(["shape-a", "label-a"]));
  assert.equal(removed.objects.some(({ id }) => id === "shape-a" || id === "label-a"), false);
  const detached = removed.objects.find((object) => object.id === "edge");
  assert.ok(detached?.type === "arrow");
  assert.deepEqual(detached.start, { x: 110, y: 40 });
});

void test("resizes non-shape geometry and reorders selected objects as a group", () => {
  const board = { ...createBoard("b"), objects };
  const resized = resizeBoardObject(board, "stroke", { left: 0, top: 0, right: 40, bottom: 40 });
  assert.deepEqual(resized.objects.find(({ id }) => id === "stroke"), {
    id: "stroke", type: "stroke", points: [{ x: 0, y: 0 }, { x: 40, y: 40 }], color: "#000000", lineWeight: "thin"
  });
  assert.deepEqual(reorderBoardObjects(board, ["shape-a", "label-a"], "front").objects.map(({ id }) => id), ["shape-b", "edge", "stroke", "shape-a", "label-a"]);
});
