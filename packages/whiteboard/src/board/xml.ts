import { BOARD_SCHEMA_VERSION, isWhiteboardPaletteColor, type Board, type BoardObject, type ConnectorEndpoint } from "./board";

const escapeXml = (value: string): string => {
  const hasInvalidXmlCharacter = Array.from(value).some((character) => {
    const codePoint = character.codePointAt(0);
    return codePoint === undefined || !(
      codePoint === 0x09
      || codePoint === 0x0a
      || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff)
    );
  });

  if (hasInvalidXmlCharacter) {
    throw new RangeError("Whiteboard content contains a character that XML 1.0 cannot represent.");
  }

  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
};

const formatXmlNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new RangeError("Whiteboard geometry must contain finite numbers to save as XML.");
  }

  return Object.is(value, -0) ? "0" : String(value);
};

const formatPaletteColor = (value: string, allowNone = false): string => {
  if (allowNone && value === "none") return value;
  if (!isWhiteboardPaletteColor(value)) {
    throw new RangeError("Whiteboard colors must use a six-digit hexadecimal palette value.");
  }
  return value.toLowerCase();
};

const coordinateAttributes = (point: { x: number; y: number }): string =>
  `x="${formatXmlNumber(point.x)}" y="${formatXmlNumber(point.y)}"`;

const serializeWaypoints = (waypoints?: readonly { x: number; y: number }[]): string =>
  waypoints === undefined || waypoints.length === 0
    ? ""
    : waypoints.map((point) => `<waypoint ${coordinateAttributes(point)} />`).join("");

const connectionAttributes = (endpoint: ConnectorEndpoint): string => {
  if ((endpoint.shapeId === undefined) !== (endpoint.connectionPoint === undefined)) {
    throw new RangeError("Attached connector endpoints need a shape ID and connection point.");
  }
  const shapeId = endpoint.shapeId === undefined ? "" : ` shapeId="${escapeXml(endpoint.shapeId)}"`;
  const connectionPoint = endpoint.connectionPoint === undefined
    ? ""
    : ` connectionPoint="${escapeXml(endpoint.connectionPoint)}"`;
  return `${shapeId}${connectionPoint}`;
};

const lineStyleAttributes = (object: Extract<BoardObject, { type: "line" | "arrow" | "connector" }>): string => [
  object.startArrow === undefined ? "" : ` startArrow="${object.startArrow}"`,
  object.endArrow === undefined ? "" : ` endArrow="${object.endArrow}"`,
  object.routing === undefined ? "" : ` routing="${object.routing}"`
].join("");

const serializeObject = (object: BoardObject): string => {
  switch (object.type) {
    case "shape":
      return `    <shape id="${escapeXml(object.id)}" kind="${object.shape}" x="${formatXmlNumber(object.geometry.x)}" y="${formatXmlNumber(object.geometry.y)}" width="${formatXmlNumber(object.geometry.width)}" height="${formatXmlNumber(object.geometry.height)}" fill="${escapeXml(formatPaletteColor(object.style.fill, true))}" stroke="${escapeXml(formatPaletteColor(object.style.stroke))}" lineWeight="${object.style.lineWeight}"${object.stickyNote === true ? ' stickyNote="true"' : ""} />`;
    case "text": {
      const parent = object.parentShapeId === undefined ? "" : ` parentShapeId="${escapeXml(object.parentShapeId)}"`;
      return `    <text id="${escapeXml(object.id)}" x="${formatXmlNumber(object.geometry.x)}" y="${formatXmlNumber(object.geometry.y)}" width="${formatXmlNumber(object.geometry.width)}" height="${formatXmlNumber(object.geometry.height)}" alignment="${object.alignment}" fontSize="${formatXmlNumber(object.fontSize)}" bold="${object.bold}"${object.italic === true ? ' italic="true"' : ""}${object.underline === true ? ' underline="true"' : ""} color="${escapeXml(formatPaletteColor(object.color))}"${parent}>${escapeXml(object.text)}</text>`;
    }
    case "stroke": {
      const points = object.points
        .map((point) => `      <point ${coordinateAttributes(point)} />`)
        .join("\n");
      const pointContent = points.length === 0 ? "" : `\n${points}\n    `;
      return `    <stroke id="${escapeXml(object.id)}" color="${escapeXml(formatPaletteColor(object.color))}" lineWeight="${object.lineWeight}">${pointContent}</stroke>`;
    }
    case "line":
    case "arrow":
      return `    <${object.type} id="${escapeXml(object.id)}" color="${escapeXml(formatPaletteColor(object.color))}" lineWeight="${object.lineWeight}"${lineStyleAttributes(object)}><start ${coordinateAttributes(object.start)}${connectionAttributes(object.start)} />${serializeWaypoints(object.waypoints)}<end ${coordinateAttributes(object.end)}${connectionAttributes(object.end)} /></${object.type}>`;
    case "connector":
      return `    <connector id="${escapeXml(object.id)}" color="${escapeXml(formatPaletteColor(object.color))}" lineWeight="${object.lineWeight}"${lineStyleAttributes(object)}><start ${coordinateAttributes(object.start)}${connectionAttributes(object.start)} />${serializeWaypoints(object.waypoints)}<end ${coordinateAttributes(object.end)}${connectionAttributes(object.end)} /></connector>`;
  }
};

export const serializeBoardXml = (board: Board): string => {
  const objects = board.objects.map(serializeObject).join("\n");
  const objectContent = objects.length === 0 ? "" : `\n${objects}\n  `;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<whiteboard formatVersion="${BOARD_SCHEMA_VERSION}" id="${escapeXml(board.id)}" templateId="${escapeXml(board.templateId)}">`,
    `  <title>${escapeXml(board.title)}</title>`,
    `  <canvas gridStyle="${board.canvas.gridStyle}" gridSpacing="${formatXmlNumber(board.canvas.gridSpacing)}" />`,
    `  <objects>${objectContent}</objects>`,
    "</whiteboard>",
    ""
  ].join("\n");
};

export const getBoardFilename = (title: string): string => {
  const safeTitle = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 80);

  const filename = safeTitle.length === 0 || safeTitle.toLowerCase() === "untitled"
    ? "Untitled Diagram"
    : safeTitle;
  return `${filename}.Whiteboard`;
};
