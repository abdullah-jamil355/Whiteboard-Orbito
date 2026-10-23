import { connectorRoutePoints, updateShapeAndBoundTextGeometry, type Board, type BoardObject, type Coordinate, type ShapeObject } from "./board";

export type BoardBounds = Readonly<{ left: number; top: number; right: number; bottom: number }>;

export const getObjectBounds = (object: BoardObject): BoardBounds => {
  if (object.type === "shape" || object.type === "text") {
    return { left: object.geometry.x, top: object.geometry.y, right: object.geometry.x + object.geometry.width, bottom: object.geometry.y + object.geometry.height };
  }
  if (object.type === "stroke") {
    const xs = object.points.map(({ x }) => x);
    const ys = object.points.map(({ y }) => y);
    return { left: Math.min(...xs), top: Math.min(...ys), right: Math.max(...xs), bottom: Math.max(...ys) };
  }
  const points = object.type === "connector"
    ? connectorRoutePoints(object.start, object.end, object.routing ?? "orthogonal", object.waypoints)
    : [object.start, ...(object.waypoints ?? []), object.end];
  return {
    left: Math.min(...points.map(({ x }) => x)),
    top: Math.min(...points.map(({ y }) => y)),
    right: Math.max(...points.map(({ x }) => x)),
    bottom: Math.max(...points.map(({ y }) => y))
  };
};

export const resizedObjectBounds = (
  original: BoardBounds,
  handle: "north-west" | "north-east" | "south-west" | "south-east",
  current: Coordinate,
  _canvas: Readonly<{ width: number; height: number }>
): BoardBounds => {
  void _canvas;
  const minimum = 16;
  const left = handle.endsWith("west") ? Math.min(original.right - minimum, current.x) : original.left;
  const right = handle.endsWith("east") ? Math.max(original.left + minimum, current.x) : original.right;
  const top = handle.startsWith("north") ? Math.min(original.bottom - minimum, current.y) : original.top;
  const bottom = handle.startsWith("south") ? Math.max(original.top + minimum, current.y) : original.bottom;
  return { left, right, top, bottom };
};

export const selectObjectsInBox = (objects: readonly BoardObject[], start: Coordinate, end: Coordinate): readonly string[] => {
  const box = { left: Math.min(start.x, end.x), top: Math.min(start.y, end.y), right: Math.max(start.x, end.x), bottom: Math.max(start.y, end.y) };
  return objects.filter((object) => {
    const bounds = getObjectBounds(object);
    return bounds.left >= box.left && bounds.right <= box.right && bounds.top >= box.top && bounds.bottom <= box.bottom;
  }).map(({ id }) => id);
};

export const moveBoardObjects = (board: Board, objectIds: readonly string[], dx: number, dy: number): Board => {
  const selected = new Set(objectIds);
  let next = board;
  const shapes = board.objects.filter((object): object is ShapeObject => object.type === "shape" && selected.has(object.id));
  for (const shape of shapes) {
    next = updateShapeAndBoundTextGeometry(next, shape.id, { ...shape.geometry, x: shape.geometry.x + dx, y: shape.geometry.y + dy });
  }
  return {
    ...next,
    objects: next.objects.map((object) => {
      if (!selected.has(object.id)) return object;
      if (object.type === "shape") return object;
      if (object.type === "text") {
        if (object.parentShapeId !== undefined && shapes.some((shape) => shape.id === object.parentShapeId)) return object;
        return { ...object, geometry: { ...object.geometry, x: object.geometry.x + dx, y: object.geometry.y + dy } };
      }
      if (object.type === "stroke") return { ...object, points: object.points.map((point) => ({ x: point.x + dx, y: point.y + dy })) };
      const moveEndpoint = (endpoint: typeof object.start): typeof object.start => {
        if (endpoint.shapeId !== undefined && selected.has(endpoint.shapeId)) return endpoint;
        const moved = { x: endpoint.x + dx, y: endpoint.y + dy };
        return endpoint.shapeId === undefined ? { ...endpoint, ...moved } : moved;
      };
      const waypoints = object.waypoints?.map((point) => ({ x: point.x + dx, y: point.y + dy }));
      return { ...object, start: moveEndpoint(object.start), end: moveEndpoint(object.end), ...(waypoints === undefined ? {} : { waypoints }) };
    })
  };
};

