import assert from "node:assert/strict";
import test from "node:test";
import {
  createBoard,
  isLineWeight,
  renameBoard,
  shapeConnectionCoordinate,
  snapConnectorEndpoint,
  connectorRoutePoints,
  updateShapeAndBoundTextGeometry,
  type ShapeObject,
  type TextObject
} from "../src/board/board.js";

const shape = (id: string, x: number, y: number): ShapeObject => ({
  id, type: "shape", shape: "rectangle", geometry: { x, y, width: 100, height: 80 },
  style: { fill: "#ffffff", stroke: "#000000", lineWeight: "thin" }
});

void test("creates and renames immutable boards", () => {
  const board = createBoard("board-1");
  assert.equal(board.title, "Untitled");
  assert.equal(board.templateId, "blank");
  assert.deepEqual(board.objects, []);
  const renamed = renameBoard(board, "Roadmap");
  assert.equal(renamed.title, "Roadmap");
  assert.equal(board.title, "Untitled");
});

void test("recognizes supported line weights", () => {
  assert.equal(isLineWeight("thin"), true);
  assert.equal(isLineWeight("medium"), true);
  assert.equal(isLineWeight("thick"), true);
  assert.equal(isLineWeight("bold"), false);
});

void test("calculates connection coordinates and snaps to the nearest shape edge", () => {
  const first = shape("a", 10, 20);
  const second = shape("b", 250, 20);
  assert.deepEqual(shapeConnectionCoordinate(first.geometry, "center"), { x: 60, y: 60 });
  assert.deepEqual(shapeConnectionCoordinate(first.geometry, "right"), { x: 110, y: 60 });
  assert.deepEqual(snapConnectorEndpoint({ x: 112, y: 60 }, [first]), {
    x: 110, y: 60, shapeId: "a", connectionPoint: "right"
  });
  assert.deepEqual(snapConnectorEndpoint({ x: 160, y: 60 }, [first]), { x: 160, y: 60 });
  assert.deepEqual(snapConnectorEndpoint({ x: 120, y: 60 }, [first, second], 24, { x: 200, y: 60 }), {
    x: 110, y: 60, shapeId: "a", connectionPoint: "right"
  });
});

void test("routes attached connectors according to connection orientation", () => {
  assert.deepEqual(connectorRoutePoints(
    { x: 100, y: 20, connectionPoint: "right" },
    { x: 200, y: 100, connectionPoint: "left" }
  ), [{ x: 100, y: 20, connectionPoint: "right" }, { x: 150, y: 20 }, { x: 150, y: 100 }, { x: 200, y: 100, connectionPoint: "left" }]);
  assert.deepEqual(connectorRoutePoints({ x: 0, y: 0 }, { x: 10, y: 20 }), [{ x: 0, y: 0 }, { x: 0, y: 20 }, { x: 10, y: 20 }]);
});

void test("supports straight, elbow and curved connector routes", () => {
  const start = { x: 10, y: 20, connectionPoint: "right" as const };
  const end = { x: 160, y: 120, connectionPoint: "left" as const };
  assert.deepEqual(connectorRoutePoints(start, end, "straight"), [start, end]);
  assert.ok(connectorRoutePoints(start, end, "orthogonal").length >= 3);
  const curved = connectorRoutePoints(start, end, "curved");
  assert.equal(curved.length, 17);
  assert.deepEqual({ x: curved[0]?.x, y: curved[0]?.y }, { x: start.x, y: start.y });
  assert.deepEqual({ x: curved.at(-1)?.x, y: curved.at(-1)?.y }, { x: end.x, y: end.y });
});

void test("resizing a shape moves attached text and connector endpoints", () => {
  const board = createBoard("board-1");
  const object = shape("box", 10, 20);
  const label: TextObject = {
    id: "label", type: "text", geometry: { x: 20, y: 30, width: 50, height: 20 },
    text: "Hello", alignment: "center", fontSize: 16, bold: false, color: "#000000", parentShapeId: "box"
  };
  const connector = {
    id: "edge", type: "connector" as const,
    start: { x: 110, y: 60, shapeId: "box", connectionPoint: "right" as const },
    end: { x: 250, y: 60, shapeId: "other", connectionPoint: "left" as const },
    color: "#000000", lineWeight: "thin" as const
  };
  const resized = updateShapeAndBoundTextGeometry({ ...board, objects: [object, label, connector] }, "box", {
    x: 10, y: 20, width: 200, height: 160
  });
  assert.deepEqual(resized.objects[0]?.type === "shape" ? resized.objects[0].geometry : null,
    { x: 10, y: 20, width: 200, height: 160 });
  assert.deepEqual(resized.objects[1]?.type === "text" ? resized.objects[1].geometry : null,
    { x: 30, y: 40, width: 100, height: 40 });
  assert.deepEqual(resized.objects[2]?.type === "connector" ? resized.objects[2].start : null,
    { x: 210, y: 100, shapeId: "box", connectionPoint: "right" });
  assert.equal(updateShapeAndBoundTextGeometry(board, "missing", object.geometry), board);
});
