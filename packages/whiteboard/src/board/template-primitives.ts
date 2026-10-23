import type { BoardObject, ConnectorEndpoint } from "./board";

export type BoardTemplate = Readonly<{
  id: string;
  name: string;
  description: string;
  preview: "blank" | "hierarchy" | "entities" | "mind-map" | "kanban" | "flow" | "lanes" | "workflow" | "data-flow" | "sequence" | "use-case" | "activity";
  objects: readonly BoardObject[];
}>;

export const rectangle = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "#ffffff"
): BoardObject => ({
  id,
  type: "shape",
  shape: "rectangle",
  geometry: { x, y, width, height },
  style: { fill, stroke: "#315f8b", lineWeight: "medium" }
});

export const circle = (id: string, x: number, y: number, width: number, height: number, fill = "#e8f1fb"): BoardObject => ({
  id,
  type: "shape",
  shape: "circle",
  geometry: { x, y, width, height },
  style: { fill, stroke: "#315f8b", lineWeight: "medium" }
});

export const diamond = (id: string, x: number, y: number, width: number, height: number): BoardObject => ({
  id,
  type: "shape",
  shape: "diamond",
  geometry: { x, y, width, height },
  style: { fill: "#fff5df", stroke: "#a56b1f", lineWeight: "medium" }
});

export const label = (id: string, text: string, x: number, y: number, width = 150, height = 32, parentShapeId?: string): BoardObject => ({
  id,
  type: "text",
  text,
  geometry: { x, y, width, height },
  alignment: "center",
  fontSize: 16,
  bold: false,
  color: "#172033",
  ...(parentShapeId === undefined ? {} : { parentShapeId })
});

export const arrow = (id: string, start: ConnectorEndpoint, end: ConnectorEndpoint): BoardObject => ({
  id,
  type: "arrow",
  start,
  end,
  color: "#52657d",
  lineWeight: "thin"
});

