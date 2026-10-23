import type { PointerEvent as ReactPointerEvent } from "react";
import { connectorRoutePoints, shapeConnectionCoordinate, type BoardObject, type ConnectorEndpoint, type Coordinate, type ShapeObject, type TextObject, type WhiteboardTool } from "..";
import { getObjectBounds, type BoardBounds } from "../object-operations";
import { BASE_CANVAS_HEIGHT, BASE_CANVAS_WIDTH, DEFAULT_SHAPE_HEIGHT, DEFAULT_SHAPE_WIDTH, MINIMUM_MOVE_DISTANCE, MINIMUM_SHAPE_SIZE, type CanvasBounds, type ConnectionDirection, type LinearTool, type ResizeHandle } from "./canvas-model";

export const getRequiredCanvasBounds = (objects: readonly BoardObject[]): CanvasBounds => {
  let right = BASE_CANVAS_WIDTH;
  let bottom = BASE_CANVAS_HEIGHT;
  const include = (point: Coordinate): void => {
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  };

  for (const object of objects) {
    if (object.type === "shape" || object.type === "text") {
      right = Math.max(right, object.geometry.x + object.geometry.width);
      bottom = Math.max(bottom, object.geometry.y + object.geometry.height);
    } else if (object.type === "stroke") {
      object.points.forEach(include);
    } else {
      (object.type === "connector" ? connectorRoutePoints(object.start, object.end, object.routing ?? "orthogonal") : [object.start, object.end]).forEach(include);
    }
  }
  return { width: right, height: bottom };
};

export const fitCanvasBounds = (viewport: CanvasBounds, required: CanvasBounds): CanvasBounds => {
  const aspectRatio = viewport.width > 0 && viewport.height > 0
    ? viewport.width / viewport.height
    : BASE_CANVAS_WIDTH / BASE_CANVAS_HEIGHT;
  const width = Math.max(required.width, required.height * aspectRatio);
  return { width, height: width / aspectRatio };
};

export const coordinateFromClientPosition = (clientX: number, clientY: number, surface: SVGSVGElement): Coordinate => {
  const transform = surface.getScreenCTM();
  if (transform === null) return { x: 0, y: 0 };

  const point = surface.createSVGPoint();
  point.x = clientX;
  point.y = clientY;
  const coordinate = point.matrixTransform(transform.inverse());
  return { x: coordinate.x, y: coordinate.y };
};

export const coordinateFromPointer = (event: ReactPointerEvent<SVGSVGElement>): Coordinate =>
  coordinateFromClientPosition(event.clientX, event.clientY, event.currentTarget);

export const geometryForShape = (shape: ShapeObject, geometry: ShapeObject["geometry"]): ShapeObject["geometry"] => {
  if (shape.shape !== "circle") return geometry;
  const diameter = Math.min(geometry.width, geometry.height);
  return {
    x: geometry.x + (geometry.width - diameter) / 2,
    y: geometry.y + (geometry.height - diameter) / 2,
    width: diameter,
    height: diameter
  };
};

export const strokePointsAttribute = (points: readonly Coordinate[]): string =>
  points.map(({ x, y }) => `${x},${y}`).join(" ");

export const selectionForPointer = (
  current: readonly string[],
  objectId: string,
  additive: boolean
): readonly string[] => {
  if (additive) {
    return current.includes(objectId)
      ? current.filter((selectedId) => selectedId !== objectId)
      : [...current, objectId];
  }
  return current.includes(objectId) ? current : [objectId];
};

