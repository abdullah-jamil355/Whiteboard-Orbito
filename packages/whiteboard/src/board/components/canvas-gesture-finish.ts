import type { Coordinate } from "..";
import { getDirectionalTarget, movedBeyondThreshold, movedGeometry, resizedGeometry, shapeGeometryFromDrag } from "./canvas-geometry";
import { ERASER_RADIUS, MINIMUM_MOVE_DISTANCE, type ActiveGesture } from "./canvas-model";
import { resizedObjectBounds, selectObjectsInBox } from "../object-operations";
import { snapConnectorEndpoint } from "../board-connection";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";

export const handleGestureFinish = (
  gesture: ActiveGesture,
  current: Coordinate,
  screenScale: number,
  dependencies: CanvasGestureDependencies
): void => {
  const { board: { board, shapes } } = dependencies;
  const { bounds: canvasBounds, selectedObjectIds } = dependencies.view;
  const { penColor, penLineWeight, shapeStrokeColor, shapeLineWeight, shapeFill, lineColor, lineLineWeight, connectorRouting, lineStartArrow, lineEndArrow } = dependencies.style;
  const { pointsRef, eraserPathRef, setPreviewPoints, setPreviewWipePath, setPreviewShape, setPreviewLine, setResizeGeometry, setTextPreviewGeometry, setSelectionBox, setObjectResizePreview } = dependencies.state;
  const { onLineCommit, onStrokeCommit, onEraseCommit, onShapeCommit, onShapeGeometryChange, onSelectionChange, onObjectsMove, onObjectResize, onTextGeometryChange } = dependencies.callbacks;

  if (gesture.kind === "stroke") {
    const points = pointsRef.current;
    if (points.length === 1) points.push(points[0]!);
    if (points.length > 0) {
      onStrokeCommit({ points: [...points], color: penColor, lineWeight: penLineWeight });
    }
    pointsRef.current = [];
    setPreviewPoints(null);
  } else if (gesture.kind === "erase") {
    if (eraserPathRef.current.length > 0) {
      onEraseCommit([...eraserPathRef.current], ERASER_RADIUS / Math.max(screenScale, 0.01));
    }
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
      const startArr = lineStartArrow ?? "none";
      const endArr = lineEndArrow && lineEndArrow !== "none" ? lineEndArrow : (isConnection || isArrow ? "block" : "none");
      if (isConnection) {
        onLineCommit({ type: "connector", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow: startArr, endArrow: endArr, routing: connectorRouting, waypoints: [] });
      } else if (isArrow) {
        onLineCommit({ type: "arrow", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow: startArr, endArrow: endArr, routing: "straight", waypoints: [] });
      } else {
        onLineCommit({ type: "line", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow: startArr, endArrow: endArr, routing: "straight", waypoints: [] });
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
};
