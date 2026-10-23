import assert from "node:assert/strict";
import test from "node:test";
import { createStickyNoteObjects, STICKY_NOTE_FILL, STICKY_NOTE_HEIGHT, STICKY_NOTE_WIDTH } from "../src/board/sticky-notes.js";

void test("creates a centered, editable sticky note as a linked shape and text", () => {
  const [shape, text] = createStickyNoteObjects({ x: 240, y: 180 }, "note-shape", "note-text");

  assert.equal(shape.type, "shape");
  assert.equal(shape.shape, "rectangle");
  assert.deepEqual(shape.geometry, { x: 150, y: 110, width: STICKY_NOTE_WIDTH, height: STICKY_NOTE_HEIGHT });
  assert.equal(shape.style.fill, STICKY_NOTE_FILL);
  assert.equal(text.type, "text");
  assert.equal(text.parentShapeId, shape.id);
  assert.equal(text.color, "#000000");
  assert.ok(text.geometry.x > shape.geometry.x);
  assert.ok(text.geometry.y > shape.geometry.y);
});

void test("keeps note placement aligned to negative board coordinates", () => {
  const [shape] = createStickyNoteObjects({ x: -80, y: -40 }, "shape", "text");
  assert.deepEqual(shape.geometry, { x: -170, y: -110, width: STICKY_NOTE_WIDTH, height: STICKY_NOTE_HEIGHT });
});
