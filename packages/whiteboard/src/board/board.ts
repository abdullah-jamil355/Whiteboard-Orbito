export type LineWeight = "thin" | "medium" | "thick";
export type ConnectionPoint = "top" | "right" | "bottom" | "left" | "center";
export type ArrowHead = "none" | "open" | "triangle" | "block" | "diamond" | "circle";
export type ConnectorRouting = "straight" | "orthogonal" | "curved";

export const WHITEBOARD_PALETTE = [
  { name: "Ink", value: "#000000" },
  { name: "Blue", value: "#315f8b" },
  { name: "Red", value: "#bf4b4b" },
  { name: "Green", value: "#4f7a53" },
  { name: "Amber", value: "#a56b1f" },
  { name: "Teal", value: "#168c8c" },
  { name: "Violet", value: "#7653a6" },
  { name: "White", value: "#ffffff" }
] as const;

export const LINE_WEIGHT_STROKE_WIDTHS: Readonly<Record<LineWeight, number>> = {
  thin: 2,
  medium: 4,
  thick: 7
};

export const MAX_STROKE_POINT_COUNT = 100_000;
export const MAX_TEXT_LENGTH = 10_000;

export const SHAPE_TYPES = [
  "rectangle", "rounded-rectangle", "circle", "diamond", "triangle", "hexagon", "parallelogram", "trapezoid",
  "pentagon", "octagon", "star", "cross", "cylinder", "cloud", "document", "speech-bubble",
  "right-arrow", "left-arrow", "up-arrow", "down-arrow", "double-arrow", "left-right-arrow"
] as const;
export type ShapeKind = (typeof SHAPE_TYPES)[number];
export const isShapeTool = (tool: WhiteboardTool): tool is ShapeKind =>
  (SHAPE_TYPES as readonly string[]).includes(tool);

export const isLineWeight = (value: string): value is LineWeight =>
  value === "thin" || value === "medium" || value === "thick";
export const ARROW_HEADS = ["none", "open", "triangle", "block", "diamond", "circle"] as const satisfies readonly ArrowHead[];
export const CONNECTOR_ROUTINGS = ["straight", "orthogonal", "curved"] as const satisfies readonly ConnectorRouting[];

const PALETTE_COLOR_PATTERN = /^#[\da-f]{6}$/i;

export const isWhiteboardPaletteColor = (value: string): boolean => PALETTE_COLOR_PATTERN.test(value);

export type Coordinate = Readonly<{
  x: number;
  y: number;
}>;

export type ShapeObject = Readonly<{
  id: string;
  type: "shape";
  shape: ShapeKind;
  geometry: Readonly<Coordinate & { width: number; height: number }>;
  style: Readonly<{
    fill: string | "none";
    stroke: string;
    lineWeight: LineWeight;
  }>;
  stickyNote?: boolean;
}>;

export type TextObject = Readonly<{
  id: string;
  type: "text";
  geometry: Readonly<Coordinate & { width: number; height: number }>;
  text: string;
  alignment: "left" | "center" | "right";
  fontSize: number;
  bold: boolean;
  italic?: boolean;
  underline?: boolean;
  color: string;
  parentShapeId?: string;
}>;

export type StrokeObject = Readonly<{
  id: string;
  type: "stroke";
  points: readonly Coordinate[];
  color: string;
  lineWeight: LineWeight;
}>;

export type LineObject = Readonly<{
  id: string;
  type: "line" | "arrow";
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  color: string;
  lineWeight: LineWeight;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
  routing?: ConnectorRouting;
  waypoints?: readonly Coordinate[];
}>;

export type ConnectorEndpoint = Readonly<
  Coordinate & {
    shapeId?: string;
    connectionPoint?: ConnectionPoint;
  }
>;

export const SHAPE_CONNECTION_POINTS: readonly ConnectionPoint[] = ["top", "right", "bottom", "left", "center"];

