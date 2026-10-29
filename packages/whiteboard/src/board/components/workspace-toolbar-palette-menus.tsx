import type { CSSProperties, ReactElement } from "react";
import { Shapes, StickyNote } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import {
  isShapeTool,
  STICKY_NOTE_COLORS,
  type StickyNoteShape,
  type WhiteboardTool
} from "..";
import { SHAPE_LIBRARY_GROUPS, ShapeLibraryIcon } from "./shape-library";

export type ShapesMenuProps = Readonly<{
  isOpen: boolean;
  onSelect: (shape: WhiteboardTool) => void;
  onToggle: () => void;
  selectedTool: WhiteboardTool;
}>;

export const ToolbarShapesMenu = ({
  isOpen,
  onSelect,
  onToggle,
  selectedTool
}: ShapesMenuProps): ReactElement => {
  return (
    <details className="wb-shape-library" data-active={isShapeTool(selectedTool)} open={isOpen}>
      <summary
        aria-label="Open shape libraries"
        onClick={(event) => {
          event.preventDefault();
          onToggle();
        }}
        title="General and Basic shapes"
      >
        <Shapes />
        <span aria-hidden="true">Shapes</span>
      </summary>
      <div className="wb-shape-library-menu">
        {SHAPE_LIBRARY_GROUPS.map(({ name, shapes }) => (
          <section aria-label={`${name} shapes`} className="wb-shape-library-group" key={name}>
            <h3>{name}</h3>
            <div>
              {shapes.map(({ label, shape }) => (
                <Button
                  aria-label={`${label} shape`}
                  aria-pressed={selectedTool === shape}
                  key={shape}
                  onClick={() => onSelect(shape)}
                  size="sm"
                  title={`${label} shape`}
                  variant={selectedTool === shape ? "secondary" : "ghost"}
                >
                  <ShapeLibraryIcon shape={shape} />
                  {label}
                </Button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </details>
  );
};

export type StickyNoteMenuProps = Readonly<{
  isOpen: boolean;
  onChooseFill: (fill: string) => void;
  onChooseShape: (shape: StickyNoteShape) => void;
  onOpen: () => void;
  onToggle: () => void;
  selectedTool: WhiteboardTool;
  stickyNoteFill: string;
  stickyNoteShape: StickyNoteShape;
}>;

export const ToolbarStickyNoteMenu = ({
  isOpen,
  onChooseFill,
  onChooseShape,
  onOpen,
  onToggle,
  selectedTool,
  stickyNoteFill,
  stickyNoteShape
}: StickyNoteMenuProps): ReactElement => {
  return (
    <details className="wb-sticky-note-menu" open={isOpen}>
      <summary
        aria-label="Sticky note tool and options"
        aria-pressed={selectedTool === "sticky-note"}
        onClick={(event) => {
          event.preventDefault();
          onOpen();
          onToggle();
        }}
        title="Sticky note tool (N)"
      >
        <StickyNote />
        <span aria-hidden="true">Note</span>
      </summary>
      <div className="wb-sticky-note-menu-panel">
        <strong>New sticky note</strong>
        <div className="wb-sticky-note-color-list" role="group" aria-label="New sticky note color">
          {STICKY_NOTE_COLORS.map((color) => (
            <Button
              aria-label={`${color.name} sticky note`}
              aria-pressed={stickyNoteFill === color.fill}
              key={color.fill}
              onClick={() => onChooseFill(color.fill)}
              size="icon"
              style={{ "--wb-note-color": color.fill } as CSSProperties}
              title={color.name}
              variant="ghost"
            >
              <span aria-hidden="true" />
            </Button>
          ))}
        </div>
        <label>
          Shape
          <select
            aria-label="New sticky note shape"
            className="wb-line-weight-select"
            onChange={(event) => onChooseShape(event.currentTarget.value as StickyNoteShape)}
            value={stickyNoteShape}
          >
            <option value="rectangle">Rectangle</option>
            <option value="square">Square</option>
          </select>
        </label>
        <span>Click the board to place it</span>
      </div>
    </details>
  );
};
