import type { PointerEvent as ReactPointerEvent } from "react";
import { MAX_STROKE_POINT_COUNT, WHITEBOARD_PALETTE, snapConnectorEndpoint } from "..";
import { coordinateFromClientPosition, coordinateFromPointer, isLinearTool, shapeGeometryFromDrag } from "./canvas-geometry";
import { MAX_ERASER_PATH_POINT_COUNT } from "./canvas-model";
import { createCanvasConnectorGestures } from "./canvas-connector-gestures";
import { createCanvasWaypointGestures } from "./canvas-gesture-waypoints";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";
import { handleGestureFinish } from "./canvas-gesture-finish";
import { handleGestureMove } from "./canvas-gesture-move";

export const createCanvasSurfaceGestures = (dependencies: CanvasGestureDependencies) => {
  const { board: { board, shapes } } = dependencies;
  const { bounds: canvasBounds, camera, setCamera, selectedTool, spacePressed } = dependencies.view;
  const { lineColor, lineLineWeight, connectorRouting, lineStartArrow, lineEndArrow } = dependencies.style;
  const {
    activeGestureRef,
    previousTextClickRef,
    pointsRef,
    eraserPathRef,
    setPreviewPoints,
    setPreviewWipePath,
    setPreviewShape,
    setPreviewLine,
    setResizeGeometry,
    setTextPreviewGeometry,
    setSelectionBox,
    setObjectResizePreview
  } = dependencies.state;
  const {
    onShapeSelect,
    onSelectionChange,
    onTextCreate,
    onStickyNoteCreate,
    onTextSelect
  } = dependencies.callbacks;
  const { commitQuickConnector, startDirectionalConnector } = createCanvasConnectorGestures(dependencies);
  const { deleteWaypoint, startMidpointDrag, startWaypointDrag } = createCanvasWaypointGestures(dependencies);

  const appendPointerPoints = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples) {
      if (pointsRef.current.length >= MAX_STROKE_POINT_COUNT) break;
      pointsRef.current.push(coordinateFromClientPosition(sample.clientX, sample.clientY, event.currentTarget));
    }
    setPreviewPoints([...pointsRef.current]);
  };

  const appendEraserPoints = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const samples = event.nativeEvent.getCoalescedEvents?.() ?? [event.nativeEvent];
    for (const sample of samples) {
      if (eraserPathRef.current.length >= MAX_ERASER_PATH_POINT_COUNT) break;
      const point = coordinateFromClientPosition(sample.clientX, sample.clientY, event.currentTarget);
      const previous = eraserPathRef.current.at(-1);
      if (previous === undefined || Math.hypot(point.x - previous.x, point.y - previous.y) >= 2) {
        eraserPathRef.current.push(point);
      }
    }
    setPreviewWipePath([...eraserPathRef.current]);
  };

  const startPanGesture = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const isTouchPan = event.pointerType === "touch" && event.target === event.currentTarget;
    if ((!spacePressed && !isTouchPan) || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    activeGestureRef.current = {
      kind: "pan",
      pointerId: event.pointerId,
      origin: { x: event.clientX, y: event.clientY },
      camera
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const startGesture = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    previousTextClickRef.current = null;
    const origin = coordinateFromPointer(event);
    if (selectedTool === "text") {
      const textId = onTextCreate({
        geometry: { x: origin.x, y: origin.y, width: 200, height: 72 },
        text: "",
        alignment: "left",
        fontSize: 16,
        bold: false,
        color: WHITEBOARD_PALETTE[0].value
      });
      onTextSelect(textId);
      return;
    }
    if (selectedTool === "sticky-note") {
      onStickyNoteCreate(origin);
      return;
    }
    if (selectedTool === "eraser") {
      onShapeSelect(null);
      onTextSelect(null);
      activeGestureRef.current = { kind: "erase", pointerId: event.pointerId };
      eraserPathRef.current = [origin];
      setPreviewWipePath([...eraserPathRef.current]);
    } else if (selectedTool === "pen") {
      activeGestureRef.current = { kind: "stroke", pointerId: event.pointerId };
      pointsRef.current = [origin];
      setPreviewPoints([...pointsRef.current]);
    } else if (isLinearTool(selectedTool)) {
      onShapeSelect(null);
      onTextSelect(null);
      if (selectedTool === "waypoints") {
        onSelectionChange([]);
        return;
      }
      const start = snapConnectorEndpoint(origin, shapes);
      const isConnection = selectedTool === "connector" || selectedTool === "connection";
      const isArrow = selectedTool === "arrow";
      const actualTool = isConnection ? "connector" : isArrow ? "arrow" : "line";
      activeGestureRef.current = { kind: "line", pointerId: event.pointerId, tool: actualTool, start, origin };
      setPreviewLine({
        type: actualTool,
        start,
        end: origin,
        color: lineColor,
        lineWeight: lineLineWeight,
        startArrow: lineStartArrow ?? "none",
        endArrow: lineEndArrow && lineEndArrow !== "none" ? lineEndArrow : (isConnection || isArrow ? "block" : "none"),
        routing: isConnection ? connectorRouting : "straight"
      });
    } else if (selectedTool !== "select") {
      activeGestureRef.current = { kind: "shape", pointerId: event.pointerId, shape: selectedTool, origin };
      onShapeSelect(null);
      setPreviewShape({ shape: selectedTool, geometry: shapeGeometryFromDrag(selectedTool, origin, origin, canvasBounds) });
    } else {
      activeGestureRef.current = { kind: "box-select", pointerId: event.pointerId, origin, additive: event.shiftKey };
      setSelectionBox({ origin, current: origin });
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const continueGesture = (event: ReactPointerEvent<SVGSVGElement>): void => {
    handleGestureMove(event, dependencies, appendPointerPoints, appendEraserPoints);
  };

  const finishGesture = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const gesture = activeGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (gesture.kind === "pan") {
      const bounds = event.currentTarget.getBoundingClientRect();
      const worldPerPixelX = canvasBounds.width / gesture.camera.zoom / Math.max(1, bounds.width);
      const worldPerPixelY = canvasBounds.height / gesture.camera.zoom / Math.max(1, bounds.height);
      setCamera({
        ...gesture.camera,
        x: gesture.camera.x - (event.clientX - gesture.origin.x) * worldPerPixelX,
        y: gesture.camera.y - (event.clientY - gesture.origin.y) * worldPerPixelY
      });
      activeGestureRef.current = null;
      return;
    }
    const current = coordinateFromPointer(event);
    if (gesture.kind === "move-waypoint") {
      const targetObj = board.objects.find((item) => item.id === gesture.objectId);
      if (targetObj && (targetObj.type === "connector" || targetObj.type === "line" || targetObj.type === "arrow")) {
        const nextWaypoints = [...(targetObj.waypoints ?? [])];
        nextWaypoints[gesture.waypointIndex] = current;
        dependencies.callbacks.onUpdateWaypoints?.(gesture.objectId, nextWaypoints);
      }
      activeGestureRef.current = null;
      return;
    }
    const transform = event.currentTarget.getScreenCTM();
    const screenScale = transform === null ? 1 : Math.hypot(transform.a, transform.b);
    handleGestureFinish(gesture, current, screenScale, dependencies);
    activeGestureRef.current = null;
  };

  const cancelGesture = (event: ReactPointerEvent<SVGSVGElement>): void => {
    if (activeGestureRef.current?.pointerId !== event.pointerId) return;
    activeGestureRef.current = null;
    pointsRef.current = [];
    eraserPathRef.current = [];
    setPreviewPoints(null);
    setPreviewWipePath(null);
    setPreviewShape(null);
    setPreviewLine(null);
    setResizeGeometry(null);
    setTextPreviewGeometry(null);
    setSelectionBox(null);
    setObjectResizePreview(null);
  };

  return {
    appendEraserPoints,
    appendPointerPoints,
    cancelGesture,
    commitQuickConnector,
    continueGesture,
    deleteWaypoint,
    finishGesture,
    startDirectionalConnector,
    startGesture,
    startMidpointDrag,
    startPanGesture,
    startWaypointDrag
  };
};

export const useCanvasSurfaceGestures = createCanvasSurfaceGestures;
