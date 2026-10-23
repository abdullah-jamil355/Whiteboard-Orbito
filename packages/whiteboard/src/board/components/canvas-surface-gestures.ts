import type { PointerEvent as ReactPointerEvent } from "react";
import { MAX_STROKE_POINT_COUNT, WHITEBOARD_PALETTE, snapConnectorEndpoint } from "..";
import { coordinateFromClientPosition, coordinateFromPointer, getDirectionalTarget, isLinearTool, movedBeyondThreshold, movedGeometry, shapeGeometryFromDrag } from "./canvas-geometry";
import { ERASER_RADIUS, MAX_ERASER_PATH_POINT_COUNT, MINIMUM_MOVE_DISTANCE } from "./canvas-model";
import { resizedObjectBounds, selectObjectsInBox } from "../object-operations";
import { resizedGeometry } from "./canvas-geometry";
import { createCanvasConnectorGestures } from "./canvas-connector-gestures";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";

export const createCanvasSurfaceGestures = (dependencies: CanvasGestureDependencies) => {
  const { board: { board, shapes } } = dependencies;
  const { bounds: canvasBounds, camera, setCamera, selectedTool, selectedObjectIds, spacePressed } = dependencies.view;
  const { penColor, penLineWeight, shapeStrokeColor, shapeLineWeight, shapeFill, lineColor, lineLineWeight, connectorRouting, lineStartArrow, lineEndArrow } = dependencies.style;
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
    onLineCommit,
    onStrokeCommit,
    onEraseCommit,
    onShapeCommit,
    onShapeGeometryChange,
    onShapeSelect,
    onSelectionChange,
    onObjectsMove,
    onObjectResize,
    onTextCreate,
    onStickyNoteCreate,
    onTextSelect,
    onTextGeometryChange
  } = dependencies.callbacks;
  const { commitQuickConnector, startDirectionalConnector } = createCanvasConnectorGestures(dependencies);


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
    const gesture = activeGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (gesture.kind === "pan") {
      const bounds = event.currentTarget.getBoundingClientRect();
      const worldPerPixelX = canvasBounds.width / gesture.camera.zoom / Math.max(1, bounds.width);
      const worldPerPixelY = canvasBounds.height / gesture.camera.zoom / Math.max(1, bounds.height);
      setCamera({ ...gesture.camera, x: gesture.camera.x - (event.clientX - gesture.origin.x) * worldPerPixelX, y: gesture.camera.y - (event.clientY - gesture.origin.y) * worldPerPixelY });
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
      return;
    }
    if (gesture.kind === "stroke") {
      appendPointerPoints(event);
    } else if (gesture.kind === "erase") {
      appendEraserPoints(event);
    } else if (gesture.kind === "line") {
      const end = snapConnectorEndpoint(current, shapes, 24, gesture.origin);
      const start = gesture.quickConnectDirection === undefined
        ? snapConnectorEndpoint(gesture.origin, shapes, 24, current)
        : gesture.start;
      const isConnection = gesture.tool === "connector" || gesture.tool === "connection";
      const isArrow = gesture.tool === "arrow";
      setPreviewLine({
        type: isConnection ? "connector" : isArrow ? "arrow" : "line",
        start,
        end,
        color: lineColor,
        lineWeight: lineLineWeight,
        startArrow: lineStartArrow ?? "none",
        endArrow: lineEndArrow && lineEndArrow !== "none" ? lineEndArrow : (isConnection || isArrow ? "block" : "none"),
        routing: isConnection ? connectorRouting : "straight"
      });
    } else if (gesture.kind === "shape") {
      setPreviewShape({ shape: gesture.shape, geometry: shapeGeometryFromDrag(gesture.shape, gesture.origin, current, canvasBounds) });
    } else if (gesture.kind === "move") {
      if (movedBeyondThreshold(gesture.origin, current)) previousTextClickRef.current = null;
      setResizeGeometry(movedBeyondThreshold(gesture.origin, current)
        ? movedGeometry(gesture.shape.geometry, gesture.origin, current, canvasBounds)
        : gesture.shape.geometry);
    } else if (gesture.kind === "move-text") {
      if (movedBeyondThreshold(gesture.origin, current)) previousTextClickRef.current = null;
      setTextPreviewGeometry(movedBeyondThreshold(gesture.origin, current)
        ? movedGeometry(gesture.text.geometry, gesture.origin, current, canvasBounds)
        : gesture.text.geometry);
    } else if (gesture.kind === "move-objects") {
      setSelectionBox(null);
    } else if (gesture.kind === "box-select") {
      setSelectionBox({ origin: gesture.origin, current });
    } else if (gesture.kind === "resize-object") {
      setObjectResizePreview({ object: gesture.object, bounds: resizedObjectBounds(gesture.bounds, gesture.handle, current, canvasBounds) });
    } else {
      const geometry = resizedGeometry(gesture.shape, gesture.handle, gesture.origin, current, canvasBounds);
      setResizeGeometry(geometry);
    }
  };

  const finishGesture = (event: ReactPointerEvent<SVGSVGElement>): void => {
    const gesture = activeGestureRef.current;
    if (gesture?.pointerId !== event.pointerId) return;
    event.preventDefault();
    if (gesture.kind === "pan") {
      const bounds = event.currentTarget.getBoundingClientRect();
      const worldPerPixelX = canvasBounds.width / gesture.camera.zoom / Math.max(1, bounds.width);
      const worldPerPixelY = canvasBounds.height / gesture.camera.zoom / Math.max(1, bounds.height);
      setCamera({ ...gesture.camera, x: gesture.camera.x - (event.clientX - gesture.origin.x) * worldPerPixelX, y: gesture.camera.y - (event.clientY - gesture.origin.y) * worldPerPixelY });
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
    if (gesture.kind === "stroke") {
      appendPointerPoints(event);
      const points = pointsRef.current;
      if (points.length === 1) points.push(points[0]!);
      if (points.length > 0) {
        onStrokeCommit({ points: [...points], color: penColor, lineWeight: penLineWeight });
      }
      pointsRef.current = [];
      setPreviewPoints(null);
    } else if (gesture.kind === "erase") {
      appendEraserPoints(event);
      const transform = event.currentTarget.getScreenCTM();
      const screenScale = transform === null ? 1 : Math.hypot(transform.a, transform.b);
      if (eraserPathRef.current.length > 0) onEraseCommit([...eraserPathRef.current], ERASER_RADIUS / Math.max(screenScale, 0.01));
      eraserPathRef.current = [];
      setPreviewWipePath(null);
    } else if (gesture.kind === "line") {
      const start = gesture.quickConnectDirection === undefined
        ? snapConnectorEndpoint(gesture.origin, shapes, 24, current)
        : gesture.start;
      let end = snapConnectorEndpoint(current, shapes, 24, gesture.origin);
      if (gesture.quickConnectDirection !== undefined && !movedBeyondThreshold(gesture.origin, current)) {
        const sourceShape = shapes.find((shape) => shape.id === start.shapeId);
        const quickTarget = sourceShape === undefined ? null : getDirectionalTarget(sourceShape, shapes, gesture.quickConnectDirection);
        if (quickTarget !== null) end = quickTarget;
      }
      const hasValidAttachment = gesture.quickConnectDirection === undefined
        || (start.shapeId !== undefined && end.shapeId !== undefined && start.shapeId !== end.shapeId);
      if (hasValidAttachment && Math.hypot(end.x - start.x, end.y - start.y) >= MINIMUM_MOVE_DISTANCE) {
        const isConnection = gesture.tool === "connector" || gesture.tool === "connection";
        const isArrow = gesture.tool === "arrow";
        const startArrow = lineStartArrow ?? "none";
        const endArrow = lineEndArrow && lineEndArrow !== "none" ? lineEndArrow : (isConnection || isArrow ? "block" : "none");
        if (isConnection) {
          onLineCommit({ type: "connector", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow, endArrow, routing: connectorRouting, waypoints: [] });
        } else if (isArrow) {
          onLineCommit({ type: "arrow", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow, endArrow, routing: "straight", waypoints: [] });
        } else {
          onLineCommit({ type: "line", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow, endArrow, routing: "straight", waypoints: [] });
        }
      }
      setPreviewLine(null);
    } else if (gesture.kind === "shape") {
      const geometry = shapeGeometryFromDrag(gesture.shape, gesture.origin, current, canvasBounds);
      onShapeCommit({
        shape: gesture.shape,
        geometry,
        style: {
          fill: shapeFill,
          stroke: shapeStrokeColor,
          lineWeight: shapeLineWeight
        }
      });
      setPreviewShape(null);
    } else if (gesture.kind === "move") {
      if (movedBeyondThreshold(gesture.origin, current)) {
        onShapeGeometryChange(gesture.shape.id, movedGeometry(gesture.shape.geometry, gesture.origin, current, canvasBounds));
      }
      setResizeGeometry(null);
    } else if (gesture.kind === "move-text") {
      if (movedBeyondThreshold(gesture.origin, current)) {
        onTextGeometryChange(gesture.text.id, movedGeometry(gesture.text.geometry, gesture.origin, current, canvasBounds));
      }
      setTextPreviewGeometry(null);
    } else if (gesture.kind === "move-objects") {
      if (movedBeyondThreshold(gesture.origin, current)) onObjectsMove(gesture.ids, current.x - gesture.origin.x, current.y - gesture.origin.y);
      setSelectionBox(null);
    } else if (gesture.kind === "box-select") {
      const boxedIds = selectObjectsInBox(board.objects, gesture.origin, current);
      const ids = gesture.additive
        ? [...new Set([...selectedObjectIds, ...boxedIds])]
        : boxedIds;
      onSelectionChange(movedBeyondThreshold(gesture.origin, current) ? ids : gesture.additive ? selectedObjectIds : []);
      setSelectionBox(null);
    } else if (gesture.kind === "resize-object") {
      onObjectResize(gesture.object.id, resizedObjectBounds(gesture.bounds, gesture.handle, current, canvasBounds));
      setObjectResizePreview(null);
    } else if (gesture.kind === "resize") {
      onShapeGeometryChange(gesture.shape.id, resizedGeometry(gesture.shape, gesture.handle, gesture.origin, current, canvasBounds));
      setResizeGeometry(null);
    }
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

  const startWaypointDrag = (
    event: ReactPointerEvent<SVGElement>,
    object: import("..").LineObject | import("..").ConnectorObject,
    index: number
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);
    activeGestureRef.current = {
      kind: "move-waypoint",
      pointerId: event.pointerId,
      objectId: object.id,
      waypointIndex: index,
      origin
    };
    surface.setPointerCapture(event.pointerId);
  };

  const startMidpointDrag = (
    event: ReactPointerEvent<SVGElement>,
    object: import("..").LineObject | import("..").ConnectorObject,
    segmentIndex: number,
    point: import("..").Coordinate
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const existing = object.waypoints ?? [];
    const newWaypoints = [...existing.slice(0, segmentIndex), point, ...existing.slice(segmentIndex)];
    dependencies.callbacks.onUpdateWaypoints?.(object.id, newWaypoints);
    activeGestureRef.current = {
      kind: "move-waypoint",
      pointerId: event.pointerId,
      objectId: object.id,
      waypointIndex: segmentIndex,
      origin: point
    };
    surface.setPointerCapture(event.pointerId);
  };

  const deleteWaypoint = (
    object: import("..").LineObject | import("..").ConnectorObject,
    index: number
  ): void => {
    const existing = object.waypoints ?? [];
    const newWaypoints = existing.filter((_, i) => i !== index);
    dependencies.callbacks.onUpdateWaypoints?.(object.id, newWaypoints);
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



