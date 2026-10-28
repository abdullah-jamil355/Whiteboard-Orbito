import React, { type PointerEvent as ReactPointerEvent, type ReactElement } from "react";
import { connectorRoutePoints, LINE_WEIGHT_STROKE_WIDTHS, MAX_STICKY_NOTE_TEXT_LENGTH, MAX_TEXT_LENGTH, shapeConnectionCoordinate, SHAPE_CONNECTION_POINTS, type BoardObject, type ConnectorEndpoint, type Coordinate, type ShapeObject, type TextObject, type WhiteboardTool } from "..";
import { geometryForShape, getShapeTextGeometry, strokePointsAttribute, textGeometryForShapeGeometry } from "./canvas-geometry";
import { CanvasShape } from "./canvas-shape";
import { CanvasLineGraphic } from "./canvas-line-graphic";
import { renderCanvasColor, type ConnectionDirection } from "./canvas-model";

type CanvasObjectRendererProps = Readonly<{
  object: BoardObject;
  shapes: readonly ShapeObject[];
  selectedTool: WhiteboardTool;
  selectedShapeId: string | null;
  selectedTextId: string | null;
  editingTextId: string | null;
  resizeGeometry: ShapeObject["geometry"] | null;
  textPreviewGeometry: TextObject["geometry"] | null;
  hoveredShapeId: string | null;
  onFocusObject: (objectId: string) => void;
  onObjectPointerDown: (event: ReactPointerEvent<SVGElement>, objectId: string) => void;
  onShapePointerDown: (event: ReactPointerEvent<SVGElement>, shapeId: string) => void;
  onTextPointerDown: (event: ReactPointerEvent<SVGForeignObjectElement>, text: TextObject) => void;
  onTextSelect: (textId: string | null) => void;
  onTextEditStart: (textId: string) => void;
  onTextEditFinish: (textId: string) => void;
  onTextChange: (textId: string, value: string, geometry?: TextObject["geometry"]) => void;
  onHoverShape: (shapeId: string | null) => void;
  onQuickConnectorCommit: (shape: ShapeObject, direction: ConnectionDirection) => void;
  onQuickConnectorStart: (event: ReactPointerEvent<SVGGElement>, shape: ShapeObject, direction: ConnectionDirection) => void;
}>;

const directionalOffset = (center: Coordinate, direction: ConnectionDirection): Coordinate => {
  switch (direction) {
    case "top": return { x: center.x, y: center.y - 18 };
    case "right": return { x: center.x + 18, y: center.y };
    case "bottom": return { x: center.x, y: center.y + 18 };
    case "left": return { x: center.x - 18, y: center.y };
  }
};

const resolveAttachedEndpoint = (
  endpoint: ConnectorEndpoint,
  shapes: readonly ShapeObject[],
  selectedShapeId?: string | null,
  resizeGeometry?: ShapeObject["geometry"] | null
): ConnectorEndpoint => {
  if (endpoint.shapeId === undefined || endpoint.connectionPoint === undefined) return endpoint;
  const shape = shapes.find((item) => item.id === endpoint.shapeId);
  if (shape === undefined) return endpoint;
  const geometry = shape.id === selectedShapeId && resizeGeometry != null ? resizeGeometry : shape.geometry;
  return { ...endpoint, ...shapeConnectionCoordinate(geometry, endpoint.connectionPoint, shape.shape) };
};

const directionArrowPath = (direction: ConnectionDirection): string => {
  switch (direction) {
    case "top": return "M -4 3 L 0 -3 L 4 3";
    case "right": return "M -3 -4 L 3 0 L -3 4";
    case "bottom": return "M -4 -3 L 0 3 L 4 -3";
    case "left": return "M 3 -4 L -3 0 L 3 4";
  }
};