export const shapeGeometryFromDrag = (shape: ShapeObject["shape"], origin: Coordinate, current: Coordinate, _bounds: CanvasBounds): ShapeObject["geometry"] => {
  void _bounds;
  const deltaX = current.x - origin.x;
  const deltaY = current.y - origin.y;
  const width = Math.abs(deltaX);
  const height = Math.abs(deltaY);
  if (width < MINIMUM_SHAPE_SIZE && height < MINIMUM_SHAPE_SIZE) {
    return {
      x: origin.x - DEFAULT_SHAPE_WIDTH / 2,
      y: origin.y - DEFAULT_SHAPE_HEIGHT / 2,
      width: shape === "circle" ? Math.min(DEFAULT_SHAPE_WIDTH, DEFAULT_SHAPE_HEIGHT) : DEFAULT_SHAPE_WIDTH,
      height: DEFAULT_SHAPE_HEIGHT
    };
  }

  if (shape === "circle") {
    const diameter = Math.max(MINIMUM_SHAPE_SIZE, width, height);
    return {
      x: deltaX < 0 ? origin.x - diameter : origin.x,
      y: deltaY < 0 ? origin.y - diameter : origin.y,
      width: diameter,
      height: diameter
    };
  }

  return {
    x: Math.min(origin.x, current.x),
    y: Math.min(origin.y, current.y),
    width: Math.max(MINIMUM_SHAPE_SIZE, width),
    height: Math.max(MINIMUM_SHAPE_SIZE, height)
  };
};

export const resizedGeometry = (
  shape: ShapeObject,
  handle: ResizeHandle,
  origin: Coordinate,
  current: Coordinate,
  _bounds: CanvasBounds
): ShapeObject["geometry"] => {
  void _bounds;
  const { x, y, width, height } = shape.geometry;
  const movingLeft = handle.endsWith("west");
  const movingTop = handle.startsWith("north");
  const horizontalAnchor = movingLeft ? x + width : x;
  const verticalAnchor = movingTop ? y + height : y;
  const horizontalSpace = Number.POSITIVE_INFINITY;
  const verticalSpace = Number.POSITIVE_INFINITY;
  let nextWidth = Math.max(MINIMUM_SHAPE_SIZE, width + (movingLeft ? origin.x - current.x : current.x - origin.x));
  let nextHeight = Math.max(MINIMUM_SHAPE_SIZE, height + (movingTop ? origin.y - current.y : current.y - origin.y));

  if (shape.shape === "circle") {
    const diameter = Math.min(horizontalSpace, verticalSpace, Math.max(nextWidth, nextHeight));
    nextWidth = diameter;
    nextHeight = diameter;
  }

  return {
    x: movingLeft ? horizontalAnchor - nextWidth : horizontalAnchor,
    y: movingTop ? verticalAnchor - nextHeight : verticalAnchor,
    width: nextWidth,
    height: nextHeight
  };
};

export const movedGeometry = (geometry: ShapeObject["geometry"], origin: Coordinate, current: Coordinate, _bounds: CanvasBounds): ShapeObject["geometry"] => {
  void _bounds;
  return {
    ...geometry,
    x: geometry.x + current.x - origin.x,
    y: geometry.y + current.y - origin.y
  };
};

export const movedBeyondThreshold = (origin: Coordinate, current: Coordinate): boolean =>
  Math.hypot(current.x - origin.x, current.y - origin.y) >= MINIMUM_MOVE_DISTANCE;

export const getDirectionalTarget = (
  source: ShapeObject,
  shapes: readonly ShapeObject[],
  direction: ConnectionDirection
): ConnectorEndpoint | null => {
  const sourceCenter = {
    x: source.geometry.x + source.geometry.width / 2,
    y: source.geometry.y + source.geometry.height / 2
  };
  const targetConnection: Readonly<Record<ConnectionDirection, ConnectionDirection>> = {
    top: "bottom",
    right: "left",
    bottom: "top",
    left: "right"
  };
  const isInDirection = (targetCenter: Coordinate): boolean => {
    switch (direction) {
      case "top": return targetCenter.y < sourceCenter.y;
      case "right": return targetCenter.x > sourceCenter.x;
      case "bottom": return targetCenter.y > sourceCenter.y;
      case "left": return targetCenter.x < sourceCenter.x;
    }
  };
  const scoreTarget = (shape: ShapeObject): number => {
    const targetCenter = {
      x: shape.geometry.x + shape.geometry.width / 2,
      y: shape.geometry.y + shape.geometry.height / 2
    };
    const primaryDistance = direction === "left" || direction === "right"
      ? Math.abs(targetCenter.x - sourceCenter.x)
      : Math.abs(targetCenter.y - sourceCenter.y);
    const crossDistance = direction === "left" || direction === "right"
      ? Math.abs(targetCenter.y - sourceCenter.y)
      : Math.abs(targetCenter.x - sourceCenter.x);
    return primaryDistance + crossDistance * 1.5;
  };
  const target = shapes
    .filter((shape) => shape.id !== source.id)
    .filter((shape) => isInDirection({
      x: shape.geometry.x + shape.geometry.width / 2,
      y: shape.geometry.y + shape.geometry.height / 2
    }))
    .sort((first, second) => scoreTarget(first) - scoreTarget(second))[0];
  if (target === undefined) return null;
  const endDirection = targetConnection[direction];
  return {
    ...shapeConnectionCoordinate(target.geometry, endDirection, target.shape),
    shapeId: target.id,
    connectionPoint: endDirection
  };
};

