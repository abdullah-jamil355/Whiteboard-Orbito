import type { ArrowHead, Board, BoardObject, ConnectionPoint, ConnectorEndpoint, ConnectorObject, ConnectorRouting, Coordinate, LineObject, LineWeight, ShapeObject, StrokeObject, TextObject, WhiteboardTool } from "..";
import type { BoardBounds } from "../object-operations";
import type { StickyNoteShape } from "../sticky-notes";

export const BASE_CANVAS_WIDTH = 1200;
export const BASE_CANVAS_HEIGHT = 800;
export type CanvasBounds = Readonly<{ width: number; height: number }>;
export type CanvasCamera = Readonly<{ x: number; y: number; zoom: number }>;
export type CollaboratorPresence = Readonly<{
  clientId: number;
  name: string;
  role: "owner" | "editor" | "viewer";
  cursor: Coordinate | null;
}>;
export type ConnectionDirection = Exclude<ConnectionPoint, "center">;
export type WhiteboardCanvasProps = Readonly<{
  board: Board;
  selectedTool: WhiteboardTool;
  selectedShapeId: string | null;
  selectedTextId: string | null;
  selectedObjectIds: readonly string[];
  editingTextId: string | null;
  penColor: string;
  penLineWeight: LineWeight;
  shapeStrokeColor: string;
  shapeLineWeight: LineWeight;
  shapeFill: string | "none";
  lineColor: string;
  lineLineWeight: LineWeight;
  connectorRouting: ConnectorRouting;
  lineStartArrow: ArrowHead;
  lineEndArrow: ArrowHead;
  readOnly?: boolean;
  collaborators?: readonly CollaboratorPresence[];
  onCameraChange?: (camera: CanvasCamera) => void;
  onCursorChange?: (cursor: Coordinate | null) => void;
  onLineCommit: (line: Omit<LineObject, "id"> | Omit<ConnectorObject, "id">) => void;
  onStrokeCommit: (stroke: Omit<StrokeObject, "id" | "type">) => void;
  onEraseCommit: (path: readonly Coordinate[], radius: number) => void;
  onShapeCommit: (shape: Omit<ShapeObject, "id" | "type">) => void;
  onStickyNoteCreate: (position: Coordinate) => void;
  onStickyNoteFillChange: (shapeId: string, fill: string) => void;
  onStickyNoteShapeChange: (shape: ShapeObject, kind: StickyNoteShape) => void;
  onStickyNoteTextChange: (textId: string, update: Partial<Pick<TextObject, "alignment" | "fontSize" | "bold" | "italic" | "underline">>) => void;
  onShapeGeometryChange: (shapeId: string, geometry: ShapeObject["geometry"]) => void;
  onShapeSelect: (shapeId: string | null) => void;
  onSelectionChange: (ids: readonly string[]) => void;
  onObjectsMove: (ids: readonly string[], dx: number, dy: number) => void;
  onObjectResize: (id: string, bounds: BoardBounds) => void;
  onTextCreate: (text: Omit<TextObject, "id" | "type">) => string;
  onTextSelect: (textId: string | null) => void;
  onTextEditStart: (textId: string) => void;
  onTextEditFinish: (textId: string) => void;
  onTextChange: (textId: string, value: string, geometry?: TextObject["geometry"]) => void;
  onTextGeometryChange: (textId: string, geometry: TextObject["geometry"]) => void;
  onUpdateWaypoints?: ((id: string, waypoints: readonly Coordinate[]) => void) | undefined;
}>;

export type ResizeHandle = "north-west" | "north-east" | "south-west" | "south-east";
export type LinearTool = "line" | "arrow" | "connector" | "connection" | "waypoints";
export type PreviewLine = Readonly<{
  type: LinearTool;
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  color: string;
  lineWeight: LineWeight;
  routing?: ConnectorRouting;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
}>;
export type TextClick = Readonly<{ textId: string; timestamp: number; position: Coordinate }>;
export type ActiveGesture =
  | Readonly<{ kind: "pan"; pointerId: number; origin: Readonly<{ x: number; y: number }>; camera: CanvasCamera }>
  | Readonly<{ kind: "stroke"; pointerId: number }>
  | Readonly<{ kind: "erase"; pointerId: number }>
  | Readonly<{ kind: "line"; pointerId: number; tool: LinearTool; start: ConnectorEndpoint; origin: Coordinate; quickConnectDirection?: ConnectionDirection }>
  | Readonly<{ kind: "shape"; pointerId: number; shape: ShapeObject["shape"]; origin: Coordinate }>
  | Readonly<{ kind: "move"; pointerId: number; shape: ShapeObject; origin: Coordinate }>
  | Readonly<{ kind: "move-objects"; pointerId: number; ids: readonly string[]; origin: Coordinate }>
  | Readonly<{ kind: "box-select"; pointerId: number; origin: Coordinate; additive: boolean }>
  | Readonly<{ kind: "resize-object"; pointerId: number; object: BoardObject; handle: ResizeHandle; origin: Coordinate; bounds: BoardBounds }>
  | Readonly<{ kind: "move-text"; pointerId: number; text: TextObject; origin: Coordinate }>
  | Readonly<{ kind: "resize"; pointerId: number; shape: ShapeObject; handle: ResizeHandle; origin: Coordinate }>
  | Readonly<{ kind: "move-waypoint"; pointerId: number; objectId: string; waypointIndex: number; isMidpoint?: boolean; origin: Coordinate }>;

export const MINIMUM_SHAPE_SIZE = 24;
export const MINIMUM_MOVE_DISTANCE = 4;
export const ERASER_RADIUS = 12;
export const DEFAULT_SHAPE_WIDTH = 128;
export const DEFAULT_SHAPE_HEIGHT = 88;
export const MAX_ERASER_PATH_POINT_COUNT = 4_096;
export const MIN_CANVAS_ZOOM = 0.25;
export const MAX_CANVAS_ZOOM = 4;
const adaptiveCanvasColors = new Set(["#000", "#000000", "#172033", "#fff", "#ffffff"]);
const isLightCanvasColor = (color: string): boolean => {
  const normalized = color.trim().toLowerCase();
  if (!/^#[\da-f]{6}$/.test(normalized)) return false;
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255;
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255;
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255;
  const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
  return luminance >= 0.5;
};

export const renderCanvasColor = (color: string, background?: string): string => {
  if (!adaptiveCanvasColors.has(color.trim().toLowerCase())) return color;
  if (background !== undefined && background !== "none") return isLightCanvasColor(background) ? "#000000" : "#ffffff";
  return "var(--wb-default-ink, #ffffff)";
};
export const RESIZE_HANDLES: readonly Readonly<{ id: ResizeHandle; x: number; y: number }>[] = [
  { id: "north-west", x: 0, y: 0 },
  { id: "north-east", x: 1, y: 0 },
  { id: "south-west", x: 0, y: 1 },
  { id: "south-east", x: 1, y: 1 }
];
