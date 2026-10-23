"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type PointerEvent as ReactPointerEvent, type ReactElement, type SetStateAction } from "react";
import { Shapes } from "lucide-react";
import { LINE_WEIGHT_STROKE_WIDTHS, shapeConnectionCoordinate, SHAPE_CONNECTION_POINTS, type BoardObject, type Coordinate, type ShapeObject, type TextObject } from "..";
import { getObjectBounds, type BoardBounds } from "../object-operations";
import { coordinateFromPointer, geometryForShape, strokePointsAttribute } from "./canvas-geometry";
import { CanvasShape } from "./canvas-shape";
import { BASE_CANVAS_HEIGHT, BASE_CANVAS_WIDTH, ERASER_RADIUS, MAX_CANVAS_ZOOM, MIN_CANVAS_ZOOM, renderCanvasColor, type ActiveGesture, type CanvasBounds, type CanvasCamera, type PreviewLine, type TextClick, type WhiteboardCanvasProps } from "./canvas-model";
import { CanvasSelectionOverlays } from "./canvas-selection-overlays";
import { CanvasObjectRenderer } from "./canvas-object-renderer";
import { createCanvasSurfaceGestures } from "./canvas-surface-gestures";
import { createCanvasObjectInteractions } from "./canvas-object-interactions";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";
import { CanvasCameraControls } from "./canvas-camera-controls";
import { CanvasLinePreview } from "./canvas-line-preview";
import { createCanvasZoomHandler } from "./canvas-camera";
import { CanvasShapeDefinitions } from "./canvas-shape-definitions";
import { CanvasRulers } from "./canvas-rulers";
import { StickyNoteContextToolbar } from "./sticky-note-context-toolbar";

