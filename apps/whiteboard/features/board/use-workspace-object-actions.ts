"use client";

import { useCallback } from "react";
import { createWhiteboardId } from "./create-whiteboard-id";
import {
  eraseBoardObjects, isLineWeight, updateShapeAndBoundTextGeometry, updateObjectWaypoints, WHITEBOARD_PALETTE,
  createStickyNoteObjects, type Board, type ConnectorObject, type Coordinate, type LineObject, type ShapeObject,
  type StrokeObject, type TextObject, type WhiteboardTool
} from "@workspace/whiteboard";
import {
  cloneBoardObjects, getObjectIdsWithDependents, moveBoardObjects, removeBoardObjects,
  reorderBoardObjects, resizeBoardObject, type BoardBounds
} from "@workspace/whiteboard";

type WorkspaceObjectActionsDependencies = Readonly<{
  board: Board;
  applyBoardEdit: (board: Board, recordHistory?: boolean) => void;
  selectedObjectIds: readonly string[];
  setSelectedObjectIds: (ids: readonly string[]) => void;
  setSelectedShapeId: (id: string | null) => void;
  setSelectedTextId: (id: string | null) => void;
  setEditingTextId: (id: string | null) => void;
  selectedShapeId: string | null;
  selectedTextId: string | null;
  selectedTool: WhiteboardTool;
  setSelectedTool: (tool: WhiteboardTool) => void;
  clipboardObjects: readonly Board["objects"][number][];
  setClipboardObjects: (objects: readonly Board["objects"][number][]) => void;
  setShapeStrokeColor: (color: string) => void;
  setShapeLineWeight: (weight: ShapeObject["style"]["lineWeight"]) => void;
  setShapeFill: (fill: string | "none") => void;
  stickyNoteOptions: Parameters<typeof createStickyNoteObjects>[3];
}>;