export const shapeConnectionCoordinate = (
  geometry: ShapeObject["geometry"],
  point: ConnectionPoint,
  shapeKind?: ShapeKind
): Coordinate => {
  const centerX = geometry.x + geometry.width / 2;
  const centerY = geometry.y + geometry.height / 2;
  if (point === "center") return { x: centerX, y: centerY };

  const { x, y, width, height } = geometry;
  const right = x + width;
  const bottom = y + height;

  if (shapeKind === "parallelogram") {
    switch (point) {
      case "top": return { x: x + width * 0.61, y };
      case "right": return { x: x + width * 0.89, y: centerY };
      case "bottom": return { x: x + width * 0.39, y: bottom };
      case "left": return { x: x + width * 0.11, y: centerY };
    }
  }

  if (shapeKind === "pentagon") {
    switch (point) {
      case "top": return { x: centerX, y };
      case "right": return { x: x + width * 0.925, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.905 };
      case "left": return { x: x + width * 0.075, y: centerY };
    }
  }

  if (shapeKind === "octagon") {
    switch (point) {
      case "top": return { x: centerX, y: y + height * 0.07 };
      case "right": return { x: x + width * 0.93, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.93 };
      case "left": return { x: x + width * 0.07, y: centerY };
    }
  }

  if (shapeKind === "cloud") {
    switch (point) {
      case "top": return { x: centerX, y: y + height * 0.06 };
      case "right": return { x: x + width * 0.95, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.94 };
      case "left": return { x: x + width * 0.05, y: centerY };
    }
  }

  if (shapeKind === "star") {
    switch (point) {
      case "top": return { x: centerX, y };
      case "right": return { x: x + width * 0.97, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.90 };
      case "left": return { x: x + width * 0.03, y: centerY };
    }
  }

  if (shapeKind === "speech-bubble") {
    switch (point) {
      case "top": return { x: centerX, y };
      case "right": return { x: right, y: y + height * 0.39 };
      case "bottom": return { x: centerX, y: y + height * 0.78 };
      case "left": return { x, y: y + height * 0.39 };
    }
  }

  if (shapeKind === "trapezoid") {
    switch (point) {
      case "top": return { x: centerX, y };
      case "right": return { x: x + width * 0.9, y: centerY };
      case "bottom": return { x: centerX, y: bottom };
      case "left": return { x: x + width * 0.1, y: centerY };
    }
  }

  if (shapeKind === "triangle") {
    switch (point) {
      case "top": return { x: centerX, y };
      case "right": return { x: x + width * 0.75, y: centerY };
      case "bottom": return { x: centerX, y: bottom };
      case "left": return { x: x + width * 0.25, y: centerY };
    }
  }

  if (shapeKind === "right-arrow") {
    switch (point) {
      case "top": return { x: centerX, y: y + height * 0.28 };
      case "right": return { x: right, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.72 };
      case "left": return { x, y: centerY };
    }
  }

  if (shapeKind === "left-arrow") {
    switch (point) {
      case "top": return { x: centerX, y: y + height * 0.28 };
      case "right": return { x: right, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.72 };
      case "left": return { x, y: centerY };
    }
  }

  if (shapeKind === "up-arrow" || shapeKind === "down-arrow") {
    switch (point) {
      case "top": return { x: centerX, y };
      case "right": return { x: x + width * 0.72, y: centerY };
      case "bottom": return { x: centerX, y: bottom };
      case "left": return { x: x + width * 0.28, y: centerY };
    }
  }

  if (shapeKind === "double-arrow" || shapeKind === "left-right-arrow") {
    switch (point) {
      case "top": return { x: centerX, y: y + height * 0.28 };
      case "right": return { x: right, y: centerY };
      case "bottom": return { x: centerX, y: y + height * 0.72 };
      case "left": return { x, y: centerY };
    }
  }

  switch (point) {
    case "top": return { x: centerX, y };
    case "right": return { x: right, y: centerY };
    case "bottom": return { x: centerX, y: bottom };
    case "left": return { x, y: centerY };
  }
};

