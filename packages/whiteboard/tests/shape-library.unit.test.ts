import assert from "node:assert/strict";
import test from "node:test";
import { SHAPE_TYPES } from "../src/board/board.js";
import { shapePath } from "../src/board/components/canvas-shape-path.js";
import { SHAPE_LIBRARY_GROUPS } from "../src/board/components/shape-library.js";

void test("General, Basic and Arrows libraries cover every supported shape exactly once", () => {
  const libraryShapes = SHAPE_LIBRARY_GROUPS.flatMap(({ shapes }) => shapes.map(({ shape }) => shape));
  assert.deepEqual([...libraryShapes].sort(), [...SHAPE_TYPES].sort());
  assert.equal(new Set(libraryShapes).size, libraryShapes.length);
});

void test("every General and Basic shape creates a closed SVG path", () => {
  for (const shape of SHAPE_TYPES) {
    const path = shapePath(shape, { x: 10, y: 20, width: 140, height: 90 });
    assert.match(path, /^M /, `${shape} begins with a move command`);
    assert.match(path, /Z(?:\s|$)/, `${shape} closes its outline`);
    assert.doesNotMatch(path, /NaN|Infinity|undefined/);
  }
});
