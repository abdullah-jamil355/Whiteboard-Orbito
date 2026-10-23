"use client";

import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactElement } from "react";
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Underline } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import { MAX_STICKY_NOTE_TEXT_LENGTH, STICKY_NOTE_COLORS, type ShapeObject, type StickyNoteShape, type TextObject } from "..";

type StickyNoteContextToolbarProps = Readonly<{
  shape: ShapeObject;
  text: TextObject;
  zoom: number;
  placement: "above" | "below";
  onFillChange: (shapeId: string, fill: string) => void;
  onShapeChange: (shape: ShapeObject, kind: StickyNoteShape) => void;
  onTextChange: (textId: string, update: Partial<Pick<TextObject, "alignment" | "fontSize" | "bold" | "italic" | "underline">>) => void;
}>;

const stopCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => event.stopPropagation();

export const StickyNoteContextToolbar = ({ shape, text, zoom, placement, onFillChange, onShapeChange, onTextChange }: StickyNoteContextToolbarProps): ReactElement => {
  const selectedShape: StickyNoteShape = shape.geometry.width === shape.geometry.height ? "square" : "rectangle";
  const y = placement === "above" ? -102 * zoom : (shape.geometry.height + 8) * zoom;
  return (
    <g className="wb-sticky-context-anchor" transform={`translate(${shape.geometry.x} ${shape.geometry.y}) scale(${1 / zoom})`}>
      <foreignObject height={96 * zoom} width={380 * zoom} x={0} y={y}>
        <div className="wb-sticky-context-toolbar" onPointerDown={stopCanvasPointerDown}>
          <div aria-label="Sticky note color" className="wb-sticky-note-color-list wb-sticky-context-colors" role="group">
            {STICKY_NOTE_COLORS.map((color) => (
              <Button aria-label={`${color.name} sticky note`} aria-pressed={shape.style.fill === color.fill} key={color.fill} onClick={() => onFillChange(shape.id, color.fill)} size="icon" style={{ "--wb-note-color": color.fill } as CSSProperties} title={color.name} variant="ghost"><span aria-hidden="true" /></Button>
            ))}
          </div>
          <div className="wb-sticky-context-formatting" role="group" aria-label="Sticky note formatting">
            <select aria-label="Sticky note shape" className="wb-sticky-context-select" onChange={(event) => onShapeChange(shape, event.currentTarget.value as StickyNoteShape)} value={selectedShape}>
              <option value="rectangle">Rectangle</option><option value="square">Square</option>
            </select>
            <select aria-label="Sticky note text size" className="wb-sticky-context-select wb-sticky-context-font-size" onChange={(event) => onTextChange(text.id, { fontSize: Number(event.currentTarget.value) })} value={String(text.fontSize)}>
              {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map((size) => <option key={size} value={size}>{size}px</option>)}
            </select>
            <div aria-label="Sticky note text alignment" className="wb-sticky-context-actions" role="group">
              {(["left", "center", "right"] as const).map((alignment) => {
                const Icon = alignment === "left" ? AlignLeft : alignment === "center" ? AlignCenter : AlignRight;
                return <Button aria-label={`Align ${alignment}`} aria-pressed={text.alignment === alignment} key={alignment} onClick={() => onTextChange(text.id, { alignment })} size="icon" title={`Align ${alignment}`} variant={text.alignment === alignment ? "secondary" : "ghost"}><Icon /></Button>;
              })}
            </div>
            <Button aria-label="Bold text" aria-pressed={text.bold} onClick={() => onTextChange(text.id, { bold: !text.bold })} size="icon" title="Bold text" variant={text.bold ? "secondary" : "ghost"}><Bold /></Button>
            <Button aria-label="Italic text" aria-pressed={text.italic === true} onClick={() => onTextChange(text.id, { italic: text.italic !== true })} size="icon" title="Italic text" variant={text.italic === true ? "secondary" : "ghost"}><Italic /></Button>
            <Button aria-label="Underline text" aria-pressed={text.underline === true} onClick={() => onTextChange(text.id, { underline: text.underline !== true })} size="icon" title="Underline text" variant={text.underline === true ? "secondary" : "ghost"}><Underline /></Button>
            <span aria-live="polite" className="wb-sticky-context-count">{text.text.length}/{MAX_STICKY_NOTE_TEXT_LENGTH}</span>
          </div>
        </div>
      </foreignObject>
    </g>
  );
};
