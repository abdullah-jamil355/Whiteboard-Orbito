import test from "node:test";
import assert from "node:assert/strict";
import { boardSnapshotSchema, createSessionSchema, endSessionSchema, realtimeClientMessageSchema } from "../sessions.validation.js";

const board = {
  id: "board-1", title: "Untitled", templateId: "blank",
  canvas: { gridStyle: "graph-paper", gridSpacing: 22 }, objects: []
};

void test("session creation accepts a blank board and title", () => {
  assert.equal(createSessionSchema.safeParse({ title: "Planning", board }).success, true);
});

void test("board snapshot rejects unknown executable objects and duplicate IDs", () => {
  assert.equal(boardSnapshotSchema.safeParse({ ...board, objects: [{ id: "x", type: "script", source: "alert(1)" }] }).success, false);
  const shape = { id: "same", type: "shape", shape: "circle", geometry: { x: 0, y: 0, width: 20, height: 20 }, style: { fill: "none", stroke: "#172033", lineWeight: "thin" } };
  assert.equal(boardSnapshotSchema.safeParse({ ...board, objects: [shape, shape] }).success, false);
});

void test("board snapshot accepts extended shape kinds, connectors with waypoints and routing", () => {
  const customShape = { id: "s-cloud", type: "shape", shape: "cloud", geometry: { x: 0, y: 0, width: 100, height: 60 }, style: { fill: "none", stroke: "#172033", lineWeight: "thin" } };
  const connector = {
    id: "c-1",
    type: "connector",
    start: { x: 50, y: 30, shapeId: "s-cloud", connectionPoint: "right" },
    end: { x: 200, y: 30 },
    color: "#000000",
    lineWeight: "medium",
    startArrow: "none",
    endArrow: "triangle",
    routing: "orthogonal",
    waypoints: [{ x: 100, y: 80 }]
  };
  assert.equal(boardSnapshotSchema.safeParse({ ...board, objects: [customShape, connector] }).success, true);
});

void test("session end accepts an optional nonnegative revision precondition only", () => {
  assert.equal(endSessionSchema.safeParse({}).success, true);
  assert.equal(endSessionSchema.safeParse({ expectedSequence: 8 }).success, true);
  assert.equal(endSessionSchema.safeParse({ expectedSequence: -1 }).success, false);
  assert.equal(endSessionSchema.safeParse({ expectedSequence: 8, force: true }).success, false);
});

void test("shared Undo and Redo messages require an opaque action ID and reject extra fields", () => {
  const actionId = "4b25c8c0-2c45-4f8f-a7ab-b36f2eb6a0ad";
  assert.equal(realtimeClientMessageSchema.safeParse({ type: "board:undo", actionId }).success, true);
  assert.equal(realtimeClientMessageSchema.safeParse({ type: "board:redo", actionId }).success, true);
  assert.equal(realtimeClientMessageSchema.safeParse({ type: "board:undo", actionId, targetActionId: "client-chosen" }).success, false);
  assert.equal(realtimeClientMessageSchema.safeParse({ type: "board:redo", actionId: "invalid" }).success, false);
});