const WhiteboardCanvas = ({
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
  readOnly = false,
  collaborators = [],
  onCameraChange,
  onCursorChange,
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
  const canvasElementRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<CanvasBounds>({ width: BASE_CANVAS_WIDTH, height: BASE_CANVAS_HEIGHT });
  const [cameraState, setCameraState] = useState<Readonly<{ boardId: string; camera: CanvasCamera }>>({ boardId: "", camera: { x: 0, y: 0, zoom: 1 } });
  const [spacePressed, setSpacePressed] = useState(false);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [focusedObjectId, setFocusedObjectId] = useState<string | null>(null);
  const [previewPoints, setPreviewPoints] = useState<readonly Coordinate[] | null>(null);
  const [previewWipePath, setPreviewWipePath] = useState<readonly Coordinate[] | null>(null);
  const [previewShape, setPreviewShape] = useState<Readonly<{ shape: ShapeObject["shape"]; geometry: ShapeObject["geometry"] }> | null>(null);
  const [previewLine, setPreviewLine] = useState<PreviewLine | null>(null);
  const [resizeGeometry, setResizeGeometry] = useState<ShapeObject["geometry"] | null>(null);
  const [textPreviewGeometry, setTextPreviewGeometry] = useState<TextObject["geometry"] | null>(null);
  const [selectionBox, setSelectionBox] = useState<Readonly<{ origin: Coordinate; current: Coordinate }> | null>(null);
  const [objectResizePreview, setObjectResizePreview] = useState<Readonly<{ object: BoardObject; bounds: BoardBounds }> | null>(null);
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
  const defaultCamera = useMemo<CanvasCamera>(() => {
    if (board.templateId !== "blank" && board.templateId !== "" && board.objects.length > 0) {
      const objectBounds = board.objects.map(getObjectBounds);
      const content = {
        left: Math.min(...objectBounds.map(({ left }) => left)),
        top: Math.min(...objectBounds.map(({ top }) => top)),
        right: Math.max(...objectBounds.map(({ right }) => right)),
        bottom: Math.max(...objectBounds.map(({ bottom }) => bottom))
      };
      const contentWidth = Math.max(1, content.right - content.left);
      const contentHeight = Math.max(1, content.bottom - content.top);
      const fitZoom = Math.min(viewportSize.width * 0.75 / contentWidth, viewportSize.height * 0.75 / contentHeight);
      const zoom = Math.max(MIN_CANVAS_ZOOM, Math.min(MAX_CANVAS_ZOOM, fitZoom));
      const centerX = (content.left + content.right) / 2;
      const centerY = (content.top + content.bottom) / 2;
      return {
        x: centerX - viewportSize.width / zoom / 2,
        y: centerY - viewportSize.height / zoom / 2,
        zoom
      };
    }
    return {
      x: BASE_CANVAS_WIDTH / 2 - viewportSize.width / 2,
      y: BASE_CANVAS_HEIGHT / 2 - viewportSize.height / 2,
      zoom: 1
    };
  }, [board.objects, board.templateId, viewportSize.height, viewportSize.width]);
  const camera = cameraState.boardId === board.id ? cameraState.camera : defaultCamera;
  const setCamera = useCallback<Dispatch<SetStateAction<CanvasCamera>>>((nextCamera) => {
    setCameraState((current) => {
      const currentCamera = current.boardId === board.id ? current.camera : defaultCamera;
      return {
        boardId: board.id,
        camera: typeof nextCamera === "function" ? nextCamera(currentCamera) : nextCamera
      };
    });
  }, [board.id, defaultCamera]);
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

  useEffect(() => {
    const canvas = canvasElementRef.current;
    if (canvas === null) return;
    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry === undefined) return;
      const nextSize = {
        width: Math.max(1, Math.round(entry.contentRect.width - 21)),
        height: Math.max(1, Math.round(entry.contentRect.height - 14))
      };
      setViewportSize((current) => current.width === nextSize.width && current.height === nextSize.height ? current : nextSize);
    });
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    onCameraChange?.(camera);
  }, [camera, onCameraChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, [role='textbox']"))) return;
      if (event.code === "Space") {
        event.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (event: KeyboardEvent): void => {
      if (event.code === "Space") setSpacePressed(false);
    };
    const handleWindowBlur = (): void => setSpacePressed(false);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleWindowBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleWindowBlur);
    };
  }, []);

  useEffect(() => {
    if (selectedTool !== "select") previousTextClickRef.current = null;
  }, [selectedTool]);

  const gestureDependencies: CanvasGestureDependencies = {
    board: { board, shapes },
    view: { bounds: canvasBounds, camera, setCamera, selectedTool, selectedShapeId, selectedObjectIds, spacePressed },
    style: { penColor, penLineWeight, shapeStrokeColor, shapeLineWeight, shapeFill, lineColor, lineLineWeight, connectorRouting, lineStartArrow, lineEndArrow },
    state: {
      activeGestureRef, previousTextClickRef, pointsRef, eraserPathRef,
      setPreviewPoints, setPreviewWipePath, setPreviewShape, setPreviewLine,
      setResizeGeometry, setTextPreviewGeometry, setSelectionBox, setObjectResizePreview
    },
    callbacks: {
      onLineCommit, onStrokeCommit, onEraseCommit, onShapeCommit, onStickyNoteCreate, onShapeGeometryChange,
      onShapeSelect, onSelectionChange, onObjectsMove, onObjectResize, onTextCreate,
      onTextSelect, onTextEditStart, onTextGeometryChange, onUpdateWaypoints
    }
  };
  // eslint-disable-next-line react-hooks/refs -- factories capture refs and read them only inside pointer event handlers.
  const surfaceGestures = createCanvasSurfaceGestures(gestureDependencies);
  // eslint-disable-next-line react-hooks/refs -- factories capture refs and read them only inside pointer event handlers.
  const objectInteractions = createCanvasObjectInteractions(gestureDependencies);
  const { cancelGesture, commitQuickConnector,
    continueGesture, finishGesture, startDirectionalConnector, startGesture, startPanGesture,
    startWaypointDrag, startMidpointDrag, deleteWaypoint } = surfaceGestures;
  const changeZoom = createCanvasZoomHandler(canvasBounds, setCamera);
  useEffect(() => {
    const handleZoomShortcut = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select, [role='textbox']"))) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key === "+" || event.key === "=" || event.code === "NumpadAdd") {
        event.preventDefault();
        changeZoom(1.25);
      } else if (event.key === "-" || event.key === "_" || event.code === "NumpadSubtract") {
        event.preventDefault();
        changeZoom(0.8);
      }
    };
    window.addEventListener("keydown", handleZoomShortcut);
    return () => window.removeEventListener("keydown", handleZoomShortcut);
  }, [changeZoom]);
  const { handleOtherObjectPointerDown, handleShapePointerDown, handleTextPointerDown,
    startOtherObjectResize, startResize } = objectInteractions;
  const handleSurfacePointerMove = (event: ReactPointerEvent<SVGSVGElement>): void => {
    onCursorChange?.(coordinateFromPointer(event));
    continueGesture(event);
  };
  const handleSurfacePointerLeave = (): void => onCursorChange?.(null);
  return (
    <div
      className="wb-canvas"
      role="region"
      aria-label={`Graph-paper canvas with ${board.objects.length} board objects`}
      ref={canvasElementRef}
    >
      {board.objects.length === 0 && previewPoints === null && (
        <div className="wb-canvas-empty">
          <span className="wb-empty-illustration" aria-hidden="true"><Shapes size={42} /></span>
          <strong>Your canvas is ready</strong>
        <p>Choose the pen, sticky note, text, or a shape tool to add content.</p>
        </div>
      )}
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
        <CanvasShapeDefinitions gridSpacing={board.canvas.gridSpacing} shapes={shapes} selectedShapeId={selectedShapeId} resizeGeometry={resizeGeometry} />
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
        {(selectedTool === "connector" || selectedTool === "connection") && shapes.flatMap((shape) =>
          SHAPE_CONNECTION_POINTS.map((connectionPoint) => {
            const point = shapeConnectionCoordinate(shape.geometry, connectionPoint, shape.shape);
            return (
              <circle
                aria-hidden="true"
                className="wb-connection-point"
                cx={point.x}
                cy={point.y}
                key={`${shape.id}-${connectionPoint}`}
                pointerEvents="none"
                r={5}
              />
            );
          })
        )}
        {previewPoints !== null && (
          <polyline
            fill="none"
            points={strokePointsAttribute(previewPoints.length === 1 ? [previewPoints[0]!, previewPoints[0]!] : previewPoints)}
            stroke={renderCanvasColor(penColor)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={LINE_WEIGHT_STROKE_WIDTHS[penLineWeight]}
            vectorEffect="non-scaling-stroke"
          />
        )}
        <CanvasLinePreview line={previewLine} />
        {previewShape !== null && (() => {
          const { geometry, shape } = previewShape;
          const common = { fill: shapeFill, stroke: renderCanvasColor(shapeStrokeColor, shapeFill), strokeWidth: LINE_WEIGHT_STROKE_WIDTHS[shapeLineWeight], vectorEffect: "non-scaling-stroke" as const };
          return <CanvasShape {...common} geometry={geometry} shape={shape} />;
        })()}
        {previewWipePath !== null && previewWipePath.length > 0 && (
          <g aria-hidden="true" pointerEvents="none">
            <polyline
              fill="none"
              points={strokePointsAttribute(previewWipePath)}
              stroke="#bf4b4b"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeOpacity={0.18}
              strokeWidth={ERASER_RADIUS * 2}
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={previewWipePath.at(-1)!.x}
              cy={previewWipePath.at(-1)!.y}
              fill="#ffffff"
              fillOpacity={0.45}
              r={ERASER_RADIUS}
              stroke="#bf4b4b"
              strokeWidth={1.5}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
        {!readOnly && (selectedTool === "select" || selectedTool === "waypoints") && <CanvasSelectionOverlays objects={board.objects} selected={selectedObjectIds} selectedShapeId={selectedShapeId} focusedObjectId={focusedObjectId} resizeGeometry={resizeGeometry} selectionBox={selectionBox} objectResizePreview={objectResizePreview} selectedObject={selectedObject} selectedShape={selectedShape} selectedGeometry={selectedGeometry} resizeHandleSize={resizeHandleSize} onOtherResizeStart={startOtherObjectResize} onShapeResizeStart={startResize} onWaypointPointerDown={startWaypointDrag} onMidpointPointerDown={startMidpointDrag} onWaypointDelete={deleteWaypoint} />}
        {!readOnly && selectedStickyNoteShape !== null && selectedStickyNoteText !== null && <StickyNoteContextToolbar
          onFillChange={onStickyNoteFillChange}
          onShapeChange={onStickyNoteShapeChange}
          onTextChange={onStickyNoteTextChange}
          shape={selectedStickyNoteShape}
          text={selectedStickyNoteText}
          zoom={camera.zoom}
          placement={selectedStickyNoteShape.geometry.y - camera.y > 112 / camera.zoom ? "above" : "below"}
        />}
        {collaborators.flatMap((participant) => {
          if (participant.cursor === null) return [];
          const { cursor, name, clientId } = participant;
          const color = ["#ff6b6b", "#42b883", "#7c6dfa", "#f59e0b", "#06b6d4", "#ec4899"][Math.abs(clientId) % 6] ?? "#7c6dfa";
          const labelWidth = Math.min(180, Math.max(54, name.length * 7 + 16));
          return [(
            <g aria-label={`${name} cursor`} key={`cursor-${clientId}`} pointerEvents="none" transform={`translate(${cursor.x} ${cursor.y}) scale(${1 / camera.zoom})`}>
              <path d="M 0 0 L 0 17 L 5 12 L 10 21 L 14 19 L 9 10 L 17 10 Z" fill={color} stroke="#ffffff" strokeWidth="1.5" />
              <rect fill={color} height="22" rx="5" width={labelWidth} x="15" y="12" />
              <text fill="#ffffff" fontSize="12" fontWeight="600" x="22" y="27">{name.slice(0, 24)}</text>
            </g>
          )];
        })}
      </svg>
    </div>
  );
};

export { WhiteboardCanvas };





