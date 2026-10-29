import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { Sparkline } from "../src/index.js";

void test("Sparkline renders an svg with gradient defs and paths", (): void => {
  const markup = renderToStaticMarkup(
    <Sparkline
      color="#06B6D4"
      data={[10, 20, 15, 30, 25, 40]}
      fillId="test-sparkline"
      height={36}
    />
  );

  assert.match(markup, /^<svg /);
  assert.match(markup, /linearGradient id="test-sparkline"/);
  assert.match(markup, /stroke="#06B6D4"/);
  assert.match(markup, /d="M /);
});

void test("Sparkline gracefully handles empty data using fallback points", (): void => {
  const markup = renderToStaticMarkup(
    <Sparkline
      color="#10B981"
      data={[]}
      fillId="test-fallback"
    />
  );

  assert.match(markup, /^<svg /);
  assert.match(markup, /stroke="#10B981"/);
});
