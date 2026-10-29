"use client";

import type { ReactElement } from "react";

export type SparklineProps = Readonly<{
  data: readonly number[];
  color: string;
  fillId: string;
  height?: number;
}>;

export const Sparkline = ({
  data,
  color,
  fillId,
  height = 36
}: SparklineProps): ReactElement => {
  const points = data.length > 1 ? data : [0, 5, 2, 8, 4, 10];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 120;

  const step = width / (points.length - 1 || 1);
  const coords = points.map((val, idx) => {
    const x = idx * step;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return { x, y };
  });

  const pathD = coords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${String(curr.x)} ${String(curr.y)}`;
    const prev = arr[idx - 1];
    if (!prev) return acc;
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${String(cp1x)} ${String(cp1y)}, ${String(cp2x)} ${String(cp2y)}, ${String(curr.x)} ${String(curr.y)}`;
  }, "");

  const areaD = `${pathD} L ${String(width)} ${String(height)} L 0 ${String(height)} Z`;

  return (
    <svg
      className="overflow-visible w-full h-9"
      height={height}
      viewBox={`0 0 ${String(width)} ${String(height)}`}
    >
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
};