export const isLinearTool = (tool: WhiteboardTool): tool is LinearTool =>
  tool === "line" || tool === "arrow" || tool === "connector" || tool === "connection" || tool === "waypoints";

export const arrowHeadPoints = (start: Coordinate, end: Coordinate): string => {
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const headLength = 18;
  const halfWidth = 8;
  const baseX = end.x - Math.cos(angle) * headLength;
  const baseY = end.y - Math.sin(angle) * headLength;
  const perpendicularX = Math.cos(angle + Math.PI / 2) * halfWidth;
  const perpendicularY = Math.sin(angle + Math.PI / 2) * halfWidth;
  return `${baseX + perpendicularX},${baseY + perpendicularY} ${end.x},${end.y} ${baseX - perpendicularX},${baseY - perpendicularY}`;
};

export const textGeometryForShapeGeometry = (text: TextObject, shape: ShapeObject, geometry: ShapeObject["geometry"]): TextObject["geometry"] => {
  const scaleX = geometry.width / shape.geometry.width;
  const scaleY = geometry.height / shape.geometry.height;
  return {
    x: geometry.x + (text.geometry.x - shape.geometry.x) * scaleX,
    y: geometry.y + (text.geometry.y - shape.geometry.y) * scaleY,
    width: text.geometry.width * scaleX,
    height: text.geometry.height * scaleY
  };
};

export const getShapeTextGeometry = (text: TextObject, value: string, shape: ShapeObject): TextObject["geometry"] => {
  const padding = 12;
  const maxWidth = Math.max(12, shape.geometry.width - padding * 2);
  const maxHeight = Math.max(28, shape.geometry.height - padding * 2);
  const context = document.createElement("canvas").getContext("2d");
  if (context !== null) context.font = `${text.bold ? "700" : "400"} ${text.fontSize}px Arial`;
  const lines = value.split("\n");
  const measuredLines = lines.map((line) => context?.measureText(line).width ?? line.length * text.fontSize * 0.6);
  const width = Math.min(maxWidth, Math.max(12, ...measuredLines.map((lineWidth) => lineWidth + padding * 2)));
  const wrappedLineCount = measuredLines.reduce((count, lineWidth) => count + Math.max(1, Math.ceil(lineWidth / Math.max(1, maxWidth - padding * 2))), 0);
  const height = Math.min(maxHeight, Math.max(28, wrappedLineCount * text.fontSize * 1.25 + padding));
  return {
    x: shape.geometry.x + (shape.geometry.width - width) / 2,
    y: shape.geometry.y + (shape.geometry.height - height) / 2,
    width,
    height
  };
};

export const resizedObjectForBounds = (object: BoardObject, bounds: BoardBounds): BoardObject => {
  const original = getObjectBounds(object);
  const scaleX = (bounds.right - bounds.left) / Math.max(original.right - original.left, 1);
  const scaleY = (bounds.bottom - bounds.top) / Math.max(original.bottom - original.top, 1);
  const scalePoint = (point: Coordinate): Coordinate => ({
    x: bounds.left + (point.x - original.left) * scaleX,
    y: bounds.top + (point.y - original.top) * scaleY
  });
  if (object.type === "text") return { ...object, geometry: { x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top } };
  if (object.type === "stroke") return { ...object, points: object.points.map(scalePoint) };
  if (object.type === "line" || object.type === "arrow" || object.type === "connector") {
    return { ...object, start: scalePoint(object.start), end: scalePoint(object.end) };
  }
  return object;
};
