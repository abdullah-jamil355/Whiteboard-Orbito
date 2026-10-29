import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AnimatedCounter } from "../src/index.js";

void test("AnimatedCounter renders initial state into static markup", (): void => {
  const markup = renderToStaticMarkup(
    <AnimatedCounter value={1250} />
  );

  assert.equal(typeof markup, "string");
  // Server-rendered initial value is 0
  assert.equal(markup, "0");
});

void test("AnimatedCounter formats decimals when specified", (): void => {
  const markup = renderToStaticMarkup(
    <AnimatedCounter decimals={2} value={99.4} />
  );

  assert.equal(markup, "0.00");
});
