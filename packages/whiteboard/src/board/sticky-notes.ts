import type { Coordinate, ShapeObject, TextObject } from "./board";

export const STICKY_NOTE_WIDTH = 180;
export const STICKY_NOTE_HEIGHT = 140;
export const MAX_STICKY_NOTE_TEXT_LENGTH = 3000;
export const STICKY_NOTE_COLORS = [
  { name: "Yellow", fill: "#fff2a8", stroke: "#d6b84f" },
  { name: "Pink", fill: "#ffd9e8", stroke: "#df9db8" },
  { name: "Lavender", fill: "#e8ddff", stroke: "#b39add" },
  { name: "Blue", fill: "#d8edff", stroke: "#91b9df" },
  { name: "Cyan", fill: "#d5f5f3", stroke: "#8cc9c4" },
  { name: "Green", fill: "#ddf4d1", stroke: "#a5c58c" },
  { name: "Peach", fill: "#ffe3ce", stroke: "#dda982" },
  { name: "Gray", fill: "#e8ebef", stroke: "#b4bcc7" },
  { name: "Gold", fill: "#ffe4a3", stroke: "#d0aa55" },
  { name: "Orange", fill: "#ffd6b0", stroke: "#dc9c70" },
  { name: "Rose", fill: "#ffc9c9", stroke: "#d79393" },
  { name: "Magenta", fill: "#f5d1f0", stroke: "#d49aca" },
  { name: "Purple", fill: "#dfd3ff", stroke: "#aa93d7" },
  { name: "Sky", fill: "#cceeff", stroke: "#88badd" },
  { name: "Mint", fill: "#c8f0df", stroke: "#87c4a5" },
  { name: "Lime", fill: "#e9f5b8", stroke: "#bdcc77" }
] as const;
export const STICKY_NOTE_FILL = STICKY_NOTE_COLORS[0].fill;
export const STICKY_NOTE_SQUARE_SIZE = 180;
export type StickyNoteShape = "square" | "rectangle";

export const createStickyNoteObjects = (
  position: Coordinate,
  shapeId: string,
  textId: string,
  options: Readonly<{ fill?: string; shape?: StickyNoteShape }> = {}
): readonly [ShapeObject, TextObject] => {
  const color = STICKY_NOTE_COLORS.find(({ fill }) => fill === options.fill) ?? STICKY_NOTE_COLORS[0];
  const shapeKind = options.shape ?? "rectangle";
  const width = shapeKind === "square" ? STICKY_NOTE_SQUARE_SIZE : STICKY_NOTE_WIDTH;
  const height = shapeKind === "square" ? STICKY_NOTE_SQUARE_SIZE : STICKY_NOTE_HEIGHT;
  const shape: ShapeObject = {
    id: shapeId,
    type: "shape",
    shape: "rectangle",
    stickyNote: true,
    geometry: {
      x: position.x - width / 2,
      y: position.y - height / 2,
      width,
      height
    },
    style: { fill: color.fill, stroke: color.stroke, lineWeight: "thin" }
  };
  const text: TextObject = {
    id: textId,
    type: "text",
    geometry: { x: shape.geometry.x + 12, y: shape.geometry.y + 12, width: width - 24, height: height - 24 },
    text: "Write a note...",
    alignment: "left",
    fontSize: 16,
    bold: false,
    color: "#000000",
    parentShapeId: shapeId
  };
  return [shape, text];
};
