import type { BoardObject, ConnectorEndpoint } from "./board";

export const remapObjectReferences = (object: BoardObject, idMap: ReadonlyMap<string, string>): BoardObject => {
  const id = idMap.get(object.id);
  if (id === undefined) throw new Error("A built-in template contains an unknown object reference.");

  switch (object.type) {
    case "shape":
      return { ...object, id, geometry: { ...object.geometry }, style: { ...object.style } };
    case "text": {
      const parentShapeId = object.parentShapeId === undefined ? undefined : idMap.get(object.parentShapeId);
      if (object.parentShapeId !== undefined && parentShapeId === undefined) {
        throw new Error("A built-in template contains an unknown text binding.");
      }
      return {
        ...object,
        id,
        geometry: { ...object.geometry },
        ...(parentShapeId === undefined ? {} : { parentShapeId })
      };
    }
    case "stroke":
      return { ...object, id, points: object.points.map((point) => ({ ...point })) };
    case "line":
    case "arrow":
      return { ...object, id, start: { ...object.start }, end: { ...object.end } };
    case "connector": {
      const remapEndpoint = (endpoint: ConnectorEndpoint): ConnectorEndpoint => {
        if (endpoint.shapeId === undefined) return { ...endpoint };
        const shapeId = idMap.get(endpoint.shapeId);
        if (shapeId === undefined) throw new Error("A built-in template contains an unknown connector binding.");
        return { ...endpoint, shapeId };
      };
      return { ...object, id, start: remapEndpoint(object.start), end: remapEndpoint(object.end) };
    }
  }
};
