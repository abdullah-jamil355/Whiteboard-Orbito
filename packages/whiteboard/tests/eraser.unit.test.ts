import assert from "node:assert/strict";
import test from "node:test";
import { eraseBoardObjects } from "../src/board/eraser.js";
import { distanceToSegmentSquared, segmentsIntersect } from "../src/board/eraser.geometry.js";
import { splitStroke, strokeRemovalIntervals } from "../src/board/eraser.strokes.js";
import { arrow } from "../src/board/template-primitives.js";
import { shapeObject } from "./fixtures.js";

void test("measures segment distance and detects proper or touching intersections", () => {
  assert.equal(distanceToSegmentSquared({ x: 5, y: 3 }, { start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }), 9);
  assert.equal(segmentsIntersect({ start: { x: 0, y: 0 }, end: { x: 10, y: 10 } }, { start: { x: 0, y: 10 }, end: { x: 10, y: 0 } }), true);
  assert.equal(segmentsIntersect({ start: { x: 0, y: 0 }, end: { x: 10, y: 0 } }, { start: { x: 10, y: 0 }, end: { x: 12, y: 0 } }), true);
});

void test("splits a stroke around the erased portion and preserves untouched strokes", () => {
  const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
  const eraser = [{ start: { x: 50, y: -10 }, end: { x: 50, y: 10 } }];
  const intervals = strokeRemovalIntervals({ start: line[0]!, end: line[1]! }, eraser, 5);
  assert.ok(intervals.length === 1 && intervals[0]!.start > 0.4 && intervals[0]!.end < 0.6);
  const split = splitStroke(line, eraser, 5);
  assert.ok(split);
  assert.equal(split.length, 2);
  assert.ok(Math.abs((split[0]?.at(-1)?.x ?? 0) - 45) < 1e-5);
  assert.ok(Math.abs((split[1]?.[0]?.x ?? 0) - 55) < 1e-5);
  assert.equal(splitStroke(line, [{ start: { x: 50, y: 30 }, end: { x: 50, y: 40 } }], 2), null);
});

void test("erases shapes and their bound text, detaches surviving connectors, and records undo data", () => {
  const shape = shapeObject("box", 0, 0, 40, 40);
  const text = { id: "label", type: "text" as const, geometry: { x: 4, y: 4, width: 32, height: 20 }, text: "Box", alignment: "center" as const, fontSize: 16, bold: false, color: "#000000", parentShapeId: "box" };
  const edge = arrow("edge", { x: 40, y: 20, shapeId: "box", connectionPoint: "right" }, { x: 100, y: 20 });
  const erased = eraseBoardObjects([shape, text, edge], [{ x: 20, y: -10 }, { x: 20, y: 50 }], 2, () => "unused");
  assert.deepEqual(erased.objects, [{ ...edge, start: { x: 40, y: 20 } }]);
  assert.deepEqual([...(erased.edit?.affectedIds ?? [])].sort(), ["box", "edge", "label"]);
  assert.equal(erased.edit?.before.length, 3);
  assert.equal(erased.edit?.after.length, 1);
  assert.equal(eraseBoardObjects([shape], [], 2, () => "id").edit, null);
  assert.equal(eraseBoardObjects([shape], [{ x: 100, y: 100 }], 0, () => "id").edit, null);
});
