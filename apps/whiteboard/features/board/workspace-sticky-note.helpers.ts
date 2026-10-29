import {
  STICKY_NOTE_COLORS,
  STICKY_NOTE_HEIGHT,
  STICKY_NOTE_SQUARE_SIZE,
  STICKY_NOTE_WIDTH,
  type Board,
  type ShapeObject,
  type StickyNoteShape
} from "@workspace/whiteboard";

export const getSelectedStickyNote = (
  board: Board,
  selectedShape: ShapeObject | null,
  selectedText: Board["objects"][number] | null
): { shape: ShapeObject; text: Board["objects"][number] } | null => {
  const selectedStickyNoteShape =
    selectedShape?.stickyNote === true
      ? selectedShape
      : selectedText && "parentShapeId" in selectedText && selectedText.parentShapeId !== undefined
        ? board.objects.find(
            (object): object is ShapeObject =>
              object.type === "shape" &&
              object.id === selectedText.parentShapeId &&
              object.stickyNote === true
          ) ?? null
        : null;

  const selectedStickyNoteText =
    selectedStickyNoteShape === null
      ? null
      : board.objects.find(
          (object) => object.type === "text" && object.parentShapeId === selectedStickyNoteShape.id
        ) ?? null;

  return selectedStickyNoteShape !== null && selectedStickyNoteText?.type === "text"
    ? { shape: selectedStickyNoteShape, text: selectedStickyNoteText }
    : null;
};

export const updateStickyNoteFillHelper = (
  shapeId: string,
  fill: string,
  updateShapeStyle: (shapeId: string, style: { fill: string; stroke: string }) => void
): void => {
  const paletteColor = STICKY_NOTE_COLORS.find((color) => color.fill === fill);
  if (paletteColor !== undefined) {
    updateShapeStyle(shapeId, { fill, stroke: paletteColor.stroke });
  }
};

export const updateStickyNoteShapeHelper = (
  shape: ShapeObject,
  kind: StickyNoteShape,
  updateShapeGeometry: (shapeId: string, geom: { height: number; width: number; x: number; y: number }) => void
): void => {
  const size =
    kind === "square"
      ? STICKY_NOTE_SQUARE_SIZE
      : { width: STICKY_NOTE_WIDTH, height: STICKY_NOTE_HEIGHT };
  const width = typeof size === "number" ? size : size.width;
  const height = typeof size === "number" ? size : size.height;
  const centerX = shape.geometry.x + shape.geometry.width / 2;
  const centerY = shape.geometry.y + shape.geometry.height / 2;
  updateShapeGeometry(shape.id, {
    x: centerX - width / 2,
    y: centerY - height / 2,
    width,
    height
  });
};
