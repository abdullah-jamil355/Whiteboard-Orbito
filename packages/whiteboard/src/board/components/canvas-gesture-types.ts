import type { Dispatch, SetStateAction } from "react";
import type { Board, Coordinate, ShapeObject, TextObject, WhiteboardTool } from "..";
import type { BoardBounds } from "../object-operations";
import type { ActiveGesture, CanvasBounds, CanvasCamera, PreviewLine, TextClick, WhiteboardCanvasProps } from "./canvas-model";

export type CanvasPreviewShape = Readonly<{ shape: ShapeObject["shape"]; geometry: ShapeObject["geometry"] }>;
export type CanvasSelectionBox = Readonly<{ origin: Coordinate; current: Coordinate }>;
export type CanvasObjectResizePreview = Readonly<{ object: Board["objects"][number]; bounds: BoardBounds }>;
export type CanvasMutableRef<T> = { current: T };
export type CanvasStateSetter<T> = Dispatch<SetStateAction<T>>;

export type CanvasGestureState = CanvasGestureDependencies["state"];
export type CanvasGestureDependencies = Readonly<{
  board: Readonly<{ board: Board; shapes: readonly ShapeObject[] }>;
  view: Readonly<{
    bounds: CanvasBounds;
    camera: CanvasCamera;
    setCamera: CanvasStateSetter<CanvasCamera>;
    selectedTool: WhiteboardTool;
    selectedShapeId: string | null;
    selectedObjectIds: readonly string[];
    spacePressed: boolean;
  }>;
  style: Readonly<{
    penColor: string;
    penLineWeight: WhiteboardCanvasProps["penLineWeight"];
    shapeStrokeColor: string;
    shapeLineWeight: WhiteboardCanvasProps["shapeLineWeight"];
    shapeFill: WhiteboardCanvasProps["shapeFill"];
    lineColor: string;
    lineLineWeight: WhiteboardCanvasProps["lineLineWeight"];
    connectorRouting: WhiteboardCanvasProps["connectorRouting"];
    lineStartArrow: WhiteboardCanvasProps["lineStartArrow"];
    lineEndArrow: WhiteboardCanvasProps["lineEndArrow"];
  }>;
  state: Readonly<{
    activeGestureRef: CanvasMutableRef<ActiveGesture | null>;
    previousTextClickRef: CanvasMutableRef<TextClick | null>;
    pointsRef: CanvasMutableRef<Coordinate[]>;
    eraserPathRef: CanvasMutableRef<Coordinate[]>;
    setPreviewPoints: CanvasStateSetter<readonly Coordinate[] | null>;
    setPreviewWipePath: CanvasStateSetter<readonly Coordinate[] | null>;
    setPreviewShape: CanvasStateSetter<CanvasPreviewShape | null>;
    setPreviewLine: CanvasStateSetter<PreviewLine | null>;
    setResizeGeometry: CanvasStateSetter<ShapeObject["geometry"] | null>;
    setTextPreviewGeometry: CanvasStateSetter<TextObject["geometry"] | null>;
    setSelectionBox: CanvasStateSetter<CanvasSelectionBox | null>;
    setObjectResizePreview: CanvasStateSetter<CanvasObjectResizePreview | null>;
  }>;
  callbacks: Pick<WhiteboardCanvasProps,
    | "onLineCommit" | "onStrokeCommit" | "onEraseCommit" | "onShapeCommit" | "onShapeGeometryChange"
    | "onShapeSelect" | "onSelectionChange" | "onObjectsMove" | "onObjectResize" | "onTextCreate" | "onStickyNoteCreate"
    | "onTextSelect" | "onTextEditStart" | "onTextGeometryChange" | "onUpdateWaypoints"
  >;
}>;
