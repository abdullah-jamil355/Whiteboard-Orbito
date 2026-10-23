import assert from "node:assert/strict";
import test from "node:test";
import { createBoard } from "../src/board/board.js";
import { getBoardFilename, serializeBoardXml } from "../src/board/xml.js";
import { MAX_WHITEBOARD_XML_BYTES, parseBoardXml } from "../src/board/xml.validation.js";
import { label, arrow } from "../src/board/template-primitives.js";
import { shapeObject } from "./fixtures.js";

void test("serializes board objects as escaped, stable Whiteboard XML", () => {
  const board = {
    ...createBoard("board&1"), title: `Roadmap <Q4> "draft"`,
    objects: [shapeObject("box", 10, 20, 100, 50), label("text", "A & B", 20, 30, 60, 20), arrow("edge", { x: 0, y: 0 }, { x: 20, y: 30 })]
  };
  const xml = serializeBoardXml(board);
  assert.match(xml, /id="board&amp;1"/);
  assert.match(xml, /Roadmap &lt;Q4&gt; &quot;draft&quot;/);
  assert.match(xml, /A &amp; B/);
  assert.match(xml, /<shape id="box" kind="rectangle"/);
  assert.match(xml, /<arrow id="edge"/);
});

void test("rejects unsupported XML characters, non-finite geometry and invalid colors", () => {
  assert.throws(() => serializeBoardXml({ ...createBoard("b"), title: "bad\u0001" }), /XML 1\.0/);
  assert.throws(() => serializeBoardXml({ ...createBoard("b"), objects: [shapeObject("x", Number.NaN, 0, 1, 1)] }), /finite numbers/);
  assert.throws(() => serializeBoardXml({ ...createBoard("b"), objects: [{ ...shapeObject("x", 0, 0, 1, 1), style: { fill: "#fff", stroke: "#000000", lineWeight: "thin" } }] }), /six-digit hexadecimal/);
  assert.throws(() => serializeBoardXml({ ...createBoard("b"), objects: [arrow("edge", { x: 0, y: 0, shapeId: "shape" }, { x: 1, y: 1 })] }), /need a shape ID and connection point/);
});

void test("creates safe native Whiteboard download filenames", () => {
  assert.equal(getBoardFilename("Untitled"), "Untitled Diagram.Whiteboard");
  assert.equal(getBoardFilename("  Team / Plan  "), "Team - Plan.Whiteboard");
  assert.equal(getBoardFilename("   "), "Untitled Diagram.Whiteboard");
  assert.ok(getBoardFilename("x".repeat(100)).length <= 91);
});

void test("rejects unsafe, oversized and unavailable-parser XML before parsing", () => {
  assert.deepEqual(parseBoardXml("<!DOCTYPE x><whiteboard />"), {
    ok: false, error: "This file contains a forbidden XML declaration."
  });
  assert.deepEqual(parseBoardXml("<?xml-stylesheet href='evil' ?><whiteboard />"), {
    ok: false, error: "This file contains an unsupported XML processing instruction."
  });
  assert.deepEqual(parseBoardXml("x".repeat(MAX_WHITEBOARD_XML_BYTES + 1)), {
    ok: false, error: "This Whiteboard XML file is too large to open."
  });
  if (typeof DOMParser === "undefined") {
    assert.deepEqual(parseBoardXml("<whiteboard />"), {
      ok: false, error: "XML projects can only be opened in the browser."
    });
  }
});
