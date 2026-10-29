import type { PointerEvent as ReactPointerEvent } from "react";
import { snapConnectorEndpoint } from "..";
import { coordinateFromPointer, movedBeyondThreshold, movedGeometry, shapeGeometryFromDrag, resizedGeometry } from "./canvas-geometry";
import { resizedObjectBounds } from "../object-operations";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";

export const handleGestureMove = (
  event: ReactPointerEvent<SVGSVGElement>,
  dependencies: CanvasGestureDependencies,
  appendPointerPoints: (event: ReactPointerEvent<SVGSVGElement>) => void,
  appendEraserPoints: (event: ReactPointerEvent<SVGSVGElement>) => void
): void => {
  const { board: { board, shapes } } = dependencies;
  const { bounds: canvasBounds, setCamera } = dependencies.view;
  const { lineColor, lineLineWeight, connectorRouting, lineStartArrow, lineEndArrow } = dependencies.style;
  const {
    activeGestureRef,
    previousTextClickRef,
    setPreviewShape,
    setPreviewLine,
    setResizeGeometry,
    setTextPreviewGeometry,
    setSelectionBox,
    setObjectResizePreview
  } = dependencies.state;

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
