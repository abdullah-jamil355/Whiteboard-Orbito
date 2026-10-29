import type { PointerEvent as ReactPointerEvent } from "react";
import type { ConnectorObject, Coordinate, LineObject } from "..";
import { coordinateFromClientPosition } from "./canvas-geometry";
import type { CanvasGestureDependencies } from "./canvas-gesture-types";

export const createCanvasWaypointGestures = (dependencies: CanvasGestureDependencies) => {
  const { activeGestureRef } = dependencies.state;
  const { onUpdateWaypoints } = dependencies.callbacks;

  const startWaypointDrag = (
    event: ReactPointerEvent<SVGElement>,
    object: LineObject | ConnectorObject,
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
    object: LineObject | ConnectorObject,
    segmentIndex: number,
    point: Coordinate
  ): void => {
    event.preventDefault();
    event.stopPropagation();
    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const existing = object.waypoints ?? [];
    const newWaypoints = [
      ...existing.slice(0, segmentIndex),
      point,
      ...existing.slice(segmentIndex)
    ];
    onUpdateWaypoints?.(object.id, newWaypoints);
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
    object: LineObject | ConnectorObject,
    index: number
  ): void => {
    const existing = object.waypoints ?? [];
    const newWaypoints = existing.filter((_, i) => i !== index);
    onUpdateWaypoints?.(object.id, newWaypoints);
  };

  return {
    deleteWaypoint,
    startMidpointDrag,
    startWaypointDrag
  };
};
