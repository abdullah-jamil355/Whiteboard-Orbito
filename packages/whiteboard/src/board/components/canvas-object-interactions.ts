import type { PointerEvent as ReactPointerEvent } from "react";
import { WHITEBOARD_PALETTE, type BoardObject, type ShapeObject, type TextObject } from "..";
import { getObjectBounds } from "../object-operations";
import { coordinateFromClientPosition, geometryForShape, selectionForPointer } from "./canvas-geometry";
import { type CanvasGestureDependencies } from "./canvas-gesture-types";
import type { ResizeHandle } from "./canvas-model";

export const createCanvasObjectInteractions = (dependencies: CanvasGestureDependencies) => {
  const { shapes } = dependencies.board;
  const { selectedTool, selectedObjectIds } = dependencies.view;
  const { activeGestureRef, previousTextClickRef, setResizeGeometry, setTextPreviewGeometry, setObjectResizePreview } = dependencies.state;
  const { onShapeSelect, onSelectionChange, onTextCreate, onTextSelect, onTextEditStart } = dependencies.callbacks;


  const startResize = (event: ReactPointerEvent<SVGRectElement>, shape: ShapeObject, handle: ResizeHandle): void => {
    event.preventDefault();
    event.stopPropagation();
    previousTextClickRef.current = null;
    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);
    const normalizedShape = { ...shape, geometry: geometryForShape(shape, shape.geometry) };
    activeGestureRef.current = { kind: "resize", pointerId: event.pointerId, shape: normalizedShape, handle, origin };
    setResizeGeometry(normalizedShape.geometry);
    surface.setPointerCapture(event.pointerId);
  };

  const startOtherObjectResize = (event: ReactPointerEvent<SVGElement>, object: BoardObject, handle: ResizeHandle): void => {
    event.preventDefault();
    event.stopPropagation();
    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);
    const bounds = getObjectBounds(object);
    activeGestureRef.current = { kind: "resize-object", pointerId: event.pointerId, object, handle, origin, bounds };
    setObjectResizePreview({ object, bounds });
    surface.setPointerCapture(event.pointerId);
  };

  const handleShapePointerDown = (event: ReactPointerEvent<SVGElement>, shapeId: string): void => {
    if (selectedTool === "text") {
      event.preventDefault();
      event.stopPropagation();
      const shape = shapes.find((item) => item.id === shapeId);
      if (shape === undefined) return;
      const initialWidth = Math.min(12, Math.max(1, shape.geometry.width - 24));
      const initialHeight = Math.min(28, Math.max(1, shape.geometry.height - 24));
      const textId = onTextCreate({
        geometry: {
          x: shape.geometry.x + (shape.geometry.width - initialWidth) / 2,
          y: shape.geometry.y + (shape.geometry.height - initialHeight) / 2,
          width: initialWidth,
          height: initialHeight
        },
        text: "",
        alignment: "center",
        fontSize: 16,
        bold: false,
        color: WHITEBOARD_PALETTE[0].value,
        parentShapeId: shapeId
      });
      onTextSelect(textId);
      return;
    }
    if (selectedTool !== "select") return;
    event.preventDefault();
    event.stopPropagation();
    setObjectResizePreview(null);
    event.currentTarget.parentElement?.focus();
    previousTextClickRef.current = null;
    onTextSelect(null);
    const wasSelected = selectedObjectIds.includes(shapeId);
    const ids = selectionForPointer(selectedObjectIds, shapeId, event.shiftKey);
    onSelectionChange(ids);
    if (event.shiftKey && wasSelected) {
      activeGestureRef.current = null;
      return;
    }
    const shape = shapes.find((item) => item.id === shapeId);
    const surface = event.currentTarget.ownerSVGElement;
    if (shape === undefined || surface === null) return;
    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);
    activeGestureRef.current = ids.length > 1
      ? { kind: "move-objects", pointerId: event.pointerId, ids, origin }
      : { kind: "move", pointerId: event.pointerId, shape, origin };
    setResizeGeometry(shape.geometry);
    surface.setPointerCapture(event.pointerId);
  };

  const handleOtherObjectPointerDown = (event: ReactPointerEvent<SVGElement>, objectId: string): void => {
    if ((selectedTool !== "select" && selectedTool !== "waypoints") || !event.isPrimary || event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    setObjectResizePreview(null);
    event.currentTarget.parentElement?.focus();
    onShapeSelect(null);
    onTextSelect(null);

    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;
    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);

    if (selectedTool === "waypoints") {
      const object = dependencies.board.board.objects.find((item) => item.id === objectId);
      if (object && (object.type === "connector" || object.type === "line" || object.type === "arrow")) {
        onSelectionChange([objectId]);
        const existing = object.waypoints ?? [];
        const newWaypoints = [...existing, origin];
        dependencies.callbacks.onUpdateWaypoints?.(objectId, newWaypoints);
        activeGestureRef.current = {
          kind: "move-waypoint",
          pointerId: event.pointerId,
          objectId,
          waypointIndex: newWaypoints.length - 1,
          origin
        };
        surface.setPointerCapture(event.pointerId);
      }
      return;
    }

    const wasSelected = selectedObjectIds.includes(objectId);
    const ids = selectionForPointer(selectedObjectIds, objectId, event.shiftKey);
    onSelectionChange(ids);
    if (event.shiftKey && wasSelected) {
      activeGestureRef.current = null;
      return;
    }
    activeGestureRef.current = { kind: "move-objects", pointerId: event.pointerId, ids, origin };
    surface.setPointerCapture(event.pointerId);
  };

  const handleTextPointerDown = (event: ReactPointerEvent<SVGForeignObjectElement>, text: TextObject): void => {
    if (!event.isPrimary || event.button !== 0) return;
    if (selectedTool === "eraser") return;
    event.preventDefault();
    event.stopPropagation();
    setObjectResizePreview(null);
    if (selectedTool !== "select") {
      previousTextClickRef.current = null;
      return;
    }
    event.currentTarget.parentElement?.focus();

    const surface = event.currentTarget.ownerSVGElement;
    if (surface === null) return;

    const origin = coordinateFromClientPosition(event.clientX, event.clientY, surface);
    const previousClick = previousTextClickRef.current;
    const now = event.timeStamp;
    const isDoubleClick = previousClick?.textId === text.id
      && now - previousClick.timestamp <= 500
      && Math.hypot(origin.x - previousClick.position.x, origin.y - previousClick.position.y) <= 12;

    if (event.detail >= 2 || isDoubleClick) {
      previousTextClickRef.current = null;
      onTextSelect(text.id);
      onShapeSelect(null);
      onSelectionChange([text.id]);
      onTextEditStart(text.id);
      return;
    }

    previousTextClickRef.current = { textId: text.id, timestamp: now, position: origin };
    const wasSelected = selectedObjectIds.includes(text.id);
    const ids = selectionForPointer(selectedObjectIds, text.id, event.shiftKey);
    onShapeSelect(null);
    onTextSelect(text.id);
    onSelectionChange(ids);
    if (event.shiftKey && wasSelected) {
      activeGestureRef.current = null;
      return;
    }
    activeGestureRef.current = ids.length > 1
      ? { kind: "move-objects", pointerId: event.pointerId, ids, origin }
      : { kind: "move-text", pointerId: event.pointerId, text, origin };
    setTextPreviewGeometry(text.geometry);

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  return {
    handleOtherObjectPointerDown,
    handleShapePointerDown,
    handleTextPointerDown,
    startOtherObjectResize,
    startResize
  };
};

