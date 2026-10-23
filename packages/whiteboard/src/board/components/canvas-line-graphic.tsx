import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { connectorRoutePoints, LINE_WEIGHT_STROKE_WIDTHS, type ArrowHead, type ConnectorEndpoint, type ConnectorRouting, type Coordinate, type LineWeight } from "..";
import { strokePointsAttribute } from "./canvas-geometry";

type CanvasLineGraphicProps = Readonly<{
  start: ConnectorEndpoint;
  end: ConnectorEndpoint;
  color: string;
  lineWeight: LineWeight;
  routing?: ConnectorRouting;
  startArrow?: ArrowHead;
  endArrow?: ArrowHead;
  waypoints?: readonly Coordinate[];
  onPointerDown?: (event: ReactPointerEvent<SVGElement>) => void;
  pointerEvents?: "none" | "stroke";
}>;

const arrowHeadPath = (tip: ConnectorEndpoint, adjacent: ConnectorEndpoint, type: ArrowHead): string | null => {
  if (type === "none") return null;
  const deltaX = tip.x - adjacent.x;
  const deltaY = tip.y - adjacent.y;
  const length = Math.max(1, Math.hypot(deltaX, deltaY));
  const unitX = deltaX / length;
  const unitY = deltaY / length;
  const perpendicularX = -unitY;
  const perpendicularY = unitX;
  const size = type === "block" ? 11 : type === "diamond" ? 12 : type === "circle" ? 8 : 10;
  const halfWidth = type === "block" ? 4.5 : type === "diamond" ? 5 : type === "circle" ? 4 : 4.5;
  const baseX = tip.x - unitX * size;
  const baseY = tip.y - unitY * size;
  if (type === "circle") {
    const centerX = tip.x - (unitX * size) / 2;
    const centerY = tip.y - (unitY * size) / 2;
    const radius = size / 2;
    return `M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 1 0 ${centerX + radius} ${centerY} A ${radius} ${radius} 0 1 0 ${centerX - radius} ${centerY} Z`;
  }
  if (type === "diamond") {
    const centerX = tip.x - unitX * size;
    const centerY = tip.y - unitY * size;
    const backX = tip.x - unitX * size * 2;
    const backY = tip.y - unitY * size * 2;
    return `M ${tip.x} ${tip.y} L ${centerX + perpendicularX * halfWidth} ${centerY + perpendicularY * halfWidth} L ${backX} ${backY} L ${centerX - perpendicularX * halfWidth} ${centerY - perpendicularY * halfWidth} Z`;
  }
  const leftX = baseX + perpendicularX * halfWidth;
  const leftY = baseY + perpendicularY * halfWidth;
  const rightX = baseX - perpendicularX * halfWidth;
  const rightY = baseY - perpendicularY * halfWidth;
  return type === "open"
    ? `M ${leftX} ${leftY} L ${tip.x} ${tip.y} L ${rightX} ${rightY}`
    : `M ${tip.x} ${tip.y} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`;
};

const findAdjacent = (tip: Coordinate, points: readonly Coordinate[], fromStart: boolean): Coordinate => {
  if (points.length < 2) return tip;
  if (fromStart) {
    for (let i = 1; i < points.length; i++) {
      const pt = points[i]!;
      if (Math.hypot(pt.x - tip.x, pt.y - tip.y) > 0.5) return pt;
    }
    return points[1] ?? tip;
  }
  for (let i = points.length - 2; i >= 0; i--) {
    const pt = points[i]!;
    if (Math.hypot(pt.x - tip.x, pt.y - tip.y) > 0.5) return pt;
  }
  return points.at(-2) ?? tip;
};

export const CanvasLineGraphic = ({ start, end, color, lineWeight, routing = "straight", startArrow = "none", endArrow = "none", waypoints, onPointerDown, pointerEvents }: CanvasLineGraphicProps): ReactElement => {
  const points = connectorRoutePoints(start, end, routing, waypoints);
  const resolvedStart = findAdjacent(start, points, true);
  const resolvedEnd = findAdjacent(end, points, false);
  const startPath = arrowHeadPath(start, resolvedStart, startArrow);
  const endPath = arrowHeadPath(end, resolvedEnd, endArrow);
  const strokeWidth = LINE_WEIGHT_STROKE_WIDTHS[lineWeight];
  return (
    <g fill="none" stroke={color} strokeLinecap="round" strokeLinejoin="round" strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke">
      <polyline points={strokePointsAttribute(points)} onPointerDown={onPointerDown} pointerEvents={pointerEvents} />
      {startPath !== null && <path d={startPath} fill={startArrow === "open" ? "none" : color} strokeWidth={startArrow === "open" ? strokeWidth : 1} />}
      {endPath !== null && <path d={endPath} fill={endArrow === "open" ? "none" : color} strokeWidth={endArrow === "open" ? strokeWidth : 1} />}
    </g>
  );
};
