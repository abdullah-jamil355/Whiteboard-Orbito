import type { PointerEvent as ReactPointerEvent } from "react";
import { shapeConnectionCoordinate, type ConnectorEndpoint, type ShapeObject } from "..";
import { coordinateFromClientPosition, getDirectionalTarget } from "./canvas-geometry";
import type { ConnectionDirection } from "./canvas-model";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";

export const createCanvasConnectorGestures = (dependencies: CanvasGestureDependencies) => {
  const { shapes } = dependencies.board;
  const { activeGestureRef, previousTextClickRef, setPreviewLine } = dependencies.state;
  const { lineColor, lineLineWeight, connectorRouting, lineStartArrow, lineEndArrow } = dependencies.style;
  const { onLineCommit } = dependencies.callbacks;
  const effectiveEndArrow = lineEndArrow && lineEndArrow !== "none" ? lineEndArrow : "block";

  const startDirectionalConnector = (
    event: ReactPointerEvent<SVGGElement>,
    shape: ShapeObject,
    direction: ConnectionDirection
  ): void => {
    if (!event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    previousTextClickRef.current = null;
    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);
    const start: ConnectorEndpoint = {
      ...shapeConnectionCoordinate(shape.geometry, direction, shape.shape),
      shapeId: shape.id,
      connectionPoint: direction
    };
    activeGestureRef.current = {
      kind: "line",
      pointerId: event.pointerId,
      tool: "connector",
      start,
      origin,
      quickConnectDirection: direction
    };
    setPreviewLine({ type: "connector", start, end: origin, color: lineColor, lineWeight: lineLineWeight, startArrow: lineStartArrow ?? "none", endArrow: effectiveEndArrow, routing: connectorRouting });
    surface.setPointerCapture(event.pointerId);
  };

  const commitQuickConnector = (shape: ShapeObject, direction: ConnectionDirection): void => {
    const end = getDirectionalTarget(shape, shapes, direction);
    if (end === null) return;
    const start: ConnectorEndpoint = {
      ...shapeConnectionCoordinate(shape.geometry, direction, shape.shape),
      shapeId: shape.id,
      connectionPoint: direction
    };
    onLineCommit({ type: "connector", start, end, color: lineColor, lineWeight: lineLineWeight, startArrow: lineStartArrow ?? "none", endArrow: effectiveEndArrow, routing: connectorRouting });
  };

  return { commitQuickConnector, startDirectionalConnector };
};
