import type { ShapeObject } from "../src/board/board.js";

export const shapeObject = (
  id: string,
  x: number,
  y: number,
  width: number,
  height: number,
  shape: ShapeObject["shape"] = "rectangle"
): ShapeObject => ({
  id,
  type: "shape",
  shape,
  geometry: { x, y, width, height },
  style: { fill: "#ffffff", stroke: "#315f8b", lineWeight: "medium" }
});
