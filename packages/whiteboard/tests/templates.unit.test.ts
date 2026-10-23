import assert from "node:assert/strict";
import test from "node:test";
import { createBoardFromTemplate, listBoardTemplates } from "../src/board/templates.js";

void test("ships templates with unique identifiers and valid internal references", () => {
  const templates = listBoardTemplates();
  assert.ok(templates.length >= 10);
  assert.equal(new Set(templates.map(({ id }) => id)).size, templates.length);
  for (const template of templates) {
    const objectIds = template.objects.map(({ id }) => id);
    assert.equal(new Set(objectIds).size, objectIds.length, `${template.id} has duplicate object IDs`);
    const knownIds = new Set(objectIds);
    for (const object of template.objects) {
      if (object.type === "text" && object.parentShapeId !== undefined) assert.ok(knownIds.has(object.parentShapeId));
      if (object.type === "connector") {
        if (object.start.shapeId !== undefined) assert.ok(knownIds.has(object.start.shapeId));
        if (object.end.shapeId !== undefined) assert.ok(knownIds.has(object.end.shapeId));
      }
    }
  }
});

void test("creates independent scaled template boards with remapped references", () => {
  const template = listBoardTemplates().find(({ objects }) => objects.some((object) => object.type === "arrow"))!;
  const ids = [`board-copy`, ...template.objects.map(({ id }) => `copy-${id}`)];
  const first = createBoardFromTemplate(template.id, () => ids.shift()!);
  assert.ok(first);
  assert.equal(first.title, template.name);
  assert.equal(first.templateId, template.id);
  assert.equal(first.objects.length, template.objects.length);
  assert.ok(first.objects.every(({ id }) => id.startsWith("copy-")));
  for (const object of first.objects) {
    if (object.type === "text" && object.parentShapeId !== undefined) assert.ok(first.objects.some(({ id }) => id === object.parentShapeId));
  }
});

void test("returns null for unknown templates and rejects duplicate generated IDs", () => {
  assert.equal(createBoardFromTemplate("not-a-template", () => "id"), null);
  const template = listBoardTemplates().find(({ objects }) => objects.length > 0)!;
  assert.throws(() => createBoardFromTemplate(template.id, () => "same"), /duplicate ID/);
});
