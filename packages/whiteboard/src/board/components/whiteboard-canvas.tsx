"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import {
  type BoardObject,
  type Coordinate,
  type ShapeObject,
  type TextObject
} from "..";
import { coordinateFromPointer, geometryForShape } from "./canvas-geometry.js";
import type { BoardBounds } from "../object-operations.js";
import {
  type ActiveGesture,
  type PreviewLine,
  type TextClick,
  type WhiteboardCanvasProps
} from "./canvas-model.js";
import { CanvasRulers } from "./canvas-rulers.js";
import { CanvasCameraControls } from "./canvas-camera-controls.js";
import { CanvasShapeDefinitions } from "./canvas-shape-definitions.js";
import { CanvasObjectRenderer } from "./canvas-object-renderer.js";
import { CanvasSelectionOverlays } from "./canvas-selection-overlays.js";
import { StickyNoteContextToolbar } from "./sticky-note-context-toolbar.js";
import { createCanvasSurfaceGestures } from "./canvas-surface-gestures.js";
import { createCanvasObjectInteractions } from "./canvas-object-interactions.js";
import { useCanvasCamera } from "./use-canvas-camera.js";
import { CanvasCollaboratorCursors } from "./canvas-collaborator-cursors.js";
import { CanvasDrawingPreviews } from "./canvas-drawing-previews.js";
import { CanvasEmptyState } from "./canvas-empty-state.js";
import { CanvasConnectionPoints } from "./canvas-connection-points.js";

