import { BOARD_SCHEMA_VERSION, type Board } from "./board";
import { MAX_OBJECT_COUNT, assertAttributes, assertElement, assertTextOnly, fail, getAttribute, getChildElements, readIdentifier, readNumber } from "./xml.validation.helpers";
import { parseObject } from "./xml.object.validation";

export const parseBoardDocument = (document: Document): Board => {
  const root = document.documentElement;
  assertElement(root, "whiteboard");
  assertAttributes(root, ["formatVersion", "id", "templateId"]);
  const versionText = getAttribute(root, "formatVersion");
  if (!/^\d{1,4}$/.test(versionText)) fail("This file has an invalid Whiteboard format version.");
  const version = Number(versionText);
  if (version !== BOARD_SCHEMA_VERSION) {
    fail("This Whiteboard file uses an unsupported format version.");
  }

  const boardId = readIdentifier(getAttribute(root, "id"), "board ID");
  const templateId = readIdentifier(getAttribute(root, "templateId"), "template ID");
  const sections = getChildElements(root);
  if (sections.length !== 3) fail("This file is missing required Whiteboard project sections.");
  assertElement(sections[0]!, "title");
  assertElement(sections[1]!, "canvas");
  assertElement(sections[2]!, "objects");
  assertAttributes(sections[0]!, []);
  assertAttributes(sections[1]!, ["gridStyle", "gridSpacing"]);
  assertAttributes(sections[2]!, []);

  const title = assertTextOnly(sections[0]!);
  if (title.length > 120) fail("This board title is too long.");
  if (getChildElements(sections[1]!).length > 0) fail("This canvas contains unsupported content.");
  const gridStyle = getAttribute(sections[1]!, "gridStyle");
  const gridSpacing = readNumber(getAttribute(sections[1]!, "gridSpacing"), "grid spacing");
  if (gridStyle !== "graph-paper" || gridSpacing < 4 || gridSpacing > 200) {
    fail("This file contains unsupported canvas settings.");
  }

  const objectElements = getChildElements(sections[2]!);
  if (objectElements.length > MAX_OBJECT_COUNT) fail("This board contains too many objects.");
  const allIds = new Set([boardId]);
  const objectIds = objectElements.map((element) => readIdentifier(getAttribute(element, "id"), "object ID"));
  for (const id of objectIds) {
    if (allIds.has(id)) fail("This file contains duplicate object IDs.");
    allIds.add(id);
  }

  const shapeIds = objectElements
    .flatMap((element, index) => element.localName === "shape" ? [objectIds[index]!] : []);
  const objects = objectElements.map((element) => parseObject(element, shapeIds));
  for (const object of objects) {
    if (object.type === "text" && object.parentShapeId !== undefined) {
      if (!objects.some((candidate) => candidate.id === object.parentShapeId && candidate.type === "shape")) {
        fail("This file contains an invalid text-to-shape reference.");
      }
    }
  }

  return {
    id: boardId,
    title,
    templateId,
    canvas: { gridStyle: "graph-paper", gridSpacing },
    objects
  };
};

