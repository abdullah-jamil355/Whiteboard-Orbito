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

export {
  connectorRoutePoints,
  shapeConnectionCoordinate,
  snapConnectorEndpoint,
  SHAPE_CONNECTION_POINTS
} from "./board-connection.js";

import { shapeConnectionCoordinate } from "./board-connection.js";

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
