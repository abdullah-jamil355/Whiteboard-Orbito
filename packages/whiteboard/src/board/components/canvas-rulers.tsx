import type { ReactElement } from "react";
import type { CanvasCamera } from "./canvas-model";

type CanvasRulersProps = Readonly<{ camera: CanvasCamera; width: number; height: number }>;

const RULER_STEP = 100;

const ticks = (start: number, end: number): readonly number[] => {
  const first = Math.floor(start / RULER_STEP) * RULER_STEP;
  const count = Math.ceil((end - first) / RULER_STEP);
  return Array.from({ length: count + 1 }, (_, index) => first + index * RULER_STEP);
};

export const CanvasRulers = ({ camera, width, height }: CanvasRulersProps): ReactElement => {
  const visibleWidth = width / camera.zoom;
  const visibleHeight = height / camera.zoom;
  const horizontalTicks = ticks(camera.x, camera.x + visibleWidth);
  const verticalTicks = ticks(camera.y, camera.y + visibleHeight);
  return (
    <div aria-hidden="true" className="wb-rulers">
      <svg className="wb-ruler-horizontal" viewBox={`0 0 ${width} 14`} preserveAspectRatio="none">
        <rect width={width} height="14" />
        {horizontalTicks.map((value) => {
          const x = (value - camera.x) * camera.zoom;
          return <g key={`x-${value}`}><path d={`M ${x} 9 V 14`} /><text x={x + 3} y="7">{value}</text></g>;
        })}
      </svg>
      <svg className="wb-ruler-vertical" viewBox={`0 0 21 ${height}`} preserveAspectRatio="none">
        <rect width="21" height={height} />
        {verticalTicks.map((value) => {
          const y = (value - camera.y) * camera.zoom;
          return <g key={`y-${value}`}><path d={`M 16 ${y} H 21`} /><text transform={`translate(13 ${y + 3}) rotate(-90)`}>{value}</text></g>;
        })}
      </svg>
      <span className="wb-ruler-corner" />
    </div>
  );
};
