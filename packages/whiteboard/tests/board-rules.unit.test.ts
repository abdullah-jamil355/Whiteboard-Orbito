import assert from "node:assert/strict";
import test from "node:test";
import { isWhiteboardPaletteColor, shapeConnectionCoordinate, snapConnectorEndpoint, connectorRoutePoints } from "../src/board/board.js";
import { shapeObject } from "./fixtures.js";

const acceptedColors = [
  "#000000", "#ffffff", "#315f8b", "#bf4b4b", "#4f7a53", "#a56b1f", "#168c8c", "#7653a6",
  "#ABCDEF", "#abcdef", "#000001", "#fffffe", "#123456", "#987654", "#00ff00", "#ff00ff"
];
for (const color of acceptedColors) {
  void test(`accepts six-digit hex palette value ${color}`, () => assert.equal(isWhiteboardPaletteColor(color), true));
}

const rejectedColors = [
  "", "black", "#000", "#fff", "#12345", "#1234567", "000000", "##123456", "#12gh56", "# 12345",
  " #000000", "#000000 ", "transparent", "currentColor", "rgb(0,0,0)", "#１２３４５６"
];
for (const color of rejectedColors) {
  void test(`rejects unsupported palette value ${JSON.stringify(color)}`, () => assert.equal(isWhiteboardPaletteColor(color), false));
}

const standardShape = shapeObject("shape", 10, 20, 100, 80);
const connectionCases = [
  ["top", { x: 60, y: 20 }], ["right", { x: 110, y: 60 }], ["bottom", { x: 60, y: 100 }],
  ["left", { x: 10, y: 60 }], ["center", { x: 60, y: 60 }]
] as const;
for (const [point, expected] of connectionCases) {
  void test(`computes the ${point} connection point`, () => assert.deepEqual(shapeConnectionCoordinate(standardShape.geometry, point), expected));
}

const snappingCases = [
  ["top", { x: 60, y: 20 }, { x: 60, y: -10 }], ["right", { x: 110, y: 60 }, { x: 160, y: 60 }],
  ["bottom", { x: 60, y: 100 }, { x: 60, y: 160 }], ["left", { x: 10, y: 60 }, { x: -10, y: 60 }]
] as const;
for (const [direction, expected, toward] of snappingCases) {
  void test(`snaps an inside pointer toward the ${direction} edge`, () => {
    assert.deepEqual(snapConnectorEndpoint({ x: 60, y: 60 }, [standardShape], 24, toward), {
      ...expected, shapeId: "shape", connectionPoint: direction
    });
  });
}

const routeCases = [
  ["right", "left", [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }]],
  ["left", "right", [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 100 }]],
  ["top", "bottom", [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }]],
  ["bottom", "top", [{ x: 0, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 100, y: 100 }]]
] as const;
for (const [startDirection, endDirection, expected] of routeCases) {
  void test(`routes ${startDirection} to ${endDirection} with an orthogonal path`, () => {
    const points = connectorRoutePoints(
      { x: 0, y: 0, connectionPoint: startDirection },
      { x: 100, y: 100, connectionPoint: endDirection }
    );
    assert.deepEqual(points.map(({ x, y }) => ({ x, y })), expected);
  });
}

void test("snaps to a circular perimeter only when the point falls inside the circle", () => {
  const circle = shapeObject("circle", 0, 0, 100, 100, "circle");
  assert.deepEqual(snapConnectorEndpoint({ x: 50, y: 50 }, [circle], 24, { x: 90, y: 50 }), {
    x: 100, y: 50, shapeId: "circle", connectionPoint: "right"
  });
  assert.deepEqual(snapConnectorEndpoint({ x: 100, y: 50 }, [circle], 24), {
    x: 100, y: 50, shapeId: "circle", connectionPoint: "right"
  });
});

void test("snaps to a diamond edge using its normalized perimeter", () => {
  const diamond = shapeObject("diamond", 0, 0, 100, 100, "diamond");
  assert.deepEqual(snapConnectorEndpoint({ x: 50, y: 50 }, [diamond], 24, { x: 90, y: 50 }), {
    x: 100, y: 50, shapeId: "diamond", connectionPoint: "right"
  });
});

void test("computes exact slanted border connection points for parallelogram and touches shape", () => {
  const geometry = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(shapeConnectionCoordinate(geometry, "right", "parallelogram"), { x: 89, y: 50 });
  assert.deepEqual(shapeConnectionCoordinate(geometry, "left", "parallelogram"), { x: 11, y: 50 });
  assert.deepEqual(shapeConnectionCoordinate(geometry, "top", "parallelogram"), { x: 61, y: 0 });
  assert.deepEqual(shapeConnectionCoordinate(geometry, "bottom", "parallelogram"), { x: 39, y: 100 });
});

void test("computes exact perimeter connection points for pentagon with zero gap", () => {
  const geometry = { x: 0, y: 0, width: 100, height: 100 };
  assert.deepEqual(shapeConnectionCoordinate(geometry, "top", "pentagon"), { x: 50, y: 0 });
  assert.deepEqual(shapeConnectionCoordinate(geometry, "right", "pentagon"), { x: 92.5, y: 50 });
  assert.deepEqual(shapeConnectionCoordinate(geometry, "bottom", "pentagon"), { x: 50, y: 90.5 });
  assert.deepEqual(shapeConnectionCoordinate(geometry, "left", "pentagon"), { x: 7.5, y: 50 });
});