export const useWorkspaceObjectActions = ({
  board, applyBoardEdit, selectedObjectIds, setSelectedObjectIds, setSelectedShapeId,
  setSelectedTextId, setEditingTextId, selectedShapeId, selectedTextId, selectedTool,
  setSelectedTool, clipboardObjects, setClipboardObjects, setShapeStrokeColor, setShapeLineWeight, setShapeFill, stickyNoteOptions
}: WorkspaceObjectActionsDependencies) => {
  const commitStroke = (data: Omit<StrokeObject, "id" | "type">): void => {
    const stroke: StrokeObject = { ...data, id: createWhiteboardId(), type: "stroke" };
    applyBoardEdit({ ...board, objects: [...board.objects, stroke] });
  };
  const commitErase = (path: readonly Coordinate[], radius: number): void => {
    const result = eraseBoardObjects(board.objects, path, radius, createWhiteboardId);
    if (result.edit !== null) applyBoardEdit({ ...board, objects: result.objects });
  };
  const commitShape = (data: Omit<ShapeObject, "id" | "type">): void => {
    const shape: ShapeObject = { ...data, id: createWhiteboardId(), type: "shape" };
    applyBoardEdit({ ...board, objects: [...board.objects, shape] });
    setSelectedShapeId(shape.id);
    setSelectedObjectIds([shape.id]);
    setSelectedTool("select");
  };
  const commitLine = (data: Omit<LineObject, "id"> | Omit<ConnectorObject, "id">): void => {
    const line: LineObject | ConnectorObject = { ...data, id: createWhiteboardId() };
    applyBoardEdit({ ...board, objects: [...board.objects, line] });
  };
  const selectObjects = useCallback((ids: readonly string[]): void => {
    setSelectedObjectIds(ids);
    const selected = board.objects.filter((object) => ids.includes(object.id));
    setSelectedShapeId(selected.length === 1 && selected[0]?.type === "shape" ? selected[0].id : null);
    setSelectedTextId(selected.length === 1 && selected[0]?.type === "text" ? selected[0].id : null);
  }, [board, setSelectedObjectIds, setSelectedShapeId, setSelectedTextId]);
  const moveObjects = useCallback((ids: readonly string[], dx: number, dy: number): void => {
    applyBoardEdit(moveBoardObjects(board, ids, dx, dy));
  }, [applyBoardEdit, board]);
  const resizeObject = (id: string, bounds: BoardBounds): void => applyBoardEdit(resizeBoardObject(board, id, bounds));
  const updateWaypoints = useCallback((id: string, waypoints: readonly Coordinate[]): void => {
    applyBoardEdit(updateObjectWaypoints(board, id, waypoints));
  }, [applyBoardEdit, board]);
  const deleteSelected = useCallback((): void => {
    if (selectedObjectIds.length === 0) return;
    applyBoardEdit(removeBoardObjects(board, getObjectIdsWithDependents(board.objects, selectedObjectIds)));
    selectObjects([]);
  }, [applyBoardEdit, board, selectObjects, selectedObjectIds]);
  const copySelected = useCallback((cut = false): void => {
    if (selectedObjectIds.length === 0) return;
    const ids = getObjectIdsWithDependents(board.objects, selectedObjectIds);
    setClipboardObjects(board.objects.filter((object) => ids.has(object.id)));
    if (cut) {
      applyBoardEdit(removeBoardObjects(board, ids));
      selectObjects([]);
    }
  }, [applyBoardEdit, board, selectObjects, selectedObjectIds, setClipboardObjects]);
  const pasteObjects = useCallback((): void => {
    if (clipboardObjects.length === 0) return;
    const copies = cloneBoardObjects(clipboardObjects, clipboardObjects.map(({ id }) => id), createWhiteboardId);
    applyBoardEdit({ ...board, objects: [...board.objects, ...copies] });
    selectObjects(copies.map(({ id }) => id));
  }, [applyBoardEdit, board, clipboardObjects, selectObjects]);
  const duplicateSelected = useCallback((): void => {
    if (selectedObjectIds.length === 0) return;
    const ids = getObjectIdsWithDependents(board.objects, selectedObjectIds);
    const copies = cloneBoardObjects(board.objects, [...ids], createWhiteboardId);
    applyBoardEdit({ ...board, objects: [...board.objects, ...copies] }); selectObjects(copies.map(({ id }) => id));
  }, [applyBoardEdit, board, selectObjects, selectedObjectIds]);
  const changeStacking = useCallback((direction: "front" | "back"): void => {
    if (selectedObjectIds.length > 0) applyBoardEdit(reorderBoardObjects(board, selectedObjectIds, direction));
  }, [applyBoardEdit, board, selectedObjectIds]);
  const updateShapeGeometry = (id: string, geometry: ShapeObject["geometry"]): void => {
    applyBoardEdit(updateShapeAndBoundTextGeometry(board, id, geometry));
  };
  const updateShapeStyle = (id: string, update: Partial<ShapeObject["style"]>): void => {
    const objects = board.objects.map((object) => {
      if (object.id !== id || object.type !== "shape") return object;
      return { ...object, style: { ...object.style, ...update } };
    });
    applyBoardEdit({ ...board, objects });
  };
  const createText = (data: Omit<TextObject, "id" | "type">): string => {
    const id = createWhiteboardId();
    const text: TextObject = { ...data, id, type: "text" };
    applyBoardEdit({ ...board, objects: [...board.objects, text] });
    setSelectedTextId(id);
    setSelectedObjectIds([id]);
    setEditingTextId(id);
    setSelectedShapeId(data.parentShapeId ?? null);
    return id;
  };
  const createStickyNote = (position: Coordinate): void => {
    const [shape, text] = createStickyNoteObjects(position, createWhiteboardId(), createWhiteboardId(), stickyNoteOptions);
    applyBoardEdit({ ...board, objects: [...board.objects, shape, text] });
    setSelectedShapeId(shape.id);
    setSelectedTextId(text.id);
    setSelectedObjectIds([text.id]);
    setEditingTextId(text.id);
    setSelectedTool("select");
  };
  const updateText = (id: string, update: Partial<Pick<TextObject, "text" | "alignment" | "fontSize" | "bold" | "color" | "geometry" | "italic" | "underline">>): void => {
    const objects = board.objects.map((object) => (
      object.id === id && object.type === "text" ? { ...object, ...update } : object
    ));
    applyBoardEdit({ ...board, objects });
  };
  const updateTextGeometry = (id: string, geometry: TextObject["geometry"]): void => {
    const objects = board.objects.map((object) => (
      object.id === id && object.type === "text" ? { ...object, geometry } : object
    ));
    applyBoardEdit({ ...board, objects });
  };
  const activateTextTool = (): void => {
    setSelectedTool("text");
    setEditingTextId(null);
    setSelectedTextId(null);
    setSelectedShapeId(null);
  };
  const activateEraserTool = (): void => {
    setSelectedTool("eraser");
    setEditingTextId(null);
    setSelectedTextId(null);
    setSelectedShapeId(null);
  };
  const beginTextEditing = (id: string): void => {
    setSelectedTextId(id);
    setEditingTextId(id);
  };
  const selectedText = board.objects.find((object): object is TextObject => object.id === selectedTextId && object.type === "text") ?? null;
  const selectedShape = board.objects.find((object): object is ShapeObject => object.id === selectedShapeId && object.type === "shape") ?? null;
  const handleShapeSelect = useCallback((id: string | null): void => {
    setSelectedShapeId(id);
    if (id === null) setSelectedObjectIds([]);
  }, [setSelectedShapeId, setSelectedObjectIds]);
  const handleTextSelect = useCallback((id: string | null): void => {
    setSelectedTextId(id);
    if (id === null) setSelectedObjectIds([]);
  }, [setSelectedTextId, setSelectedObjectIds]);
  const chooseShapeStroke = (color: string): void => {
    setShapeStrokeColor(color);
    if (selectedTool === "select" && selectedShape !== null) updateShapeStyle(selectedShape.id, { stroke: color });
  };
  const chooseShapeFill = (fill: string): void => {
    if (fill !== "none" && !WHITEBOARD_PALETTE.some((color) => color.value === fill)) return;
    setShapeFill(fill);
    if (selectedTool === "select" && selectedShape !== null) updateShapeStyle(selectedShape.id, { fill });
  };
  const chooseShapeLineWeight = (weight: string): void => {
    if (!isLineWeight(weight)) return;
    if (selectedTool === "select" && selectedShape !== null) updateShapeStyle(selectedShape.id, { lineWeight: weight });
    else setShapeLineWeight(weight);
  };
  return {
    activateEraserTool, activateTextTool, beginTextEditing, changeStacking, chooseShapeFill, chooseShapeLineWeight,
    chooseShapeStroke, commitErase, commitLine, commitShape, commitStroke, copySelected, createStickyNote, createText, deleteSelected,
    duplicateSelected, handleShapeSelect, handleTextSelect, moveObjects, pasteObjects, resizeObject, selectObjects,
    selectedShape, selectedText, updateShapeGeometry, updateShapeStyle, updateText, updateTextGeometry, updateWaypoints
  };
};





