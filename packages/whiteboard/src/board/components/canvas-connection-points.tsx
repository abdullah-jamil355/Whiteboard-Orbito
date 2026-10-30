import type { ReactElement } from "react";
import { SHAPE_CONNECTION_POINTS, shapeConnectionCoordinate, type ShapeObject } from "..";

type CanvasConnectionPointsProps = Readonly<{
  shapes: readonly ShapeObject[];
  visible: boolean;
}>;

export const CanvasConnectionPoints = ({ shapes, visible }: CanvasConnectionPointsProps): ReactElement | null => {
  if (!visible) return null;
  return (
    <>
      {shapes.flatMap((shape) =>
        SHAPE_CONNECTION_POINTS.map((connectionPoint) => {
          const point = shapeConnectionCoordinate(shape.geometry, connectionPoint, shape.shape);
          return (
            <circle
              aria-hidden="true"
              className="wb-connection-point"
              cx={point.x}
              cy={point.y}
              key={`${shape.id}-${connectionPoint}`}
              pointerEvents="none"
              r={5}
            />
          );
        })
      )}
    </>
  );
};