export const cloneBoardObjects = (objects: readonly BoardObject[], ids: readonly string[], createId: () => string, offset = 20): readonly BoardObject[] => {
  const selected = new Set(ids);
  const included = objects.filter((object) => selected.has(object.id));
  const idMap = new Map(included.map(({ id }) => [id, createId()]));
  return included.map((object) => {
    const id = idMap.get(object.id)!;
    if (object.type === "shape") return { ...object, id, geometry: { ...object.geometry, x: object.geometry.x + offset, y: object.geometry.y + offset } };
    if (object.type === "text") {
      const parentShapeId = object.parentShapeId === undefined ? undefined : idMap.get(object.parentShapeId);
      const copy = {
        id,
        type: "text" as const,
        geometry: { ...object.geometry, x: object.geometry.x + offset, y: object.geometry.y + offset },
        text: object.text,
        alignment: object.alignment,
        fontSize: object.fontSize,
        bold: object.bold,
        color: object.color
      };
      return parentShapeId === undefined ? copy : { ...copy, parentShapeId };
    }
    if (object.type === "stroke") return { ...object, id, points: object.points.map((point) => ({ x: point.x + offset, y: point.y + offset })) };
    const copyEndpoint = (endpoint: typeof object.start): typeof object.start => {
      const shapeId = endpoint.shapeId === undefined ? undefined : idMap.get(endpoint.shapeId);
      if (shapeId !== undefined) return { ...endpoint, shapeId };
      return { x: endpoint.x + offset, y: endpoint.y + offset };
    };
    const waypoints = object.waypoints?.map((point) => ({ x: point.x + offset, y: point.y + offset }));
    return { ...object, id, start: copyEndpoint(object.start), end: copyEndpoint(object.end), ...(waypoints === undefined ? {} : { waypoints }) };
  });
};

export const updateObjectWaypoints = (board: Board, objectId: string, waypoints: readonly Coordinate[]): Board => ({
  ...board,
  objects: board.objects.map((object) => {
    if (object.id !== objectId) return object;
    if (object.type === "connector" || object.type === "line" || object.type === "arrow") {
      return { ...object, waypoints };
    }
    return object;
  })
});

export const getObjectIdsWithDependents = (objects: readonly BoardObject[], ids: readonly string[]): ReadonlySet<string> => {
  const selected = new Set(ids);
  const selectedShapes = new Set(objects.filter((object): object is ShapeObject => object.type === "shape" && selected.has(object.id)).map(({ id }) => id));
  objects.forEach((object) => {
    if (object.type === "text" && object.parentShapeId !== undefined && selectedShapes.has(object.parentShapeId)) selected.add(object.id);
  });
  objects.forEach((object) => {
    if ((object.type === "line" || object.type === "arrow" || object.type === "connector")
      && object.start.shapeId !== undefined && object.end.shapeId !== undefined
      && selectedShapes.has(object.start.shapeId) && selectedShapes.has(object.end.shapeId)) selected.add(object.id);
  });
  return selected;
};

export const removeBoardObjects = (board: Board, ids: ReadonlySet<string>): Board => {
  const objects = board.objects.filter((object) => !ids.has(object.id)).map((object) => {
    if (object.type !== "line" && object.type !== "arrow" && object.type !== "connector") return object;
    const detach = (endpoint: typeof object.start): typeof object.start =>
      endpoint.shapeId !== undefined && ids.has(endpoint.shapeId) ? { x: endpoint.x, y: endpoint.y } : endpoint;
    return { ...object, start: detach(object.start), end: detach(object.end) };
  });
  return { ...board, objects };
};

export const resizeBoardObject = (board: Board, id: string, bounds: BoardBounds): Board => {
  const object = board.objects.find((item) => item.id === id);
  if (object === undefined) return board;
  if (object.type === "shape") {
    return updateShapeAndBoundTextGeometry(board, id, {
      x: bounds.left,
      y: bounds.top,
      width: bounds.right - bounds.left,
      height: bounds.bottom - bounds.top
    });
  }
  const previous = getObjectBounds(object);
  const oldWidth = Math.max(previous.right - previous.left, 1);
  const oldHeight = Math.max(previous.bottom - previous.top, 1);
  const scaleX = (bounds.right - bounds.left) / oldWidth;
  const scaleY = (bounds.bottom - bounds.top) / oldHeight;
  const scalePoint = (point: Coordinate): Coordinate => ({
    x: bounds.left + (point.x - previous.left) * scaleX,
    y: bounds.top + (point.y - previous.top) * scaleY
  });
  const objects = board.objects.map((item) => {
    if (item.id !== id) return item;
    if (item.type === "text") return { ...item, geometry: { x: bounds.left, y: bounds.top, width: bounds.right - bounds.left, height: bounds.bottom - bounds.top } };
    if (item.type === "stroke") return { ...item, points: item.points.map(scalePoint) };
    if (item.type !== "line" && item.type !== "arrow" && item.type !== "connector") return item;
    return { ...item, start: scalePoint(item.start), end: scalePoint(item.end) };
  });
  return { ...board, objects };
};

export const reorderBoardObjects = (board: Board, ids: readonly string[], direction: "front" | "back"): Board => {
  const selected = new Set(ids);
  const moving = board.objects.filter(({ id }) => selected.has(id));
  const remaining = board.objects.filter(({ id }) => !selected.has(id));
  return { ...board, objects: direction === "front" ? [...remaining, ...moving] : [...moving, ...remaining] };
};
