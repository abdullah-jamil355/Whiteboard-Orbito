import type { ReactElement, PointerEvent as ReactPointerEvent } from "react";
import type { BoardObject, ConnectorObject, Coordinate, LineObject, ShapeObject } from "..";
import { getObjectBounds, type BoardBounds } from "../object-operations";
import { resizedObjectForBounds } from "./canvas-geometry";
import { BoardObjectOutline, ObjectResizeHandles } from "./canvas-selection";
import { RESIZE_HANDLES, type ResizeHandle } from "./canvas-model";

type CanvasSelectionOverlaysProps = Readonly<{
  objects: readonly BoardObject[];
  selected: readonly string[];
  selectedShapeId: string | null;
  focusedObjectId: string | null;
  resizeGeometry: ShapeObject["geometry"] | null;
  selectionBox: Readonly<{ origin: Coordinate; current: Coordinate }> | null;
  objectResizePreview: Readonly<{ object: BoardObject; bounds: BoardBounds }> | null;
  selectedObject: BoardObject | null;
  selectedShape: ShapeObject | null;
  selectedGeometry: ShapeObject["geometry"] | null;
  resizeHandleSize: number;
  onOtherResizeStart: (event: ReactPointerEvent<SVGElement>, object: BoardObject, handle: ResizeHandle) => void;
  onShapeResizeStart: (event: ReactPointerEvent<SVGRectElement>, shape: ShapeObject, handle: ResizeHandle) => void;
  onWaypointPointerDown?: (event: ReactPointerEvent<SVGElement>, object: LineObject | ConnectorObject, index: number) => void;
  onMidpointPointerDown?: (event: ReactPointerEvent<SVGElement>, object: LineObject | ConnectorObject, index: number, point: Coordinate) => void;
  onWaypointDelete?: (object: LineObject | ConnectorObject, index: number) => void;
}>;

export const CanvasSelectionOverlays = ({
  objects, selected, selectedShapeId, focusedObjectId, resizeGeometry, selectionBox,
  objectResizePreview, selectedObject, selectedShape, selectedGeometry, resizeHandleSize,
  onOtherResizeStart, onShapeResizeStart, onWaypointPointerDown, onMidpointPointerDown, onWaypointDelete
}: CanvasSelectionOverlaysProps): ReactElement => {
  const shapes = objects.filter((item): item is ShapeObject => item.type === "shape");
  return (
  <>
    {selected.map((id) => {
      const object = objects.find((item) => item.id === id);
      if (object === undefined) return null;
      const geometry = object.id === selectedShapeId && resizeGeometry !== null ? resizeGeometry : undefined;
      return <BoardObjectOutline className="wb-object-selection-outline" geometry={geometry} key={`selected-${id}`} object={object} shapes={shapes} />;
    })}
    {focusedObjectId !== null && (() => {
      const object = objects.find((item) => item.id === focusedObjectId);
      if (object === undefined) return null;
      const geometry = object.id === selectedShapeId && resizeGeometry !== null ? resizeGeometry : undefined;
      return <BoardObjectOutline className="wb-keyboard-focus-ring" geometry={geometry} key={`focus-${focusedObjectId}`} object={object} shapes={shapes} />;
    })()}
    {selectionBox !== null && (
      <rect
        fill="#315f8b"
        fillOpacity={0.08}
        height={Math.abs(selectionBox.current.y - selectionBox.origin.y)}
        pointerEvents="none"
        stroke="#315f8b"
        strokeDasharray="4 3"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        width={Math.abs(selectionBox.current.x - selectionBox.origin.x)}
        x={Math.min(selectionBox.current.x, selectionBox.origin.x)}
        y={Math.min(selectionBox.current.y, selectionBox.origin.y)}
      />
    )}
    {objectResizePreview !== null && (
      <BoardObjectOutline
        className="wb-object-resize-preview"
        object={resizedObjectForBounds(objectResizePreview.object, objectResizePreview.bounds)}
      />
    )}
    {selectedObject !== null && selectedObject.type !== "shape" && (
      <ObjectResizeHandles
        bounds={getObjectBounds(selectedObject)}
        object={selectedObject}
        onResizeStart={onOtherResizeStart}
        {...(onWaypointPointerDown !== undefined ? { onWaypointPointerDown } : {})}
        {...(onMidpointPointerDown !== undefined ? { onMidpointPointerDown } : {})}
        {...(onWaypointDelete !== undefined ? { onWaypointDelete } : {})}
        size={resizeHandleSize}
      />
    )}
    {selectedShape !== null && selectedGeometry !== null && (
      <g aria-label={`Resize ${selectedShape.shape}`} className="wb-shape-selection">
        {RESIZE_HANDLES.map(({ id, x, y }) => (
          <rect
            aria-label={`Resize ${selectedShape.shape} ${id.replaceAll("-", " ")}`}
            className="wb-resize-handle"
            height={resizeHandleSize}
            key={id}
            onPointerDown={(event) => onShapeResizeStart(event, selectedShape, id)}
            rx={2}
            width={resizeHandleSize}
            x={x === 0 ? selectedGeometry.x - resizeHandleSize / 2 : selectedGeometry.x + selectedGeometry.width - resizeHandleSize / 2}
            y={y === 0 ? selectedGeometry.y - resizeHandleSize / 2 : selectedGeometry.y + selectedGeometry.height - resizeHandleSize / 2}
          />
        ))}
      </g>
    )}
  </>
  );
};