export const WhiteboardCanvas = ({
  board,
  selectedTool,
  selectedShapeId,
  selectedTextId,
  selectedObjectIds,
  editingTextId,
  penColor,
  penLineWeight,
  shapeStrokeColor,
  shapeLineWeight,
  shapeFill,
  lineColor,
  lineLineWeight,
  connectorRouting,
  lineStartArrow,
  lineEndArrow,
  collaborators = [],
  readOnly = false,
  onCursorChange,
  onCameraChange,
  onLineCommit,
  onStrokeCommit,
  onEraseCommit,
  onShapeCommit,
  onStickyNoteCreate,
  onStickyNoteFillChange,
  onStickyNoteShapeChange,
  onStickyNoteTextChange,
  onShapeGeometryChange,
  onShapeSelect,
  onSelectionChange,
  onObjectsMove,
  onObjectResize,
  onTextCreate,
  onTextSelect,
  onTextEditStart,
  onTextEditFinish,
  onTextChange,
  onTextGeometryChange,
  onUpdateWaypoints
}: WhiteboardCanvasProps): ReactElement => {
  const {
    camera,
    canvasElementRef,
    defaultCamera,
    setCamera,
    spacePressed,
    viewportSize
  } = useCanvasCamera({ board, onCameraChange });

  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [focusedObjectId, setFocusedObjectId] = useState<string | null>(null);
  const [previewPoints, setPreviewPoints] = useState<readonly Coordinate[] | null>(null);
  const [previewWipePath, setPreviewWipePath] = useState<readonly Coordinate[] | null>(null);
  const [previewShape, setPreviewShape] = useState<Readonly<{ geometry: ShapeObject["geometry"]; shape: ShapeObject["shape"] }> | null>(null);
  const [previewLine, setPreviewLine] = useState<PreviewLine | null>(null);
  const [resizeGeometry, setResizeGeometry] = useState<ShapeObject["geometry"] | null>(null);
  const [textPreviewGeometry, setTextPreviewGeometry] = useState<TextObject["geometry"] | null>(null);
  const [selectionBox, setSelectionBox] = useState<Readonly<{ current: Coordinate; origin: Coordinate }> | null>(null);
  const [objectResizePreview, setObjectResizePreview] = useState<Readonly<{ bounds: BoardBounds; object: BoardObject }> | null>(null);

  const activeGestureRef = useRef<ActiveGesture | null>(null);
  const previousTextClickRef = useRef<TextClick | null>(null);
  const pointsRef = useRef<Coordinate[]>([]);
  const eraserPathRef = useRef<Coordinate[]>([]);

  const shapes = board.objects.filter((object): object is ShapeObject => object.type === "shape");
  const selectedNoteTextObject = board.objects.find((object): object is TextObject => object.type === "text" && object.id === selectedTextId && object.parentShapeId !== undefined);
  const selectedNoteShapeId = shapes.find((shape) => shape.id === selectedShapeId && shape.stickyNote === true)?.id ?? selectedNoteTextObject?.parentShapeId;
  const selectedStickyNoteShape = selectedTool === "select" && selectedNoteShapeId !== undefined
    ? shapes.find((shape) => shape.id === selectedNoteShapeId && shape.stickyNote === true) ?? null
    : null;
  const selectedStickyNoteText = selectedStickyNoteShape === null ? null
    : board.objects.find((object): object is TextObject => object.type === "text" && object.parentShapeId === selectedStickyNoteShape.id) ?? null;

  const canvasBounds = viewportSize;
  const visibleCanvasBounds = { width: canvasBounds.width / camera.zoom, height: canvasBounds.height / camera.zoom };
  const resizeHandleSize = Math.max(12, 16 * visibleCanvasBounds.width / viewportSize.width);
  const renderOrder = board.objects;
  const selectedShape = shapes.find((shape) => shape.id === selectedShapeId) ?? null;
  const selectedObject = selectedObjectIds.length === 1
    ? board.objects.find((object) => object.id === selectedObjectIds[0]) ?? null
    : null;
  const selectedGeometry = selectedShape === null
    ? null
    : geometryForShape(selectedShape, resizeGeometry ?? selectedShape.geometry);

  const focusBoardObject = (objectId: string): void => {
    setFocusedObjectId(objectId);
    onSelectionChange([objectId]);
  };

  const gestureDependencies = {
    board: { board, shapes },
    view: { bounds: canvasBounds, camera, selectedObjectIds, selectedShapeId, selectedTool, setCamera, spacePressed },
    style: { connectorRouting, lineColor, lineEndArrow, lineLineWeight, lineStartArrow, penColor, penLineWeight, shapeFill, shapeLineWeight, shapeStrokeColor },
    state: { activeGestureRef, eraserPathRef, pointsRef, previousTextClickRef, setObjectResizePreview, setPreviewLine, setPreviewPoints, setPreviewShape, setPreviewWipePath, setResizeGeometry, setSelectionBox, setTextPreviewGeometry },
    callbacks: { onEraseCommit, onLineCommit, onObjectResize, onObjectsMove, onSelectionChange, onShapeCommit, onShapeGeometryChange, onShapeSelect, onStickyNoteCreate, onStrokeCommit, onTextChange, onTextCreate, onTextEditFinish, onTextEditStart, onTextGeometryChange, onTextSelect, onUpdateWaypoints }
  };

  const {
    cancelGesture, commitQuickConnector, continueGesture, deleteWaypoint,
    finishGesture, startDirectionalConnector, startGesture, startMidpointDrag,
    startPanGesture, startWaypointDrag
  } = createCanvasSurfaceGestures(gestureDependencies);

  const {
    handleOtherObjectPointerDown,
    handleShapePointerDown,
    handleTextPointerDown,
    startOtherObjectResize,
    startResize
  } = createCanvasObjectInteractions(gestureDependencies);

  const handleSurfacePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    continueGesture(event);
    if (onCursorChange !== undefined) {
      const { x, y } = coordinateFromPointer(event);
      onCursorChange({ x, y });
    }
  };

  const handleSurfacePointerLeave = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (activeGestureRef.current === null) onCursorChange?.(null);
    continueGesture(event);
  };

  return (
    <div
      aria-label={`Graph-paper canvas with ${board.objects.length} board objects`}
      className={`wb-canvas ${spacePressed ? "cursor-grab" : ""}`}
      ref={canvasElementRef}
      role="region"
      tabIndex={-1}
    >
      <CanvasEmptyState show={board.objects.length === 0 && previewPoints === null} />
      <CanvasRulers camera={camera} height={viewportSize.height} width={viewportSize.width} />
      <CanvasCameraControls onFit={() => setCamera(defaultCamera)} />
      <svg
        aria-label="Whiteboard drawing surface"
        className={`wb-drawing-surface wb-drawing-surface-${selectedTool}${spacePressed ? " wb-drawing-surface-pan-ready" : ""}`}
        onPointerCancel={cancelGesture}
        onPointerDownCapture={startPanGesture}
        onPointerDown={readOnly ? undefined : startGesture}
        onPointerLeave={handleSurfacePointerLeave}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={finishGesture}
        preserveAspectRatio="none"
        role="application"
        tabIndex={0}
        viewBox={`${camera.x} ${camera.y} ${visibleCanvasBounds.width} ${visibleCanvasBounds.height}`}
      >
        <CanvasShapeDefinitions gridSpacing={board.canvas.gridSpacing} resizeGeometry={resizeGeometry} selectedShapeId={selectedShapeId} shapes={shapes} />
        <rect fill="url(#wb-graph-paper)" height={visibleCanvasBounds.height} pointerEvents="none" width={visibleCanvasBounds.width} x={camera.x} y={camera.y} />
        <g pointerEvents={readOnly ? "none" : "auto"}>
          {renderOrder.map((object) => (
            <CanvasObjectRenderer
              editingTextId={editingTextId}
              hoveredShapeId={hoveredShapeId}
              key={object.id}
              object={object}
              onFocusObject={focusBoardObject}
              onHoverShape={setHoveredShapeId}
              onObjectPointerDown={handleOtherObjectPointerDown}
              onQuickConnectorCommit={commitQuickConnector}
              onQuickConnectorStart={startDirectionalConnector}
              onShapePointerDown={handleShapePointerDown}
              onTextChange={onTextChange}
              onTextEditFinish={onTextEditFinish}
              onTextEditStart={onTextEditStart}
              onTextPointerDown={handleTextPointerDown}
              onTextSelect={onTextSelect}
              resizeGeometry={resizeGeometry}
              selectedShapeId={selectedShapeId}
              selectedTextId={selectedTextId}
              selectedTool={selectedTool}
              shapes={shapes}
              textPreviewGeometry={textPreviewGeometry}
            />
          ))}
        </g>
        <CanvasConnectionPoints
          shapes={shapes}
          visible={selectedTool === "connector" || selectedTool === "connection"}
        />
        <CanvasDrawingPreviews
          penColor={penColor}
          penLineWeight={penLineWeight}
          previewLine={previewLine}
          previewPoints={previewPoints}
          previewShape={previewShape}
          previewWipePath={previewWipePath}
          shapeFill={shapeFill}
          shapeLineWeight={shapeLineWeight}
          shapeStrokeColor={shapeStrokeColor}
        />
        {!readOnly && (selectedTool === "select" || selectedTool === "waypoints") && (
          <CanvasSelectionOverlays
            focusedObjectId={focusedObjectId}
            objectResizePreview={objectResizePreview}
            objects={board.objects}
            onMidpointPointerDown={startMidpointDrag}
            onOtherResizeStart={startOtherObjectResize}
            onShapeResizeStart={startResize}
            onWaypointDelete={deleteWaypoint}
            onWaypointPointerDown={startWaypointDrag}
            resizeGeometry={resizeGeometry}
            resizeHandleSize={resizeHandleSize}
            selected={selectedObjectIds}
            selectedGeometry={selectedGeometry}
            selectedObject={selectedObject}
            selectedShape={selectedShape}
            selectedShapeId={selectedShapeId}
            selectionBox={selectionBox}
          />
        )}
        {!readOnly && selectedStickyNoteShape !== null && selectedStickyNoteText !== null && (
          <StickyNoteContextToolbar
            onFillChange={onStickyNoteFillChange}
            onShapeChange={onStickyNoteShapeChange}
            onTextChange={onStickyNoteTextChange}
            placement={selectedStickyNoteShape.geometry.y - camera.y > 112 / camera.zoom ? "above" : "below"}
            shape={selectedStickyNoteShape}
            text={selectedStickyNoteText}
            zoom={camera.zoom}
          />
        )}
        <CanvasCollaboratorCursors collaborators={collaborators} zoom={camera.zoom} />
      </svg>
    </div>
  );
};