const CanvasObjectRenderer = ({
  object,
  shapes,
  selectedTool,
  selectedShapeId,
  selectedTextId,
  editingTextId,
  resizeGeometry,
  textPreviewGeometry,
  hoveredShapeId,
  onFocusObject,
  onObjectPointerDown,
  onShapePointerDown,
  onTextPointerDown,
  onTextSelect,
  onTextEditStart,
  onTextEditFinish,
  onTextChange,
  onHoverShape,
  onQuickConnectorCommit,
  onQuickConnectorStart
}: CanvasObjectRendererProps): ReactElement | null => {
  if (object.type === "stroke") {
    return (
      <g aria-label="Freehand stroke" key={object.id} onFocus={() => onFocusObject(object.id)} role="button" tabIndex={selectedTool === "select" ? 0 : -1}>
        <polyline fill="none" points={strokePointsAttribute(object.points)} stroke={renderCanvasColor(object.color)} strokeLinecap="round" strokeLinejoin="round" strokeWidth={LINE_WEIGHT_STROKE_WIDTHS[object.lineWeight]} vectorEffect="non-scaling-stroke" />
        <polyline fill="none" onPointerDown={(event) => onObjectPointerDown(event, object.id)} pointerEvents={selectedTool === "select" ? "stroke" : "none"} points={strokePointsAttribute(object.points)} stroke="transparent" strokeWidth={16} />
      </g>
    );
  }

  if (object.type === "line" || object.type === "arrow") {
    const start = resolveAttachedEndpoint(object.start, shapes, selectedShapeId, resizeGeometry);
    const end = resolveAttachedEndpoint(object.end, shapes, selectedShapeId, resizeGeometry);
    const points = strokePointsAttribute(object.waypoints && object.waypoints.length > 0 ? [start, ...object.waypoints, end] : [start, end]);
    return (
      <g aria-label={object.type === "line" ? "Line" : "Arrow"} key={object.id} onFocus={() => onFocusObject(object.id)} role="button" tabIndex={selectedTool === "select" || selectedTool === "waypoints" ? 0 : -1}>
        <CanvasLineGraphic start={start} end={end} color={renderCanvasColor(object.color)} lineWeight={object.lineWeight} routing={object.routing ?? "straight"} startArrow={object.startArrow ?? "none"} endArrow={object.endArrow ?? (object.type === "arrow" ? "open" : "none")} {...(object.waypoints !== undefined ? { waypoints: object.waypoints } : {})} />
        <polyline fill="none" onPointerDown={(event) => onObjectPointerDown(event, object.id)} pointerEvents={selectedTool === "select" || selectedTool === "waypoints" ? "stroke" : "none"} points={points} stroke="transparent" strokeWidth={16} />
      </g>
    );
  }

  if (object.type === "connector") {
    const start = resolveAttachedEndpoint(object.start, shapes, selectedShapeId, resizeGeometry);
    const end = resolveAttachedEndpoint(object.end, shapes, selectedShapeId, resizeGeometry);
    const points = strokePointsAttribute(connectorRoutePoints(start, end, object.routing ?? "orthogonal", object.waypoints));
    return (
      <g aria-label="Connector" key={object.id} onFocus={() => onFocusObject(object.id)} role="button" tabIndex={selectedTool === "select" || selectedTool === "waypoints" ? 0 : -1}>
        <CanvasLineGraphic start={start} end={end} color={renderCanvasColor(object.color)} lineWeight={object.lineWeight} routing={object.routing ?? "orthogonal"} startArrow={object.startArrow ?? "none"} endArrow={object.endArrow ?? "block"} {...(object.waypoints !== undefined ? { waypoints: object.waypoints } : {})} />
        <polyline fill="none" onPointerDown={(event) => onObjectPointerDown(event, object.id)} pointerEvents={selectedTool === "select" || selectedTool === "waypoints" ? "stroke" : "none"} points={points} stroke="transparent" strokeWidth={16} />
      </g>
    );
  }

  if (object.type === "text") {
    const editing = editingTextId === object.id;
    const parentShape = object.parentShapeId === undefined ? undefined : shapes.find((shape) => shape.id === object.parentShapeId);
    const displayTextColor = renderCanvasColor(object.color, parentShape?.style.fill);
    const textGeometry = selectedTextId === object.id && textPreviewGeometry !== null
      ? textPreviewGeometry
      : parentShape !== undefined && parentShape.id === selectedShapeId && resizeGeometry !== null
        ? textGeometryForShapeGeometry(object, parentShape, resizeGeometry)
        : object.geometry;
    const textStyle = { fontSize: `${object.fontSize}px`, fontWeight: object.bold ? 700 : 400, fontStyle: object.italic ? "italic" : "normal", textDecoration: object.underline ? "underline" : "none", color: displayTextColor, textAlign: object.alignment } as const;
    return (
      <g aria-label={`Text: ${object.text || "empty"}`} key={object.id} onFocus={() => onFocusObject(object.id)} onKeyDown={(event) => {
        if (event.key !== "Enter" || selectedTool !== "select") return;
        event.preventDefault();
        onTextSelect(object.id);
        onTextEditStart(object.id);
      }} role="button" tabIndex={selectedTool === "select" ? 0 : -1}>
        <foreignObject className="wb-text-object" height={textGeometry.height} onDoubleClick={(event) => {
          if (selectedTool !== "select") return;
          event.preventDefault();
          event.stopPropagation();
          onTextSelect(object.id);
          onTextEditStart(object.id);
        }} onPointerDown={(event) => onTextPointerDown(event, object)} width={textGeometry.width} x={textGeometry.x} y={textGeometry.y}>
          {editing ? (
            <textarea aria-label={parentShape?.stickyNote ? "Edit sticky note" : object.parentShapeId === undefined ? "Edit board text" : "Edit shape text"} autoFocus className="wb-text-editor" maxLength={parentShape?.stickyNote ? MAX_STICKY_NOTE_TEXT_LENGTH : MAX_TEXT_LENGTH} onChange={(event) => {
              const value = event.currentTarget.value;
              onTextChange(object.id, value, parentShape === undefined ? undefined : getShapeTextGeometry(object, value, parentShape));
            }} onBlur={() => onTextEditFinish(object.id)} onKeyDown={(event) => {
              if (event.key === "Escape") { event.preventDefault(); event.currentTarget.blur(); }
              event.stopPropagation();
            }} onPointerDown={(event) => event.stopPropagation()} style={textStyle} value={object.text} />
          ) : (
            <div aria-label={object.text || "Empty board text"} className="wb-text-display" style={textStyle}>{object.text}</div>
          )}
        </foreignObject>
        {selectedTool === "select" && !editing && selectedTextId === object.id && <rect fill="none" height={textGeometry.height} pointerEvents="none" stroke="#315f8b" strokeDasharray="4 3" strokeWidth={1.5} vectorEffect="non-scaling-stroke" width={textGeometry.width} x={textGeometry.x} y={textGeometry.y} />}
      </g>
    );
  }

  if (object.type !== "shape") return null;
  const geometry = geometryForShape(object, object.id === selectedShapeId && resizeGeometry !== null ? resizeGeometry : object.geometry);
  const common = {
    fill: object.style.fill,
    stroke: renderCanvasColor(object.style.stroke, object.style.fill),
    strokeWidth: LINE_WEIGHT_STROKE_WIDTHS[object.style.lineWeight],
    pointerEvents: "all" as const,
    vectorEffect: "non-scaling-stroke" as const,
    onPointerDown: (event: ReactPointerEvent<SVGElement>) => onShapePointerDown(event, object.id)
  };
  const renderedShape = <CanvasShape {...common} geometry={geometry} shape={object.shape} />;
  const showQuickConnectors = selectedTool === "select" && (hoveredShapeId === object.id || selectedShapeId === object.id);

  return (
    <g aria-label={`${object.shape} shape`} key={object.id} onFocus={() => onFocusObject(object.id)} onPointerEnter={() => onHoverShape(object.id)} onPointerLeave={() => onHoverShape(null)} role="group" tabIndex={selectedTool === "select" ? 0 : -1}>
      {renderedShape}
      {showQuickConnectors && SHAPE_CONNECTION_POINTS.filter((point): point is ConnectionDirection => point !== "center").map((direction) => {
        const center = shapeConnectionCoordinate(geometry, direction, object.shape);
        const offset = directionalOffset(center, direction);
        return (
          <g aria-label={`Connect ${object.shape} ${direction}`} className="wb-quick-connector" key={`${object.id}-${direction}`} onKeyDown={(event) => {
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onQuickConnectorCommit(object, direction);
          }} onPointerDown={(event) => onQuickConnectorStart(event, object, direction)} role="button" tabIndex={0} transform={`translate(${offset.x} ${offset.y})`}>
            <circle r={11} />
            <path d={directionArrowPath(direction)} />
          </g>
        );
      })}
    </g>
  );
};

export { CanvasObjectRenderer };
