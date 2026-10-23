import type { BoardObject, ConnectorEndpoint } from "./board";

export const scaleTemplateObjectsToCanvas = (objects: readonly BoardObject[]): readonly BoardObject[] => {
  if (objects.length === 0) return objects;

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  const include = (point: ConnectorEndpoint): void => {
    left = Math.min(left, point.x);
    top = Math.min(top, point.y);
    right = Math.max(right, point.x);
    bottom = Math.max(bottom, point.y);
  };

  for (const object of objects) {
    if (object.type === "shape" || object.type === "text") {
      include(object.geometry);
      include({ x: object.geometry.x + object.geometry.width, y: object.geometry.y + object.geometry.height });
    } else if (object.type === "stroke") {
      object.points.forEach(include);
    } else {
      include(object.start);
      include(object.end);
    }
  }

  const width = right - left;
  const height = bottom - top;
  if (width <= 0 || height <= 0) return objects;

  const scale = Math.min(1_060 / width, 660 / height);
  const offsetX = (1_200 - width * scale) / 2 - left * scale;
  const offsetY = (800 - height * scale) / 2 - top * scale;
  const scalePoint = (point: ConnectorEndpoint): ConnectorEndpoint => ({
    ...point,
    x: point.x * scale + offsetX,
    y: point.y * scale + offsetY
  });

  return objects.map((object) => {
    if (object.type === "shape") {
      return {
        ...object,
        geometry: {
          x: object.geometry.x * scale + offsetX,
          y: object.geometry.y * scale + offsetY,
          width: object.geometry.width * scale,
          height: object.geometry.height * scale
        }
      };
    }
    if (object.type === "text") {
      return {
        ...object,
        geometry: {
          x: object.geometry.x * scale + offsetX,
          y: object.geometry.y * scale + offsetY,
          width: object.geometry.width * scale,
          height: object.geometry.height * scale
        },
        fontSize: object.fontSize * scale
      };
    }
    if (object.type === "stroke") {
      return { ...object, points: object.points.map(scalePoint) };
    }
    return { ...object, start: scalePoint(object.start), end: scalePoint(object.end) };
  });
};
