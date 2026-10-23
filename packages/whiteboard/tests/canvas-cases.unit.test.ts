import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasLineGraphic } from "../src/board/components/canvas-line-graphic.js";
import { createBoard } from "../src/board/board.js";
import { fitCanvasBounds, getRequiredCanvasBounds, movedBeyondThreshold, resizedGeometry, selectionForPointer, shapeGeometryFromDrag } from "../src/board/components/canvas-geometry.js";
import { renderCanvasColor } from "../src/board/components/canvas-model.js";
import { shapeObject } from "./fixtures.js";

const rectangleDrags = [
  ["east-south", { x: 10, y: 20 }, { x: 70, y: 80 }, { x: 10, y: 20, width: 60, height: 60 }],
  ["west-south", { x: 70, y: 20 }, { x: 10, y: 80 }, { x: 10, y: 20, width: 60, height: 60 }],
  ["east-north", { x: 10, y: 80 }, { x: 70, y: 20 }, { x: 10, y: 20, width: 60, height: 60 }],
  ["west-north", { x: 70, y: 80 }, { x: 10, y: 20 }, { x: 10, y: 20, width: 60, height: 60 }],
  ["short-width", { x: 20, y: 20 }, { x: 30, y: 80 }, { x: 20, y: 20, width: 24, height: 60 }],
  ["short-height", { x: 20, y: 20 }, { x: 80, y: 30 }, { x: 20, y: 20, width: 60, height: 24 }]
] as const;
for (const [name, start, end, expected] of rectangleDrags) {
  void test(`creates rectangle geometry for ${name} pointer drag`, () => {
    assert.deepEqual(shapeGeometryFromDrag("rectangle", start, end, { width: 800, height: 600 }), expected);
  });
}

const circleDrags = [
  ["wide", { x: 0, y: 0 }, { x: 90, y: 40 }, { x: 0, y: 0, width: 90, height: 90 }],
  ["tall", { x: 10, y: 20 }, { x: 40, y: 100 }, { x: 10, y: 20, width: 80, height: 80 }],
  ["reverse-x", { x: 100, y: 20 }, { x: 30, y: 60 }, { x: 30, y: 20, width: 70, height: 70 }],
  ["reverse-y", { x: 20, y: 100 }, { x: 50, y: 40 }, { x: 20, y: 40, width: 60, height: 60 }]
] as const;
for (const [name, start, end, expected] of circleDrags) {
  void test(`creates a square circle from ${name} drag`, () => {
    assert.deepEqual(shapeGeometryFromDrag("circle", start, end, { width: 500, height: 500 }), expected);
  });
}

const resizeHandles = [
  ["north-west", { x: 0, y: 10, width: 110, height: 90 }],
  ["north-east", { x: 10, y: 10, width: 220, height: 90 }],
  ["south-west", { x: 0, y: 20, width: 110, height: 180 }],
  ["south-east", { x: 10, y: 20, width: 220, height: 180 }]
] as const;
for (const [handle, expected] of resizeHandles) {
  void test(`resizes shape from ${handle} handle while preserving opposite anchor`, () => {
    const shape = shapeObject("s", 10, 20, 100, 80);
    const current = handle === "north-west" ? { x: 0, y: 10 }
      : handle === "north-east" ? { x: 130, y: 10 }
        : handle === "south-west" ? { x: 0, y: 120 } : { x: 130, y: 120 };
    assert.deepEqual(resizedGeometry(shape, handle, { x: 10, y: 20 }, current, { width: 100, height: 100 }), expected);
  });
}

const thresholdCases = [
  ["zero movement", 0, 0, false], ["small horizontal movement", 3, 0, false],
  ["small vertical movement", 0, 3, false], ["threshold horizontal", 4, 0, true],
  ["threshold vertical", 0, 4, true], ["diagonal movement", 3, 3, true]
] as const;
for (const [name, x, y, expected] of thresholdCases) {
  void test(`evaluates move threshold for ${name}`, () => assert.equal(movedBeyondThreshold({ x: 0, y: 0 }, { x, y }), expected));
}

const selectionCases = [
  ["add item", ["a"], "b", true, ["a", "b"]],
  ["remove selected item", ["a", "b"], "a", true, ["b"]],
  ["retain existing selection", ["a"], "a", false, ["a"]],
  ["replace selection", ["a", "b"], "c", false, ["c"]],
  ["select from empty", [], "x", true, ["x"]]
] as const;
for (const [name, selected, id, additive, expected] of selectionCases) {
  void test(`selection toggle ${name}`, () => assert.deepEqual(selectionForPointer(selected, id, additive), expected));
}

const fitCases = [
  ["wide viewport", { width: 1200, height: 600 }, { width: 1000, height: 500 }, { width: 1000, height: 500 }],
  ["portrait viewport", { width: 600, height: 900 }, { width: 1000, height: 500 }, { width: 1000, height: 1500 }],
  ["content taller than viewport", { width: 1000, height: 500 }, { width: 500, height: 700 }, { width: 1400, height: 700 }],
  ["empty viewport fallback", { width: 0, height: 0 }, { width: 900, height: 600 }, { width: 900, height: 600 }]
] as const;
for (const [name, viewport, required, expected] of fitCases) {
  void test(`fits canvas for ${name}`, () => assert.deepEqual(fitCanvasBounds(viewport, required), expected));
}

const colorCases = [
  ["black on white", "#000000", "#ffffff", "#000000"], ["white on dark navy", "#ffffff", "#172033", "#ffffff"],
  ["black on dark navy", "#000000", "#172033", "#ffffff"], ["white on white", "#ffffff", "#ffffff", "#000000"],
  ["black on transparent", "#000000", "none", "var(--wb-default-ink, #ffffff)"],
  ["selected blue remains blue", "#315f8b", "#ffffff", "#315f8b"],
  ["selected red remains red", "#bf4b4b", "#172033", "#bf4b4b"],
  ["selected green remains green", "#4f7a53", "#ffffff", "#4f7a53"],
  ["selected amber remains amber", "#a56b1f", "#172033", "#a56b1f"],
  ["selected violet remains violet", "#7653a6", "#ffffff", "#7653a6"]
] as const;
for (const [name, ink, background, expected] of colorCases) {
  void test(`renders ${name}`, () => assert.equal(renderCanvasColor(ink, background), expected));
}

const requiredBounds = [
  ["rectangle", [shapeObject("r", 5, 10, 120, 90)], { width: 1200, height: 800 }],
  ["negative shape positions", [shapeObject("r", -20, -40, 200, 100)], { width: 1200, height: 800 }],
  ["content extending right and down", [shapeObject("r", 1300, 850, 300, 200)], { width: 1600, height: 1050 }],
  ["blank board minimum", createBoard("b").objects, { width: 1200, height: 800 }]
] as const;
for (const [name, objects, expected] of requiredBounds) {
  void test(`calculates required canvas bounds for ${name}`, () => assert.deepEqual(getRequiredCanvasBounds(objects), expected));
}

void test("renders connector line as polyline with arrowheads", () => {
  const markup = renderToStaticMarkup(createElement(CanvasLineGraphic, {
    start: { x: 100, y: 50, connectionPoint: "right" },
    end: { x: 300, y: 50, connectionPoint: "left" },
    color: "#ffffff",
    lineWeight: "medium",
    routing: "orthogonal",
    startArrow: "none",
    endArrow: "block"
  }));
  assert.match(markup, /<polyline points="[^"]+"/);
  assert.match(markup, /<path d="M 300 50/);
});

