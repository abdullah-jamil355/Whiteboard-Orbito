import type { ReactElement } from "react";
import type { ShapeObject } from "..";
import { CanvasShape } from "./canvas-shape";

type CanvasShapeDefinitionsProps = Readonly<{
  gridSpacing: number;
  shapes: readonly ShapeObject[];
  selectedShapeId: string | null;
  resizeGeometry: ShapeObject["geometry"] | null;
}>;

export const CanvasShapeDefinitions = ({ gridSpacing, shapes, selectedShapeId, resizeGeometry }: CanvasShapeDefinitionsProps): ReactElement => (
  <defs>
    <pattern height={gridSpacing} id="wb-graph-paper" patternUnits="userSpaceOnUse" width={gridSpacing}>
      <path d={`M ${gridSpacing} 0 H 0 V ${gridSpacing}`} fill="none" stroke="var(--wb-grid-line, #e7edf5)" strokeWidth="0.8" />
    </pattern>
    {shapes.map((shape) => {
      const geometry = shape.id === selectedShapeId && resizeGeometry !== null ? resizeGeometry : shape.geometry;
      return (
        <clipPath clipPathUnits="userSpaceOnUse" id={`wb-shape-clip-${shape.id}`} key={shape.id}>
          <CanvasShape geometry={geometry} shape={shape.shape} />
        </clipPath>
      );
    })}
  </defs>
);