export const snapConnectorEndpoint = (
  coordinate: Coordinate,
  shapes: readonly ShapeObject[],
  maximumDistance = 24,
  toward?: Coordinate
): ConnectorEndpoint => {
  let closest: ConnectorEndpoint | null = null;
  let closestDistance = maximumDistance;
  for (const shape of shapes) {
    const { x, y, width, height } = shape.geometry;
    const centerX = x + width / 2;
    const centerY = y + height / 2;
    const normalizedX = Math.abs((coordinate.x - centerX) / Math.max(width / 2, 1));
    const normalizedY = Math.abs((coordinate.y - centerY) / Math.max(height / 2, 1));
    const insideShape = shape.shape === "circle"
      ? normalizedX ** 2 + normalizedY ** 2 <= 1
      : shape.shape === "diamond"
        ? normalizedX + normalizedY <= 1
        : normalizedX <= 1 && normalizedY <= 1;
    const points = insideShape && toward !== undefined
      ? [
          Math.abs(toward.x - centerX) > Math.abs(toward.y - centerY)
            ? toward.x < centerX ? "left" : "right"
            : toward.y < centerY ? "top" : "bottom"
        ] as const
      : SHAPE_CONNECTION_POINTS.filter((point): point is Exclude<ConnectionPoint, "center"> => point !== "center");
    for (const connectionPoint of points) {
      const position = shapeConnectionCoordinate(shape.geometry, connectionPoint, shape.shape);
      const distance = Math.hypot(coordinate.x - position.x, coordinate.y - position.y);
      if ((insideShape || distance <= maximumDistance) && (closest === null || distance <= closestDistance)) {
        closest = { ...position, shapeId: shape.id, connectionPoint };
        closestDistance = distance;
      }
    }
  }
  return closest ?? coordinate;
};

export const connectorRoutePoints = (
  start: ConnectorEndpoint,
  end: ConnectorEndpoint,
  routing: ConnectorRouting = "orthogonal",
  waypoints?: readonly Coordinate[]
): readonly Coordinate[] => {
  if (waypoints !== undefined && waypoints.length > 0) {
    if (routing === "straight") {
      return [start, ...waypoints, end];
    }
    if (routing === "curved") {
      return [start, ...waypoints, end];
    }
    const all = [start, ...waypoints, end];
    const routed: Coordinate[] = [all[0]!];
    for (let index = 0; index < all.length - 1; index++) {
      const p0 = all[index]!;
      const p1 = all[index + 1]!;
      if (Math.abs(p0.x - p1.x) < 2 || Math.abs(p0.y - p1.y) < 2) {
        routed.push(p1);
      } else {
        const midX = (p0.x + p1.x) / 2;
        routed.push({ x: midX, y: p0.y }, { x: midX, y: p1.y }, p1);
      }
    }
    return routed;
  }

  if (routing === "straight") return [start, end];
  if (routing === "curved") {
    const distance = Math.max(32, Math.hypot(end.x - start.x, end.y - start.y) * 0.4);
    if (start.connectionPoint === undefined && end.connectionPoint === undefined) {
      const deltaX = end.x - start.x;
      const deltaY = end.y - start.y;
      const length = Math.max(1, Math.hypot(deltaX, deltaY));
      const bow = Math.max(16, length * 0.18);
      const offsetX = -deltaY / length * bow;
      const offsetY = deltaX / length * bow;
      const control1 = { x: start.x + deltaX * 0.34 + offsetX, y: start.y + deltaY * 0.34 + offsetY };
      const control2 = { x: start.x + deltaX * 0.66 + offsetX, y: start.y + deltaY * 0.66 + offsetY };
      return Array.from({ length: 17 }, (_, index) => {
        const t = index / 16;
        const inverse = 1 - t;
        return {
          x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
          y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y
        };
      });
    }
    const startDirection = start.connectionPoint === "left" ? { x: -1, y: 0 }
      : start.connectionPoint === "right" ? { x: 1, y: 0 }
        : start.connectionPoint === "top" ? { x: 0, y: -1 }
          : start.connectionPoint === "bottom" ? { x: 0, y: 1 }
            : { x: (end.x - start.x) / Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)), y: (end.y - start.y) / Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)) };
    const endDirection = end.connectionPoint === "left" ? { x: -1, y: 0 }
      : end.connectionPoint === "right" ? { x: 1, y: 0 }
        : end.connectionPoint === "top" ? { x: 0, y: -1 }
          : end.connectionPoint === "bottom" ? { x: 0, y: 1 }
            : { x: (start.x - end.x) / Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)), y: (start.y - end.y) / Math.max(1, Math.hypot(end.x - start.x, end.y - start.y)) };
    const control1 = { x: start.x + startDirection.x * distance, y: start.y + startDirection.y * distance };
    const control2 = { x: end.x + endDirection.x * distance, y: end.y + endDirection.y * distance };
    return Array.from({ length: 17 }, (_, index) => {
      const t = index / 16;
      const inverse = 1 - t;
      return {
        x: inverse ** 3 * start.x + 3 * inverse ** 2 * t * control1.x + 3 * inverse * t ** 2 * control2.x + t ** 3 * end.x,
        y: inverse ** 3 * start.y + 3 * inverse ** 2 * t * control1.y + 3 * inverse * t ** 2 * control2.y + t ** 3 * end.y
      };
    });
  }
  const horizontalStart = start.connectionPoint === "left" || start.connectionPoint === "right";
  const verticalStart = start.connectionPoint === "top" || start.connectionPoint === "bottom";
  const horizontalEnd = end.connectionPoint === "left" || end.connectionPoint === "right";
  const verticalEnd = end.connectionPoint === "top" || end.connectionPoint === "bottom";

  if (horizontalStart && horizontalEnd) {
    const middleX = (start.x + end.x) / 2;
    return [start, { x: middleX, y: start.y }, { x: middleX, y: end.y }, end];
  }
  if (verticalStart && verticalEnd) {
    const middleY = (start.y + end.y) / 2;
    return [start, { x: start.x, y: middleY }, { x: end.x, y: middleY }, end];
  }
  if (horizontalStart || verticalEnd) return [start, { x: end.x, y: start.y }, end];
  return [start, { x: start.x, y: end.y }, end];
};

