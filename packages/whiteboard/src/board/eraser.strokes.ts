import type { Coordinate } from "./board";
import { EPSILON, asSegments, boundsOverlap, distanceToPathSquared, distanceToSegmentSquared, distanceSquared, pointAt, type Interval, type Segment } from "./eraser.geometry";

export const strokeRemovalIntervals = (
  strokeSegment: Segment,
  eraserSegments: readonly Segment[],
  radius: number
): readonly Interval[] => {
  const intervals: Interval[] = [];
  const radiusSquared = radius ** 2;
  const distanceAt = (amount: number, eraser: Segment): number =>
    distanceToSegmentSquared(pointAt(strokeSegment, amount), eraser);

  for (const eraser of eraserSegments) {
    if (!boundsOverlap(strokeSegment, eraser, radius)) continue;
    let low = 0;
    let high = 1;
    for (let iteration = 0; iteration < 36; iteration += 1) {
      const left = (2 * low + high) / 3;
      const right = (low + 2 * high) / 3;
      if (distanceAt(left, eraser) <= distanceAt(right, eraser)) high = right;
      else low = left;
    }
    const minimum = (low + high) / 2;
    if (distanceAt(minimum, eraser) > radiusSquared) continue;

    let start = 0;
    if (distanceAt(0, eraser) > radiusSquared) {
      low = 0;
      high = minimum;
      for (let iteration = 0; iteration < 32; iteration += 1) {
        const middle = (low + high) / 2;
        if (distanceAt(middle, eraser) <= radiusSquared) high = middle;
        else low = middle;
      }
      start = high;
    }

    let end = 1;
    if (distanceAt(1, eraser) > radiusSquared) {
      low = minimum;
      high = 1;
      for (let iteration = 0; iteration < 32; iteration += 1) {
        const middle = (low + high) / 2;
        if (distanceAt(middle, eraser) <= radiusSquared) low = middle;
        else high = middle;
      }
      end = low;
    }
    intervals.push({ start, end });
  }

  return intervals.sort((first, second) => first.start - second.start).reduce<Interval[]>((merged, interval) => {
    const previous = merged.at(-1);
    if (previous === undefined || interval.start > previous.end + EPSILON) merged.push(interval);
    else merged[merged.length - 1] = { start: previous.start, end: Math.max(previous.end, interval.end) };
    return merged;
  }, []);
};

export const splitStroke = (
  points: readonly Coordinate[],
  eraserSegments: readonly Segment[],
  radius: number
): readonly (readonly Coordinate[])[] | null => {
  if (points.length === 1) {
    return distanceToPathSquared(points[0]!, eraserSegments) <= radius ** 2 ? [] : null;
  }

  const fragments: Coordinate[][] = [];
  let current: Coordinate[] = [];
  const appendRange = (segment: Segment, start: number, end: number): void => {
    if (end < start + EPSILON) return;
    const first = pointAt(segment, start);
    const last = pointAt(segment, end);
    const previous = current.at(-1);
    if (previous === undefined || distanceSquared(previous, first) > EPSILON) current.push(first);
    if (distanceSquared(current.at(-1)!, last) > EPSILON) current.push(last);
  };
  const finishFragment = (): void => {
    if (current.length > 0) fragments.push(current);
    current = [];
  };
  let changed = false;

  for (const segment of asSegments(points)) {
    const intervals = strokeRemovalIntervals(segment, eraserSegments, radius);
    if (intervals.length === 0) {
      appendRange(segment, 0, 1);
      continue;
    }

    changed = true;
    let cursor = 0;
    for (const interval of intervals) {
      appendRange(segment, cursor, interval.start);
      finishFragment();
      cursor = Math.max(cursor, interval.end);
    }
    if (cursor < 1 - EPSILON) appendRange(segment, cursor, 1);
    else finishFragment();
  }

  if (!changed) return null;
  finishFragment();
  return fragments;
};
