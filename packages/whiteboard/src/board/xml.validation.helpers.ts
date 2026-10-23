import {
  isWhiteboardPaletteColor,
  ARROW_HEADS,
  CONNECTOR_ROUTINGS,
  SHAPE_TYPES,
  type ConnectionPoint,
  type ConnectorEndpoint,
  type LineWeight
} from "./board";
import type { ArrowHead, ConnectorRouting } from "./board";

export const MAX_OBJECT_COUNT = 10_000;
const MAX_IDENTIFIER_LENGTH = 128;
const MAX_COORDINATE = 10_000_000;
const MAX_DIMENSION = 10_000_000;
export const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DECIMAL_PATTERN = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
export const LINE_WEIGHTS = new Set<LineWeight>(["thin", "medium", "thick"]);
export const SHAPE_TYPES_SET = new Set<string>(SHAPE_TYPES);
export const ARROW_HEADS_SET = new Set<string>(ARROW_HEADS);
export const CONNECTOR_ROUTINGS_SET = new Set<string>(CONNECTOR_ROUTINGS);
export const TEXT_ALIGNMENTS = new Set(["left", "center", "right"]);
export const CONNECTION_POINTS = new Set(["top", "right", "bottom", "left", "center"]);

export const fail = (message: string): never => {
  const error = new Error(message);
  error.name = "WhiteboardXmlValidationError";
  throw error;
};

export const parseErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.name === "WhiteboardXmlValidationError") {
    return error.message;
  }
  return "This file could not be opened as a Whiteboard XML project.";
};

export const assertElement = (element: Element, expectedName: string): void => {
  if (element.localName !== expectedName || element.namespaceURI) {
    fail("This file contains an unsupported XML element.");
  }
};

export const assertAttributes = (
  element: Element,
  required: readonly string[],
  optional: readonly string[] = []
): void => {
  const allowed = new Set([...required, ...optional]);
  const present = new Set<string>();

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.namespaceURI || !allowed.has(attribute.name)) {
      fail("This file contains an unsupported XML attribute.");
    }
    present.add(attribute.name);
  }

  if (required.some((name) => !present.has(name))) {
    fail("This file is missing required Whiteboard project data.");
  }
};

export const assertWhitespaceOnly = (element: Element): void => {
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE && child.textContent?.trim() === "") continue;
    if (child.nodeType === Node.COMMENT_NODE) continue;
    if (child.nodeType === Node.ELEMENT_NODE) continue;
    fail("This file contains unsupported XML content.");
  }
};

export const getChildElements = (element: Element): Element[] => {
  assertWhitespaceOnly(element);
  return Array.from(element.children);
};

export const assertTextOnly = (element: Element): string => {
  let text = "";
  for (const child of Array.from(element.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) {
      text += child.textContent ?? "";
      continue;
    }
    if (child.nodeType === Node.COMMENT_NODE) continue;
    fail("This file contains unsupported XML content.");
  }
  return text;
};

export const getAttribute = (element: Element, name: string): string => {
  const value = element.getAttribute(name);
  return value ?? fail("This file is missing required Whiteboard project data.");
};

export const readIdentifier = (value: string, label: string): string => {
  if (value.length > MAX_IDENTIFIER_LENGTH || !ID_PATTERN.test(value)) {
    fail(`This file contains an invalid ${label}.`);
  }
  return value;
};

export const readNumber = (value: string, label: string): number => {
  if (!DECIMAL_PATTERN.test(value)) fail(`This file contains invalid ${label}.`);
  const number = Number(value);
  if (!Number.isFinite(number)) fail(`This file contains invalid ${label}.`);
  return number;
};

export const readCoordinate = (element: Element): Readonly<{ x: number; y: number }> => {
  const x = readNumber(getAttribute(element, "x"), "coordinates");
  const y = readNumber(getAttribute(element, "y"), "coordinates");
  if (Math.abs(x) > MAX_COORDINATE || Math.abs(y) > MAX_COORDINATE) {
    fail("This file contains coordinates outside the supported range.");
  }
  return { x, y };
};

export const readGeometry = (element: Element): Readonly<{ x: number; y: number; width: number; height: number }> => {
  const { x, y } = readCoordinate(element);
  const width = readNumber(getAttribute(element, "width"), "dimensions");
  const height = readNumber(getAttribute(element, "height"), "dimensions");
  if (width <= 0 || height <= 0 || width > MAX_DIMENSION || height > MAX_DIMENSION) {
    fail("This file contains dimensions outside the supported range.");
  }
  return { x, y, width, height };
};

export const readColor = (value: string, allowNone = false): string => {
  if (allowNone && value === "none") return value;
  if (!isWhiteboardPaletteColor(value)) fail("This file contains an unsupported color value.");
  return value.toLowerCase();
};

export const readLineWeight = (value: string): LineWeight => {
  if (!LINE_WEIGHTS.has(value as LineWeight)) fail("This file contains an unsupported line weight.");
  return value as LineWeight;
};

export const readArrowHead = (value: string): ArrowHead => {
  if (!ARROW_HEADS_SET.has(value)) fail("This file contains an unsupported arrowhead style.");
  return value as ArrowHead;
};

export const readConnectorRouting = (value: string): ConnectorRouting => {
  if (!CONNECTOR_ROUTINGS_SET.has(value)) fail("This file contains an unsupported connector routing style.");
  return value as ConnectorRouting;
};

export const readEndpoint = (element: Element, ids: readonly string[]): ConnectorEndpoint => {
  assertElement(element, element.localName);
  assertAttributes(element, ["x", "y"], ["shapeId", "connectionPoint"]);
  if (getChildElements(element).length > 0) fail("This connector endpoint contains unsupported content.");
  const position = readCoordinate(element);
  const hasShape = element.hasAttribute("shapeId");
  const hasConnectionPoint = element.hasAttribute("connectionPoint");

  if (hasShape !== hasConnectionPoint) {
    fail("Attached connector endpoints need both a shape and connection point.");
  }
  if (!hasShape) return position;

  const shapeId = readIdentifier(getAttribute(element, "shapeId"), "connector reference");
  const connectionPoint = getAttribute(element, "connectionPoint");
  if (!ids.includes(shapeId) || !CONNECTION_POINTS.has(connectionPoint as ConnectionPoint)) {
    fail("This file contains an invalid connector reference.");
  }
  return { ...position, shapeId, connectionPoint: connectionPoint as ConnectionPoint };
};

