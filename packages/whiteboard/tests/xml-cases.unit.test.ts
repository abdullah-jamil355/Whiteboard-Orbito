import assert from "node:assert/strict";
import test from "node:test";
import { createBoard } from "../src/board/board.js";
import { getBoardFilename, serializeBoardXml } from "../src/board/xml.js";
import { MAX_WHITEBOARD_XML_BYTES, parseBoardXml } from "../src/board/xml.validation.js";
import { label } from "../src/board/template-primitives.js";
import { shapeObject } from "./fixtures.js";

const filenames = [
  ["plain board", "Planning", "Planning.Whiteboard"],
  ["whitespace", "  Planning  ", "Planning.Whiteboard"],
  ["blank title", "", "Untitled Diagram.Whiteboard"],
  ["only whitespace", "   ", "Untitled Diagram.Whiteboard"],
  ["untitled default", "Untitled", "Untitled Diagram.Whiteboard"],
  ["case-insensitive untitled", "uNtItLeD", "Untitled Diagram.Whiteboard"],
  ["slash character", "Roadmap/2026", "Roadmap-2026.Whiteboard"],
  ["reserved punctuation", "A:B*C?D", "A-B-C-D.Whiteboard"],
  ["line break", "Team\nBoard", "Team-Board.Whiteboard"],
  ["title length cap", "x".repeat(100), `${"x".repeat(80)}.Whiteboard`]
] as const;
for (const [name, title, expected] of filenames) {
  void test(`builds safe filename for ${name}`, () => assert.equal(getBoardFilename(title), expected));
}

const xmlTitles = [
  ["ampersand", "A & B", "A &amp; B"], ["less-than", "A < B", "A &lt; B"],
  ["greater-than", "A > B", "A &gt; B"], ["double quote", `A " B`, "A &quot; B"],
  ["apostrophe", "A ' B", "A &apos; B"]
] as const;
for (const [name, title, escaped] of xmlTitles) {
  void test(`escapes ${name} in XML title`, () => assert.ok(serializeBoardXml({ ...createBoard("board"), title }).includes(escaped)));
}

const invalidXmlCharacters = ["\u0000", "\u0001", "\u0008", "\u000b", "\u000c", "\u000e", "\u001f"];
for (const character of invalidXmlCharacters) {
  void test(`rejects XML 1.0 control character U+${character.charCodeAt(0).toString(16).padStart(4, "0")}`, () => {
    assert.throws(() => serializeBoardXml({ ...createBoard("board"), title: `bad${character}value` }), /XML 1\.0/);
  });
}

const hostileXml = [
  ["uppercase doctype", "<!DOCTYPE root><whiteboard />"],
  ["lowercase doctype", "<!doctype root><whiteboard />"],
  ["external entity declaration", "<!ENTITY x SYSTEM 'file:///c:/secret'><whiteboard />"],
  ["internal entity declaration", "<!ENTITY x 'value'><whiteboard />"]
] as const;
for (const [name, xml] of hostileXml) {
  void test(`blocks ${name}`, () => assert.equal(parseBoardXml(xml).ok, false));
}

const unsupportedInstructions = [
  "<?xml-stylesheet href='style.css'?>",
  "<?php echo 'unsafe'; ?>",
  "<?custom data?>"
];
for (const instruction of unsupportedInstructions) {
  void test(`blocks unsupported XML processing instruction ${instruction.slice(0, 12)}`, () => {
    assert.deepEqual(parseBoardXml(`${instruction}<whiteboard />`), {
      ok: false, error: "This file contains an unsupported XML processing instruction."
    });
  });
}

void test("enforces the XML size ceiling at the boundary", () => {
  assert.equal(parseBoardXml("x".repeat(MAX_WHITEBOARD_XML_BYTES)).ok, typeof DOMParser !== "undefined");
  assert.equal(parseBoardXml("x".repeat(MAX_WHITEBOARD_XML_BYTES + 1)).ok, false);
});

void test("serializes freehand strokes with all points", () => {
  const stroke = { id: "stroke", type: "stroke" as const, points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], color: "#000000", lineWeight: "thin" as const };
  const xml = serializeBoardXml({ ...createBoard("b"), objects: [stroke] });
  assert.match(xml, /<stroke id="stroke"/);
  assert.match(xml, /<point x="1" y="2" \/>/);
  assert.match(xml, /<point x="3" y="4" \/>/);
});

void test("serializes attached connectors with endpoint metadata", () => {
  const connector = {
    id: "connector", type: "connector" as const,
    start: { x: 10, y: 20, shapeId: "shape", connectionPoint: "right" as const },
    end: { x: 50, y: 20, shapeId: "target", connectionPoint: "left" as const },
    color: "#315f8b", lineWeight: "medium" as const
  };
  const xml = serializeBoardXml({ ...createBoard("b"), objects: [connector] });
  assert.match(xml, /<start x="10" y="20" shapeId="shape" connectionPoint="right" \/>/);
  assert.match(xml, /<end x="50" y="20" shapeId="target" connectionPoint="left" \/>/);
});

void test("serializes connector routes and arrowhead styles", () => {
  const connector = {
    id: "connector-styled", type: "connector" as const,
    start: { x: 0, y: 10 }, end: { x: 140, y: 80 },
    color: "#315f8b", lineWeight: "medium" as const,
    routing: "curved" as const, startArrow: "circle" as const, endArrow: "block" as const
  };
  const xml = serializeBoardXml({ ...createBoard("b"), objects: [connector] });
  assert.match(xml, /routing="curved"/);
  assert.match(xml, /startArrow="circle"/);
  assert.match(xml, /endArrow="block"/);
});

void test("serializes text and optional shape binding without losing data", () => {
  const text = label("text", "A & B", 1, 2, 30, 20, "shape");
  const xml = serializeBoardXml({ ...createBoard("b"), objects: [shapeObject("shape", 0, 0, 50, 40), text] });
  assert.match(xml, /parentShapeId="shape"/);
  assert.match(xml, /A &amp; B/);
});

