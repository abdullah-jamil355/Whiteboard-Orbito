import React, { type ReactElement, type SVGProps } from "react";
import type { ShapeKind } from "../board";
import { shapePath, type ShapeGeometry } from "./canvas-shape-path";

export const CanvasShape = ({ shape, geometry, ...props }: SVGProps<SVGPathElement> & Readonly<{ shape: ShapeKind; geometry: ShapeGeometry }>): ReactElement => (
  <path {...props} d={shapePath(shape, geometry)} />
);
