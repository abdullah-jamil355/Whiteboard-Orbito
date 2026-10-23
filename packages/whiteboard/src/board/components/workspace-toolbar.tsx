"use client";

import { useEffect, useState, type CSSProperties, type ReactElement } from "react";
import { CornerDownRight, Eraser, MousePointer2, Pencil, Redo2, Shapes, StickyNote, Type, Undo2, Waypoints } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import { ARROW_HEADS, CONNECTOR_ROUTINGS, isLineWeight, isShapeTool, STICKY_NOTE_COLORS, WHITEBOARD_PALETTE, type ArrowHead, type ConnectorRouting, type LineWeight, type StickyNoteShape, type TextObject, type WhiteboardTool } from "..";
import { PaletteChoices } from "./palette-choices";
import { SHAPE_LIBRARY_GROUPS, ShapeLibraryIcon } from "./shape-library";
import { CONNECTOR_STYLES, WAYPOINT_STYLES, ConnectorIcon, WaypointIcon } from "./connector-library";

export type WorkspaceToolbarProps = Readonly<{
  selectedTool: WhiteboardTool; setSelectedTool: (tool: WhiteboardTool) => void; readOnly?: boolean;
  activateEraserTool: () => void; activateTextTool: () => void;
  selectedText: TextObject | null; updateText: (id: string, update: Partial<Pick<TextObject, "text" | "alignment" | "fontSize" | "bold" | "color" | "italic" | "underline">>) => void;
  stickyNoteFill: string; setStickyNoteFill: (fill: string) => void; stickyNoteShape: "square" | "rectangle"; setStickyNoteShape: (shape: "square" | "rectangle") => void;
  penColor: string; setPenColor: (color: string) => void; penLineWeight: LineWeight; setPenLineWeight: (weight: LineWeight) => void;
  isLineTool: boolean; lineColor: string; setLineColor: (color: string) => void; lineLineWeight: LineWeight; setLineLineWeight: (weight: LineWeight) => void;
  connectorRouting: ConnectorRouting; setConnectorRouting: (routing: ConnectorRouting) => void;
  lineStartArrow: ArrowHead; setLineStartArrow: (arrow: ArrowHead) => void;
  lineEndArrow: ArrowHead; setLineEndArrow: (arrow: ArrowHead) => void;
  showShapeStyle: boolean; currentShapeStroke: string; chooseShapeStroke: (color: string) => void; currentShapeFill: string | "none";
  chooseShapeFill: (fill: string) => void; currentShapeWeight: LineWeight; chooseShapeLineWeight: (weight: string) => void;
  canUndo: boolean; canRedo: boolean;
  undoEdit: () => void; redoEdit: () => void;
}>;

