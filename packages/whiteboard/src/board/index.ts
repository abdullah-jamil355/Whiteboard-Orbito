export {
  createBoard,
  ARROW_HEADS,
  CONNECTOR_ROUTINGS,
  isShapeTool,
  isLineWeight,
  LINE_WEIGHT_STROKE_WIDTHS,
  MAX_TEXT_LENGTH,
  MAX_STROKE_POINT_COUNT,
  renameBoard,
  updateShapeAndBoundTextGeometry,
  WHITEBOARD_PALETTE,
  SHAPE_CONNECTION_POINTS,
  type Board,
  type ArrowHead,
  type BoardObject,
  type ConnectionPoint,
  type ConnectorEndpoint,
  type ConnectorObject,
  type ConnectorRouting,
  type Coordinate,
  type LineObject,
  type LineWeight,
  type ShapeObject,
  type ShapeKind,
  type StrokeObject,
  type TextObject,
  type WhiteboardTool,
  connectorRoutePoints,
  shapeConnectionCoordinate,
  snapConnectorEndpoint
} from "./board";
export { createBoardFromTemplate, listBoardTemplates, type BoardTemplate } from "./templates";
export { eraseBoardObjects, type BoardObjectsEdit, type ErasureResult, type IndexedBoardObject } from "./eraser";
export { createBoardSession, isBoardSessionOwner, renameBoardSession, type BoardSession } from "./session";
export { getBoardFilename, serializeBoardXml } from "./xml";
export { MAX_WHITEBOARD_XML_BYTES, parseBoardXml } from "./xml.validation";
export { applyBoardHistorySnapshot, createBoardHistoryEdit, type BoardHistoryEdit } from "./history";
export { createStickyNoteObjects, MAX_STICKY_NOTE_TEXT_LENGTH, STICKY_NOTE_COLORS, STICKY_NOTE_FILL, STICKY_NOTE_HEIGHT, STICKY_NOTE_SQUARE_SIZE, STICKY_NOTE_WIDTH, type StickyNoteShape } from "./sticky-notes";
export {
  cloneBoardObjects,
  getObjectBounds,
  getObjectIdsWithDependents,
  moveBoardObjects,
  removeBoardObjects,
  reorderBoardObjects,
  resizeBoardObject,
  updateObjectWaypoints,
  type BoardBounds
} from "./object-operations";
export {
  WhiteboardCanvas,
  WorkspaceCanvasStage,
  WorkspaceDialogs,
  WorkspaceFeedback,
  WorkspaceToolbar,
  type WhiteboardCanvasProps,
  type CollaboratorPresence,
  type WorkspaceDialogsProps,
  type WorkspaceToolbarProps
} from "./components";
export type { WhiteboardHostAdapter, WhiteboardHostContext } from "./host";
