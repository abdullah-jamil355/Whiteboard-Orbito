import type { ReactElement } from "react";
import { LINE_WEIGHT_STROKE_WIDTHS, type Coordinate, type ShapeObject } from "..";
import { strokePointsAttribute } from "./canvas-geometry.js";
import { CanvasShape } from "./canvas-shape.js";
import { CanvasLinePreview } from "./canvas-line-preview.js";
import { ERASER_RADIUS, renderCanvasColor, type PreviewLine, type WhiteboardCanvasProps } from "./canvas-model.js";

type CanvasDrawingPreviewsProps = Readonly<{
  penColor: string;
  penLineWeight: WhiteboardCanvasProps["penLineWeight"];
  previewLine: PreviewLine | null;
  previewPoints: readonly Coordinate[] | null;
  previewShape: Readonly<{ geometry: ShapeObject["geometry"]; shape: ShapeObject["shape"] }> | null;
  previewWipePath: readonly Coordinate[] | null;
  shapeFill: WhiteboardCanvasProps["shapeFill"];
  shapeLineWeight: WhiteboardCanvasProps["shapeLineWeight"];
  shapeStrokeColor: string;
}>;

export const CanvasDrawingPreviews = ({
  penColor,
  penLineWeight,
  previewLine,
  previewPoints,
  previewShape,
  previewWipePath,
  shapeFill,
  shapeLineWeight,
  shapeStrokeColor
}: CanvasDrawingPreviewsProps): ReactElement => {
  return (
    <>
      {previewPoints !== null && (
        <polyline
          fill="none"
          points={strokePointsAttribute(previewPoints.length === 1 ? [previewPoints[0]!, previewPoints[0]!] : previewPoints)}
          stroke={renderCanvasColor(penColor)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={LINE_WEIGHT_STROKE_WIDTHS[penLineWeight]}
          vectorEffect="non-scaling-stroke"
        />
      )}
      <CanvasLinePreview line={previewLine} />
      {previewShape !== null && (() => {
        const { geometry, shape } = previewShape;
        const common = {
          fill: shapeFill,
          stroke: renderCanvasColor(shapeStrokeColor, shapeFill),
          strokeWidth: LINE_WEIGHT_STROKE_WIDTHS[shapeLineWeight],
          vectorEffect: "non-scaling-stroke" as const
        };
        return <CanvasShape {...common} geometry={geometry} shape={shape} />;
      })()}
      {previewWipePath !== null && previewWipePath.length > 0 && (
        <g aria-hidden="true" pointerEvents="none">
          <polyline
            fill="none"
            points={strokePointsAttribute(previewWipePath)}
            stroke="#bf4b4b"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={0.18}
            strokeWidth={ERASER_RADIUS * 2}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={previewWipePath.at(-1)!.x}
            cy={previewWipePath.at(-1)!.y}
            fill="#ffffff"
            fillOpacity={0.45}
            r={ERASER_RADIUS}
            stroke="#bf4b4b"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        </g>
      )}
    </>
  );
};