export type ConnectorObject = Readonly<{
  id: string;
  type: "connector";
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  color: string;
  lineWeight: LineWeight;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
  routing?: ConnectorRouting;
  waypoints?: readonly Coordinate[];
}>;

export type BoardObject = ShapeObject | TextObject | StrokeObject | LineObject | ConnectorObject;
export type WhiteboardTool = "select" | "pen" | "eraser" | "text" | "sticky-note" | ShapeKind | LineObject["type"] | "connector" | "connection" | "waypoints";

export type Board = Readonly<{
  id: string;
  title: string;
  templateId: string;
  canvas: Readonly<{
    gridStyle: "graph-paper";
    gridSpacing: number;
  }>;
  objects: readonly BoardObject[];
}>;

export const BOARD_SCHEMA_VERSION = 1;
export const DEFAULT_GRID_SPACING = 22;

export const createBoard = (id: string): Board => ({
  id,
  title: "Untitled",
  templateId: "blank",
  canvas: {
    gridStyle: "graph-paper",
    gridSpacing: DEFAULT_GRID_SPACING
  },
  objects: []
});

export const renameBoard = (board: Board, title: string): Board => ({
  ...board,
  title
});

export const updateShapeAndBoundTextGeometry = (
  board: Board,
  shapeId: string,
  geometry: ShapeObject["geometry"]
): Board => {
  const shape = board.objects.find((object): object is ShapeObject => object.id === shapeId && object.type === "shape");
  if (shape === undefined) return board;

  const previous = shape.geometry;
  const scaleX = geometry.width / previous.width;
  const scaleY = geometry.height / previous.height;
  return {
    ...board,
    objects: board.objects.map((object) => {
      if (object.id === shapeId && object.type === "shape") return { ...object, geometry };
      if (object.type === "connector" || object.type === "line" || object.type === "arrow") {
        const updateEndpoint = (endpoint: ConnectorEndpoint): ConnectorEndpoint =>
          endpoint.shapeId === shapeId && endpoint.connectionPoint !== undefined
            ? { ...endpoint, ...shapeConnectionCoordinate(geometry, endpoint.connectionPoint, shape.shape) }
            : endpoint;
        return { ...object, start: updateEndpoint(object.start), end: updateEndpoint(object.end) };
      }
      if (object.type !== "text" || object.parentShapeId !== shapeId) return object;
      return {
        ...object,
        geometry: {
          x: geometry.x + (object.geometry.x - previous.x) * scaleX,
          y: geometry.y + (object.geometry.y - previous.y) * scaleY,
          width: object.geometry.width * scaleX,
          height: object.geometry.height * scaleY
        }
      };
    })
  };
};