export const WorkspaceToolbar = (props: WorkspaceToolbarProps): ReactElement => {
  const {
    selectedTool, setSelectedTool, activateEraserTool, activateTextTool, selectedText, updateText,
    stickyNoteFill, setStickyNoteFill, stickyNoteShape, setStickyNoteShape,
    penColor, setPenColor, penLineWeight, setPenLineWeight, isLineTool, lineColor, setLineColor, lineLineWeight,
    connectorRouting, setConnectorRouting, lineStartArrow, setLineStartArrow, lineEndArrow, setLineEndArrow,
    setLineLineWeight, showShapeStyle, currentShapeStroke, chooseShapeStroke, currentShapeFill, chooseShapeFill,
    currentShapeWeight, chooseShapeLineWeight, canUndo, canRedo, undoEdit, redoEdit, readOnly = false
  } = props;

  const [openMenu, setOpenMenu] = useState<"shapes" | "waypoints" | "connectors" | "note" | null>(null);

  useEffect(() => {
    if (openMenu === null) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest(".wb-toolbar")) {
        setOpenMenu(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenu]);

  return (
    <nav className="wb-toolbar" aria-label="Whiteboard tools" inert={readOnly}>
      <div className="wb-tool-group wb-drawing-tools">
        <Button
          aria-label="Select tool"
          aria-pressed={selectedTool === "select"}
          onClick={() => { setSelectedTool("select"); setOpenMenu(null); }}
          size="icon"
          title="Select tool"
          variant={selectedTool === "select" ? "secondary" : "ghost"}
        ><MousePointer2 /><span aria-hidden="true">Select</span></Button>
        <Button
          aria-label="Pen tool"
          aria-pressed={selectedTool === "pen"}
          onClick={() => { setSelectedTool("pen"); setOpenMenu(null); }}
          size="icon"
          title="Pen tool"
          variant={selectedTool === "pen" ? "secondary" : "ghost"}
        ><Pencil /><span aria-hidden="true">Pen</span></Button>
        <Button
          aria-label="Eraser tool"
          aria-pressed={selectedTool === "eraser"}
          onClick={() => { activateEraserTool(); setOpenMenu(null); }}
          size="icon"
          title="Eraser tool"
          variant={selectedTool === "eraser" ? "secondary" : "ghost"}
        ><Eraser /><span aria-hidden="true">Eraser</span></Button>

        {/* 1. Shapes Library Menu */}
        <details className="wb-shape-library" data-active={isShapeTool(selectedTool)} open={openMenu === "shapes"}>
          <summary
            aria-label="Open shape libraries"
            onClick={(event) => {
              event.preventDefault();
              setOpenMenu((current) => current === "shapes" ? null : "shapes");
            }}
            title="General and Basic shapes"
          >
            <Shapes /><span aria-hidden="true">Shapes</span>
          </summary>
          <div className="wb-shape-library-menu">
            {SHAPE_LIBRARY_GROUPS.map(({ name, shapes }) => (
              <section aria-label={`${name} shapes`} className="wb-shape-library-group" key={name}>
                <h3>{name}</h3>
                <div>
                  {shapes.map(({ label, shape }) => (
                    <Button aria-label={`${label} shape`} aria-pressed={selectedTool === shape} key={shape} onClick={() => {
                      setSelectedTool(shape);
                      setOpenMenu(null);
                    }} size="sm" title={`${label} shape`} variant={selectedTool === shape ? "secondary" : "ghost"}>
                      <ShapeLibraryIcon shape={shape} />{label}
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </details>

        {/* 2. Waypoints Menu (Replaces Arrow) */}
        <details className="wb-shape-library wb-waypoints-library" data-active={selectedTool === "waypoints"} open={openMenu === "waypoints"}>
          <summary
            aria-label="Open waypoints routing styles"
            onClick={(event) => {
              event.preventDefault();
              setOpenMenu((current) => current === "waypoints" ? null : "waypoints");
            }}
            title="Draw.io Waypoints and routing styles"
          >
            <Waypoints /><span aria-hidden="true">Waypoints</span>
          </summary>
          <div className="wb-toolbar-popover-menu">
            <div className="wb-popover-header">
              <strong>Draw.io Waypoints & Routing</strong>
              <p>Choose routing style to bend lines through waypoints</p>
            </div>
            <div className="wb-popover-grid">
              {WAYPOINT_STYLES.map((item) => (
                <button
                  aria-label={`${item.label} waypoints`}
                  aria-pressed={connectorRouting === item.routing && selectedTool === "waypoints"}
                  className="wb-toolbar-popover-item"
                  key={item.id}
                  onClick={() => {
                    setConnectorRouting(item.routing);
                    setSelectedTool("waypoints");
                    setOpenMenu(null);
                  }}
                  type="button"
                >
                  <WaypointIcon id={item.id} />
                  <div className="wb-popover-item-text">
                    <span className="wb-popover-item-title">{item.label}</span>
                    <span className="wb-popover-item-desc">{item.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </details>

        {/* 3. Connectors Menu */}
        <details className="wb-shape-library wb-connectors-library" data-active={selectedTool === "connection" || selectedTool === "connector" || selectedTool === "arrow" || selectedTool === "line"} open={openMenu === "connectors"}>
          <summary
            aria-label="Open connectors library"
            onClick={(event) => {
              event.preventDefault();
              setOpenMenu((current) => current === "connectors" ? null : "connectors");
            }}
            title="Draw.io Connectors and Arrows"
          >
            <CornerDownRight /><span aria-hidden="true">Connector</span>
          </summary>
          <div className="wb-toolbar-popover-menu">
            <div className="wb-popover-header">
              <strong>Draw.io Connectors & Arrows</strong>
              <p>Choose connector style to draw and snap between shapes</p>
            </div>
            <div className="wb-popover-grid">
              {CONNECTOR_STYLES.map((item) => (
                <button
                  aria-label={item.label}
                  aria-pressed={selectedTool === item.tool && connectorRouting === item.routing && lineEndArrow === item.endArrow}
                  className="wb-toolbar-popover-item"
                  key={item.id}
                  onClick={() => {
                    setSelectedTool(item.tool);
                    setConnectorRouting(item.routing);
                    setLineStartArrow(item.startArrow);
                    setLineEndArrow(item.endArrow);
                    setOpenMenu(null);
                  }}
                  type="button"
                >
                  <ConnectorIcon id={item.id} />
                  <div className="wb-popover-item-text">
                    <span className="wb-popover-item-title">{item.label}</span>
                    <span className="wb-popover-item-desc">{item.description}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </details>

        <Button
          aria-label="Text tool"
          aria-pressed={selectedTool === "text"}
          onClick={() => { activateTextTool(); setOpenMenu(null); }}
          size="icon"
          title="Text tool"
          variant={selectedTool === "text" ? "secondary" : "ghost"}
        ><Type /><span aria-hidden="true">Text</span></Button>

        {/* 4. Sticky Note Menu */}
        <details className="wb-sticky-note-menu" open={openMenu === "note"}>
          <summary
            aria-label="Sticky note tool and options"
            aria-pressed={selectedTool === "sticky-note"}
            onClick={(event) => {
              event.preventDefault();
              setSelectedTool("sticky-note");
              setOpenMenu((current) => current === "note" ? null : "note");
            }}
            title="Sticky note tool (N)"
          >
            <StickyNote /><span aria-hidden="true">Note</span>
          </summary>
          <div className="wb-sticky-note-menu-panel">
            <strong>New sticky note</strong>
            <div className="wb-sticky-note-color-list" role="group" aria-label="New sticky note color">
              {STICKY_NOTE_COLORS.map((color) => <Button aria-label={`${color.name} sticky note`} aria-pressed={stickyNoteFill === color.fill} key={color.fill} onClick={() => { setStickyNoteFill(color.fill); setOpenMenu(null); }} size="icon" style={{ "--wb-note-color": color.fill } as CSSProperties} title={color.name} variant="ghost"><span aria-hidden="true" /></Button>)}
            </div>
            <label>Shape
              <select aria-label="New sticky note shape" className="wb-line-weight-select" onChange={(event) => setStickyNoteShape(event.currentTarget.value as StickyNoteShape)} value={stickyNoteShape}>
                <option value="rectangle">Rectangle</option><option value="square">Square</option>
              </select>
            </label>
            <span>Click the board to place it</span>
          </div>
        </details>
      </div>

      {selectedTool === "select" && selectedText !== null && (
        <Button onClick={() => activateTextTool()} size="sm" title="Edit text" variant="outline"><Type /> Edit text</Button>
      )}

      {selectedTool === "pen" && (
        <div className="wb-pen-controls" role="group" aria-label="Pen settings">
          <PaletteChoices label="Pen color" selectedColor={penColor} onChoose={setPenColor} />
          <select
            aria-label="Pen line weight"
            className="wb-line-weight-select"
            onChange={(event) => {
              if (isLineWeight(event.currentTarget.value)) setPenLineWeight(event.currentTarget.value);
            }}
            value={penLineWeight}
          >
            <option value="thin">Thin</option>
            <option value="medium">Medium</option>
            <option value="thick">Thick</option>
          </select>
        </div>
      )}

      {(isLineTool || selectedTool === "connection" || selectedTool === "connector" || selectedTool === "arrow" || selectedTool === "waypoints") && (
        <div className="wb-pen-controls" role="group" aria-label={`${selectedTool} style`}>
          <PaletteChoices label={`${selectedTool} color`} selectedColor={lineColor} onChoose={setLineColor} />
          
          {(selectedTool === "connection" || selectedTool === "connector") && (
            <>
              <label className="sr-only" htmlFor="wb-connector-routing">Connector route</label>
              <select aria-label="Connection route" className="wb-line-weight-select" id="wb-connector-routing" onChange={(event) => setConnectorRouting(event.currentTarget.value as ConnectorRouting)} value={connectorRouting}>
                {CONNECTOR_ROUTINGS.map((routing) => <option key={routing} value={routing}>{routing === "orthogonal" ? "Elbow connector" : `${routing[0]!.toUpperCase()}${routing.slice(1)} connector`}</option>)}
              </select>
            </>
          )}
          <select
            aria-label={`${selectedTool === "connection" || selectedTool === "connector" ? "Connection" : "Line"} weight`}
            className="wb-line-weight-select"
            onChange={(event) => {
              if (isLineWeight(event.currentTarget.value)) setLineLineWeight(event.currentTarget.value);
            }}
            value={lineLineWeight}
          >
            <option value="thin">Thin</option>
            <option value="medium">Medium</option>
            <option value="thick">Thick</option>
          </select>
        </div>
      )}

      {showShapeStyle && (
        <div className="wb-shape-controls" role="group" aria-label="Shape style">
          <PaletteChoices label="Shape outline color" selectedColor={currentShapeStroke} onChoose={chooseShapeStroke} />
          <label className="sr-only" htmlFor="wb-shape-fill">Shape fill</label>
          <select
            aria-label="Shape fill"
            className="wb-line-weight-select"
            id="wb-shape-fill"
            onChange={(event) => chooseShapeFill(event.currentTarget.value)}
            value={currentShapeFill}
          >
            <option value="none">No fill</option>
            {!WHITEBOARD_PALETTE.some((color) => color.value === currentShapeFill) && currentShapeFill !== "none" && (
              <option value={currentShapeFill}>Current fill</option>
            )}
            {WHITEBOARD_PALETTE.map((color) => <option key={color.value} value={color.value}>{color.name}</option>)}
          </select>
          <label className="wb-shape-weight-label" htmlFor="wb-shape-line-weight">Thickness</label>
          <select
            aria-label="Shape outline weight"
            className="wb-line-weight-select"
            id="wb-shape-line-weight"
            onChange={(event) => chooseShapeLineWeight(event.currentTarget.value)}
            value={currentShapeWeight}
          >
            <option value="thin">Thin</option>
            <option value="medium">Medium</option>
            <option value="thick">Thick</option>
          </select>
        </div>
      )}

      {selectedText !== null && (selectedTool === "select" || selectedTool === "text") && (
        <div className="wb-text-color-controls">
          <PaletteChoices label="Text color" selectedColor={selectedText.color} onChoose={(color) => updateText(selectedText.id, { color })} />
        </div>
      )}

      {selectedText !== null && (selectedTool === "select" || selectedTool === "text") && (
        <div className="wb-text-controls" role="group" aria-label="Text formatting">
          <label className="sr-only" htmlFor="wb-text-font-size">Text font size</label>
          <select
            aria-label="Text font size"
            className="wb-text-size-select"
            id="wb-text-font-size"
            onChange={(event) => updateText(selectedText.id, { fontSize: Number(event.currentTarget.value) })}
            value={String(selectedText.fontSize)}
          >
            {[12, 14, 16, 18, 20, 24, 28, 32, 40, 48].map((size) => <option key={size} value={String(size)}>{size}px</option>)}
          </select>
          <div className="wb-text-align" role="group" aria-label="Text alignment">
            {(["left", "center", "right"] as const).map((alignment) => (
              <Button
                aria-label={`Align ${alignment}`}
                aria-pressed={selectedText.alignment === alignment}
                key={alignment}
                onClick={() => updateText(selectedText.id, { alignment })}
                size="sm"
                title={`Align ${alignment}`}
                variant={selectedText.alignment === alignment ? "secondary" : "ghost"}
              >{alignment === "center" ? "Center" : alignment[0]!.toUpperCase() + alignment.slice(1)}</Button>
            ))}
          </div>
          <Button
            aria-label="Bold text"
            aria-pressed={selectedText.bold}
            onClick={() => updateText(selectedText.id, { bold: !selectedText.bold })}
            size="icon"
            title="Bold text"
            variant={selectedText.bold ? "secondary" : "ghost"}
          ><strong>B</strong></Button>
          <Button aria-label="Italic text" aria-pressed={selectedText.italic === true} onClick={() => updateText(selectedText.id, { italic: selectedText.italic !== true })} size="icon" title="Italic text" variant={selectedText.italic === true ? "secondary" : "ghost"}><em>I</em></Button>
          <Button aria-label="Underline text" aria-pressed={selectedText.underline === true} onClick={() => updateText(selectedText.id, { underline: selectedText.underline !== true })} size="icon" title="Underline text" variant={selectedText.underline === true ? "secondary" : "ghost"}><u>U</u></Button>
        </div>
      )}

      <div className="wb-tool-group wb-actions">
        <Button aria-label="Undo action" disabled={!canUndo} onClick={undoEdit} size="icon" title="Undo action" variant="ghost"><Undo2 /></Button>
        <Button aria-label="Redo action" disabled={!canRedo} onClick={redoEdit} size="icon" title="Redo action" variant="ghost"><Redo2 /></Button>
      </div>
    </nav>
  );
};
