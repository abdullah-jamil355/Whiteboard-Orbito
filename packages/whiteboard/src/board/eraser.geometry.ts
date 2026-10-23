import type { Coordinate } from "./board";

export type Interval = Readonly<{ start: number; end: number }>;
export type Segment = Readonly<{ start: Coordinate; end: Coordinate }>;

export const EPSILON = 1e-8;
export const pointAt = (segment: Segment, amount: number): Coordinate => ({
  x: segment.start.x + (segment.end.x - segment.start.x) * amount,
  y: segment.start.y + (segment.end.y - segment.start.y) * amount
});

export const distanceSquared = (first: Coordinate, second: Coordinate): number =>
  (first.x - second.x) ** 2 + (first.y - second.y) ** 2;

export const distanceToSegmentSquared = (point: Coordinate, segment: Segment): number => {
  const deltaX = segment.end.x - segment.start.x;
  const deltaY = segment.end.y - segment.start.y;
  const lengthSquared = deltaX ** 2 + deltaY ** 2;
  if (lengthSquared <= EPSILON) return distanceSquared(point, segment.start);
  const amount = Math.max(0, Math.min(1,
    ((point.x - segment.start.x) * deltaX + (point.y - segment.start.y) * deltaY) / lengthSquared
  ));
  return distanceSquared(point, pointAt(segment, amount));
};

export const boundsOverlap = (first: Segment, second: Segment, radius: number): boolean =>
  Math.max(first.start.x, first.end.x) + radius >= Math.min(second.start.x, second.end.x)
  && Math.min(first.start.x, first.end.x) - radius <= Math.max(second.start.x, second.end.x)
  && Math.max(first.start.y, first.end.y) + radius >= Math.min(second.start.y, second.end.y)
  && Math.min(first.start.y, first.end.y) - radius <= Math.max(second.start.y, second.end.y);

export const orientation = (first: Coordinate, second: Coordinate, third: Coordinate): number =>
  (second.x - first.x) * (third.y - first.y) - (second.y - first.y) * (third.x - first.x);

export const liesOnSegment = (point: Coordinate, segment: Segment): boolean =>
  Math.abs(orientation(segment.start, segment.end, point)) <= EPSILON
  && point.x >= Math.min(segment.start.x, segment.end.x) - EPSILON
  && point.x <= Math.max(segment.start.x, segment.end.x) + EPSILON
  && point.y >= Math.min(segment.start.y, segment.end.y) - EPSILON
  && point.y <= Math.max(segment.start.y, segment.end.y) + EPSILON;

export const segmentsIntersect = (first: Segment, second: Segment): boolean => {
  const firstStart = orientation(first.start, first.end, second.start);
  const firstEnd = orientation(first.start, first.end, second.end);
  const secondStart = orientation(second.start, second.end, first.start);
  const secondEnd = orientation(second.start, second.end, first.end);
  if (firstStart * firstEnd < 0 && secondStart * secondEnd < 0) return true;
  return (Math.abs(firstStart) <= EPSILON && liesOnSegment(second.start, first))
    || (Math.abs(firstEnd) <= EPSILON && liesOnSegment(second.end, first))
    || (Math.abs(secondStart) <= EPSILON && liesOnSegment(first.start, second))
    || (Math.abs(secondEnd) <= EPSILON && liesOnSegment(first.end, second));
};

export const segmentDistanceSquared = (first: Segment, second: Segment): number => {
  if (segmentsIntersect(first, second)) return 0;
  return Math.min(
    distanceToSegmentSquared(first.start, second),
    distanceToSegmentSquared(first.end, second),
    distanceToSegmentSquared(second.start, first),
    distanceToSegmentSquared(second.end, first)
  );
};

export const asSegments = (points: readonly Coordinate[]): readonly Segment[] => {
  if (points.length === 1) return [{ start: points[0]!, end: points[0]! }];
  return points.slice(1).map((point, index) => ({ start: points[index]!, end: point }));
};

export const distanceToPathSquared = (point: Coordinate, path: readonly Segment[]): number =>
  path.reduce((closest, segment) => Math.min(closest, distanceToSegmentSquared(point, segment)), Number.POSITIVE_INFINITY);

export const isInsidePolygon = (point: Coordinate, vertices: readonly Coordinate[]): boolean => {
  let inside = false;
  for (let current = 0, previous = vertices.length - 1; current < vertices.length; previous = current, current += 1) {
    const first = vertices[current]!;
    const second = vertices[previous]!;
    const crosses = (first.y > point.y) !== (second.y > point.y)
      && point.x < (second.x - first.x) * (point.y - first.y) / (second.y - first.y) + first.x;
    if (crosses) inside = !inside;
  }
  return inside;
};

export const polygonTouched = (vertices: readonly Coordinate[], eraser: readonly Segment[], radius: number): boolean => {
  const edges = vertices.map((start, index): Segment => ({ start, end: vertices[(index + 1) % vertices.length]! }));
  return eraser.some((segment) =>
    isInsidePolygon(segment.start, vertices)
    || isInsidePolygon(segment.end, vertices)
    || edges.some((edge) => segmentDistanceSquared(segment, edge) <= radius ** 2)
  );
};

export const lineTouched = (points: readonly Coordinate[], eraser: readonly Segment[], radius: number): boolean => {
  const lineSegments = asSegments(points);
  return lineSegments.some((line) => eraser.some((segment) =>
    boundsOverlap(line, segment, radius) && segmentDistanceSquared(line, segment) <= radius ** 2
  ));
};

