import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CanvasObjectRenderer } from "../src/board/components/canvas-object-renderer.js";
import { shapeObject } from "./fixtures.js";

void test("shape fill areas remain clickable when fill is disabled", () => {
  const shape = shapeObject("shape", 10, 20, 120, 80);
  const markup = renderToStaticMarkup(createElement(CanvasObjectRenderer, {
    object: { ...shape, style: { ...shape.style, fill: "none" } },
    shapes: [shape],
    selectedTool: "select",
    selectedShapeId: null,
    selectedTextId: null,
    editingTextId: null,
    resizeGeometry: null,
    textPreviewGeometry: null,
    hoveredShapeId: null,
    onFocusObject: () => undefined,
    onObjectPointerDown: () => undefined,
    onShapePointerDown: () => undefined,
    onTextPointerDown: () => undefined,
    onTextSelect: () => undefined,
    onTextEditStart: () => undefined,
    onTextEditFinish: () => undefined,
    onTextChange: () => undefined,
    onHoverShape: () => undefined,
    onQuickConnectorCommit: () => undefined,
    onQuickConnectorStart: () => undefined
  }));

  assert.match(markup, /pointer-events="all"/);
});
