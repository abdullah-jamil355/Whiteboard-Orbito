import assert from "node:assert/strict";
import test from "node:test";
import { createBoard } from "../src/board/board.js";
import { label } from "../src/board/template-primitives.js";
import { shapeObject } from "./fixtures.js";
import { getRequiredCanvasBounds, fitCanvasBounds, geometryForShape, shapeGeometryFromDrag, resizedGeometry, movedGeometry, movedBeyondThreshold, selectionForPointer, getDirectionalTarget, arrowHeadPoints, isLinearTool } from "../src/board/components/canvas-geometry.js";
import { renderCanvasColor, MIN_CANVAS_ZOOM, MAX_CANVAS_ZOOM } from "../src/board/components/canvas-model.js";
import { createCanvasZoomHandler } from "../src/board/components/canvas-camera.js";

void test("fits unbounded canvas to viewport aspect ratio and includes board content", () => {
  assert.deepEqual(fitCanvasBounds({ width: 1000, height: 500 }, { width: 1500, height: 600 }), { width: 1500, height: 750 });
  assert.deepEqual(fitCanvasBounds({ width: 0, height: 0 }, { width: 1000, height: 600 }), { width: 1000, height: 1000 / 1.5 });
  const board = { ...createBoard("b"), objects: [shapeObject("shape", -10, 20, 300, 120), label("label", "x", 400, 500)] };
  assert.deepEqual(getRequiredCanvasBounds(board.objects), { width: 1200, height: 800 });
  assert.deepEqual(getRequiredCanvasBounds([shapeObject("shape", 0, 0, 1500, 900)]), { width: 1500, height: 900 });
});

void test("creates default and drag geometry for shapes, including reversed drags and circles", () => {
  assert.deepEqual(shapeGeometryFromDrag("rectangle", { x: 100, y: 100 }, { x: 100, y: 100 }, { width: 100, height: 100 }), {
    x: 36, y: 56, width: 128, height: 88
  });
  assert.deepEqual(shapeGeometryFromDrag("rectangle", { x: 100, y: 100 }, { x: 50, y: 40 }, { width: 100, height: 100 }), {
    x: 50, y: 40, width: 50, height: 60
  });
  assert.deepEqual(shapeGeometryFromDrag("circle", { x: 100, y: 100 }, { x: 160, y: 120 }, { width: 100, height: 100 }), {
    x: 100, y: 100, width: 60, height: 60
  });
  assert.deepEqual(geometryForShape(shapeObject("circle", 0, 0, 100, 50, "circle"), { x: 0, y: 0, width: 100, height: 50 }), {
    x: 25, y: 0, width: 50, height: 50
  });
});

void test("resizes around the fixed anchor and applies a move threshold", () => {
  const box = shapeObject("shape", 10, 20, 100, 80);
  assert.deepEqual(resizedGeometry(box, "north-west", { x: 10, y: 20 }, { x: 0, y: 5 }, { width: 500, height: 500 }), {
    x: 0, y: 5, width: 110, height: 95
  });
  assert.deepEqual(movedGeometry(box.geometry, { x: 3, y: 4 }, { x: 9, y: 14 }, { width: 500, height: 500 }), {
    x: 16, y: 30, width: 100, height: 80
  });
  assert.equal(movedBeyondThreshold({ x: 0, y: 0 }, { x: 2, y: 2 }), false);
  assert.equal(movedBeyondThreshold({ x: 0, y: 0 }, { x: 4, y: 0 }), true);
});

void test("updates additive selection, directional connectors and arrow geometry", () => {
  assert.deepEqual(selectionForPointer(["a"], "b", true), ["a", "b"]);
  assert.deepEqual(selectionForPointer(["a", "b"], "a", true), ["b"]);
  assert.deepEqual(selectionForPointer(["a"], "b", false), ["b"]);
  const source = shapeObject("source", 0, 0, 100, 80);
  const target = shapeObject("target", 200, 20, 100, 80);
  assert.deepEqual(getDirectionalTarget(source, [source, target], "right"), {
    x: 200, y: 60, shapeId: "target", connectionPoint: "left"
  });
  assert.equal(getDirectionalTarget(source, [source], "right"), null);
  assert.equal(arrowHeadPoints({ x: 0, y: 0 }, { x: 100, y: 0 }).split(" ").length, 3);
  assert.equal(isLinearTool("connector"), true);
  assert.equal(isLinearTool("circle"), false);
});

void test("adapts default black or white ink to the fill and leaves chosen colors alone", () => {
  assert.equal(renderCanvasColor("#000000", "#ffffff"), "#000000");
  assert.equal(renderCanvasColor("#ffffff", "#172033"), "#ffffff");
  assert.equal(renderCanvasColor("#315f8b", "#ffffff"), "#315f8b");
  assert.equal(renderCanvasColor("#000000"), "var(--wb-default-ink, #ffffff)");
});

void test("zooms around viewport center and clamps at supported limits", () => {
  const bounds = { width: 800, height: 600 };
  let camera = { x: 100, y: 50, zoom: 1 };
  const update = (next: typeof camera | ((current: typeof camera) => typeof camera)): void => {
    camera = typeof next === "function" ? next(camera) : next;
  };
  const zoom = createCanvasZoomHandler(bounds, update);
  zoom(2);
  assert.deepEqual(camera, { x: 300, y: 200, zoom: 2 });
  zoom(100);
  assert.equal(camera.zoom, MAX_CANVAS_ZOOM);
  zoom(0.001);
  assert.equal(camera.zoom, MIN_CANVAS_ZOOM);
});
