import type { PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { connectorRoutePoints, shapeConnectionCoordinate, type BoardObject, type ConnectorEndpoint, type ConnectorObject, type Coordinate, type LineObject, type ShapeObject } from "..";
import type { BoardBounds } from "../object-operations";
import { arrowHeadPoints, strokePointsAttribute } from "./canvas-geometry";
import { RESIZE_HANDLES, type ResizeHandle } from "./canvas-model";
import { CanvasShape } from "./canvas-shape";

type ObjectResizeHandlesProps = Readonly<{
  object: BoardObject;
  bounds: BoardBounds;
  size: number;
  onResizeStart: (event: ReactPointerEvent<SVGElement>, object: BoardObject, handle: ResizeHandle) => void;
  onWaypointPointerDown?: (event: ReactPointerEvent<SVGElement>, object: LineObject | ConnectorObject, index: number) => void;
  onMidpointPointerDown?: (event: ReactPointerEvent<SVGElement>, object: LineObject | ConnectorObject, index: number, point: Coordinate) => void;
  onWaypointDelete?: (object: LineObject | ConnectorObject, index: number) => void;
}>;

export const resizeHandleAt = (point: Coordinate, bounds: BoardBounds): ResizeHandle => {
  const vertical = point.y <= (bounds.top + bounds.bottom) / 2 ? "north" : "south";
  const horizontal = point.x <= (bounds.left + bounds.right) / 2 ? "west" : "east";
  return `${vertical}-${horizontal}` as ResizeHandle;
};

export const ObjectResizeHandles = ({
  object,
  bounds,
  size,
  onResizeStart,
  onWaypointPointerDown,
  onMidpointPointerDown,
  onWaypointDelete
}: ObjectResizeHandlesProps): ReactElement => {
  if (object.type === "line" || object.type === "arrow" || object.type === "connector") {
    const vertices = [object.start, ...(object.waypoints ?? []), object.end];

    const midpoints: { point: Coordinate; index: number }[] = [];
    for (let index = 0; index < vertices.length - 1; index++) {
      const p1 = vertices[index]!;
      const p2 = vertices[index + 1]!;
      const distance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      if (distance >= 20) {
        midpoints.push({
          point: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
          index
        });
      }
    }

    return (
      <g aria-label={`Resize and route ${object.type} handles`} className="wb-shape-selection">
        {([object.start, object.end] as const).map((endpoint, index) => (
          <circle
            aria-label={`Resize ${object.type} ${index === 0 ? "start" : "end"}`}
            className={`wb-resize-handle wb-line-endpoint-handle ${endpoint.shapeId !== undefined ? "wb-endpoint-connected" : "wb-endpoint-free"}`}
            cx={endpoint.x}
            cy={endpoint.y}
            key={`endpoint-${index}-${endpoint.x}-${endpoint.y}`}
            onPointerDown={(event) => onResizeStart(event, object, resizeHandleAt(endpoint, bounds))}
            r={size / 2}
          />
        ))}

        {(object.waypoints ?? []).map((waypoint, wpIndex) => (
          <circle
            aria-label={`Waypoint ${wpIndex + 1}`}
            className="wb-resize-handle wb-waypoint-handle"
            cx={waypoint.x}
            cy={waypoint.y}
            key={`waypoint-${wpIndex}-${waypoint.x}-${waypoint.y}`}
            onDoubleClick={(event) => {
              event.stopPropagation();
              onWaypointDelete?.(object, wpIndex);
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              onWaypointPointerDown?.(event, object, wpIndex);
            }}
            r={size / 2}
          />
        ))}

        {midpoints.map(({ point, index }) => (
          <circle
            aria-label={`Add waypoint at segment ${index + 1}`}
            className="wb-resize-handle wb-waypoint-midpoint-handle"
            cx={point.x}
            cy={point.y}
            key={`midpoint-${index}-${point.x}-${point.y}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              onMidpointPointerDown?.(event, object, index, point);
            }}
            r={size / 2 - 1}
          />
        ))}
      </g>
    );
  }

  return (
    <g aria-label={`Resize ${object.type}`} className="wb-shape-selection">
      {RESIZE_HANDLES.map(({ id }) => <rect
        aria-label={`Resize ${object.type} ${id.replaceAll("-", " ")}`}
        className="wb-resize-handle"
        height={size}
        key={id}
        onPointerDown={(event) => onResizeStart(event, object, id)}
        rx={2}
        width={size}
        x={(id.endsWith("west") ? bounds.left : bounds.right) - size / 2}
        y={(id.startsWith("north") ? bounds.top : bounds.bottom) - size / 2}
      />)}
    </g>
  );
};

type BoardObjectOutlineProps = Readonly<{
  object: BoardObject;
  className: string;
  geometry?: ShapeObject["geometry"] | undefined;
  shapes?: readonly ShapeObject[];
}>;

export const BoardObjectOutline = ({ object, className, geometry, shapes }: BoardObjectOutlineProps): ReactElement | null => {
  const shared = {
    className,
    fill: "none",
    pointerEvents: "none" as const,
    vectorEffect: "non-scaling-stroke" as const
  };
  const resolveEndpoint = (endpoint: ConnectorEndpoint): ConnectorEndpoint => {
    if (shapes === undefined || endpoint.shapeId === undefined || endpoint.connectionPoint === undefined) return endpoint;
    const shape = shapes.find((item) => item.id === endpoint.shapeId);
    if (shape === undefined) return endpoint;
    return { ...endpoint, ...shapeConnectionCoordinate(shape.geometry, endpoint.connectionPoint, shape.shape) };
  };
  if (object.type === "stroke") {
    return <polyline {...shared} points={strokePointsAttribute(object.points)} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (object.type === "line" || object.type === "arrow") {
    const start = resolveEndpoint(object.start);
    const end = resolveEndpoint(object.end);
    const points = object.waypoints && object.waypoints.length > 0 ? [start, ...object.waypoints, end] : [start, end];
    return (
      <g className={className} fill="none" pointerEvents="none" vectorEffect="non-scaling-stroke">
        <polyline points={strokePointsAttribute(points)} strokeLinecap="round" strokeLinejoin="round" />
        {object.type === "arrow" && <polyline points={arrowHeadPoints(start, end)} strokeLinecap="round" strokeLinejoin="round" />}
      </g>
    );
  }
  if (object.type === "connector") {
    const start = resolveEndpoint(object.start);
    const end = resolveEndpoint(object.end);
    return <polyline {...shared} points={strokePointsAttribute(connectorRoutePoints(start, end, object.routing ?? "orthogonal", object.waypoints))} strokeLinecap="round" strokeLinejoin="round" />;
  }
  if (object.type === "text") {
    return <rect {...shared} height={object.geometry.height} width={object.geometry.width} x={object.geometry.x} y={object.geometry.y} />;
  }
  if (object.type !== "shape") return null;
  const shapeGeometry = geometry ?? object.geometry;
  return <CanvasShape {...shared} geometry={shapeGeometry} shape={object.shape} />;
};
