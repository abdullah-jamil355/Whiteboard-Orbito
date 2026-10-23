import { connectorRoutePoints, LINE_WEIGHT_STROKE_WIDTHS, type BoardObject, type ConnectorEndpoint, type Coordinate, type ShapeObject } from "./board";
import { asSegments, lineTouched, polygonTouched, distanceToSegmentSquared, type Segment } from "./eraser.geometry";
import { splitStroke } from "./eraser.strokes";

export type IndexedBoardObject = Readonly<{ index: number; object: BoardObject }>;
export type BoardObjectsEdit = Readonly<{
  affectedIds: readonly string[];
  before: readonly IndexedBoardObject[];
  after: readonly IndexedBoardObject[];
}>;
export type ErasureResult = Readonly<{
  objects: readonly BoardObject[];
  edit: BoardObjectsEdit | null;
}>;

const shapeTouched = (shape: ShapeObject, eraser: readonly Segment[], radius: number): boolean => {
  const { x, y, width, height } = shape.geometry;
  if (shape.shape === "circle") {
    const center = { x: x + width / 2, y: y + height / 2 };
    const shapeRadius = Math.min(width, height) / 2;
    return eraser.some((segment) => distanceToSegmentSquared(center, segment) <= (shapeRadius + radius) ** 2);
  }
  const vertices = shape.shape === "diamond"
    ? [
        { x: x + width / 2, y },
        { x: x + width, y: y + height / 2 },
        { x: x + width / 2, y: y + height },
        { x, y: y + height / 2 }
      ]
    : shape.shape === "triangle"
      ? [{ x: x + width / 2, y }, { x: x + width, y: y + height }, { x, y: y + height }]
      : shape.shape === "hexagon"
        ? [{ x: x + width * 0.25, y }, { x: x + width * 0.75, y }, { x: x + width, y: y + height / 2 }, { x: x + width * 0.75, y: y + height }, { x: x + width * 0.25, y: y + height }, { x, y: y + height / 2 }]
        : [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }];
  return polygonTouched(vertices, eraser, radius);
};

const textTouched = (object: Extract<BoardObject, { type: "text" }>, eraser: readonly Segment[], radius: number): boolean => {
  const { x, y, width, height } = object.geometry;
  return polygonTouched([{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }], eraser, radius);
};

const detachDeletedShape = (endpoint: ConnectorEndpoint, shapeIds: ReadonlySet<string>): ConnectorEndpoint => {
  if (endpoint.shapeId === undefined || !shapeIds.has(endpoint.shapeId)) return endpoint;
  return { x: endpoint.x, y: endpoint.y };
};

export const eraseBoardObjects = (
  objects: readonly BoardObject[],
  path: readonly Coordinate[],
  radius: number,
  createId: () => string
): ErasureResult => {
  if (objects.length === 0 || path.length === 0 || !Number.isFinite(radius) || radius <= 0) {
    return { objects, edit: null };
  }

  const eraser = asSegments(path);
  const updates = new Map<string, readonly BoardObject[] | null>();
  const deletedShapeIds = new Set<string>();
  const existingIds = new Set(objects.map((object) => object.id));
  for (const object of objects) {
    if (object.type === "shape" && shapeTouched(object, eraser, radius)) {
      deletedShapeIds.add(object.id);
      updates.set(object.id, null);
    } else if (object.type === "text" && textTouched(object, eraser, radius)) {
      updates.set(object.id, null);
    } else if (object.type === "stroke") {
      const halfWidth = LINE_WEIGHT_STROKE_WIDTHS[object.lineWeight] / 2;
      const fragments = splitStroke(object.points, eraser, radius + halfWidth);
      if (fragments !== null) {
        const remaining = fragments.map((fragment, index) => {
          let id = object.id;
          if (index > 0) {
            do id = createId(); while (existingIds.has(id));
            existingIds.add(id);
          }
          return { ...object, id, points: fragment };
        });
        updates.set(object.id, remaining);
      }
    } else if (object.type === "line" || object.type === "arrow" || object.type === "connector") {
      const points = object.type === "connector"
        ? connectorRoutePoints(object.start, object.end, object.routing ?? "orthogonal")
        : [object.start, object.end];
      if (lineTouched(points, eraser, radius + LINE_WEIGHT_STROKE_WIDTHS[object.lineWeight] / 2)) {
        updates.set(object.id, null);
      }
    }
  }

  if (deletedShapeIds.size > 0) {
    for (const object of objects) {
      if (object.type === "text" && object.parentShapeId !== undefined && deletedShapeIds.has(object.parentShapeId)) {
        updates.set(object.id, null);
      } else if (object.type === "line" || object.type === "arrow" || object.type === "connector") {
        if (updates.has(object.id) && updates.get(object.id) === null) continue;
        const start = detachDeletedShape(object.start, deletedShapeIds);
        const end = detachDeletedShape(object.end, deletedShapeIds);
        if (start !== object.start || end !== object.end) updates.set(object.id, [{ ...object, start, end }]);
      }
    }
  }

  if (updates.size === 0) return { objects, edit: null };

  const nextObjects = objects.flatMap((object) => {
    if (!updates.has(object.id)) return [object];
    return updates.get(object.id) ?? [];
  });
  const affectedIds = new Set(updates.keys());
  for (const replacement of updates.values()) {
    replacement?.forEach((object) => affectedIds.add(object.id));
  }
  const before = objects.flatMap((object, index) => updates.has(object.id) ? [{ index, object }] : []);
  const after = nextObjects.flatMap((object, index) => affectedIds.has(object.id) ? [{ index, object }] : []);

  return {
    objects: nextObjects,
    edit: { affectedIds: [...affectedIds], before, after }
  };
};
