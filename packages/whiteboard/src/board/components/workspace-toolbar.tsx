"use client";

import { useEffect, useState, type ReactElement } from "react";
import { Eraser, MousePointer2, Pencil, Redo2, Type, Undo2 } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import {
  CONNECTOR_ROUTINGS, isLineWeight, WHITEBOARD_PALETTE,
  type ArrowHead, type ConnectorRouting, type LineWeight,
  type TextObject, type WhiteboardTool
} from "..";
import { PaletteChoices } from "./palette-choices";
import { ToolbarSelect } from "./toolbar-select";
import {
  ToolbarConnectorsMenu,
  type ToolbarMenuKind,
  ToolbarShapesMenu,
  ToolbarStickyNoteMenu,
  ToolbarWaypointsMenu
} from "./workspace-toolbar-menus";

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
    selectedTool, setSelectedTool, activateEraserTool, activateTextTool, selectedText,
    stickyNoteFill, setStickyNoteFill, stickyNoteShape, setStickyNoteShape,
    penColor, setPenColor, penLineWeight, setPenLineWeight, isLineTool, lineColor, setLineColor, lineLineWeight,
    connectorRouting, setConnectorRouting, setLineStartArrow, lineEndArrow, setLineEndArrow,
    setLineLineWeight, showShapeStyle, currentShapeStroke, chooseShapeStroke, currentShapeFill, chooseShapeFill,
    currentShapeWeight, chooseShapeLineWeight, canUndo, canRedo, undoEdit, redoEdit, readOnly = false
  } = props;

  const [openMenu, setOpenMenu] = useState<ToolbarMenuKind | null>(null);

  useEffect(() => {
    if (openMenu === null) return;
    const handlePointerDown = (event: PointerEvent): void => {
      const target = event.target as HTMLElement | null;
      if (target && !target.closest(".wb-toolbar")) setOpenMenu(null);
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
          aria-label="Select tool" aria-pressed={selectedTool === "select"}
          onClick={() => { setSelectedTool("select"); setOpenMenu(null); }}
          size="icon" title="Select tool" variant={selectedTool === "select" ? "secondary" : "ghost"}
        ><MousePointer2 /><span aria-hidden="true">Select</span></Button>
        <Button
          aria-label="Pen tool" aria-pressed={selectedTool === "pen"}
          onClick={() => { setSelectedTool("pen"); setOpenMenu(null); }}
          size="icon" title="Pen tool" variant={selectedTool === "pen" ? "secondary" : "ghost"}
        ><Pencil /><span aria-hidden="true">Pen</span></Button>
        <Button
          aria-label="Eraser tool" aria-pressed={selectedTool === "eraser"}
          onClick={() => { activateEraserTool(); setOpenMenu(null); }}
          size="icon" title="Eraser tool" variant={selectedTool === "eraser" ? "secondary" : "ghost"}
        ><Eraser /><span aria-hidden="true">Eraser</span></Button>

        <ToolbarShapesMenu
          isOpen={openMenu === "shapes"}
          onSelect={(shape) => { setSelectedTool(shape); setOpenMenu(null); }}
          onToggle={() => setOpenMenu((curr) => curr === "shapes" ? null : "shapes")}
          selectedTool={selectedTool}
        />
        <ToolbarWaypointsMenu
          connectorRouting={connectorRouting}
          isOpen={openMenu === "waypoints"}
          onSelect={(routing) => { setConnectorRouting(routing); setSelectedTool("waypoints"); setOpenMenu(null); }}
          onToggle={() => setOpenMenu((curr) => curr === "waypoints" ? null : "waypoints")}
          selectedTool={selectedTool}
        />
        <ToolbarConnectorsMenu
          connectorRouting={connectorRouting}
          isOpen={openMenu === "connectors"}
          lineEndArrow={lineEndArrow}
          onSelect={({ tool, routing, startArrow, endArrow }) => {
            setSelectedTool(tool); setConnectorRouting(routing); setLineStartArrow(startArrow); setLineEndArrow(endArrow); setOpenMenu(null);
          }}
          onToggle={() => setOpenMenu((curr) => curr === "connectors" ? null : "connectors")}
          selectedTool={selectedTool}
        />
        <Button
          aria-label="Text tool" aria-pressed={selectedTool === "text"}
          onClick={() => { activateTextTool(); setOpenMenu(null); }}
          size="icon" title="Text tool" variant={selectedTool === "text" ? "secondary" : "ghost"}
        ><Type /><span aria-hidden="true">Text</span></Button>

        <ToolbarStickyNoteMenu
          isOpen={openMenu === "note"}
          onChooseFill={(fill) => { setStickyNoteFill(fill); setOpenMenu(null); }}
          onChooseShape={setStickyNoteShape}
          onOpen={() => setSelectedTool("sticky-note")}
          onToggle={() => setOpenMenu((curr) => curr === "note" ? null : "note")}
          selectedTool={selectedTool}
          stickyNoteFill={stickyNoteFill}
          stickyNoteShape={stickyNoteShape}
        />
      </div>

      {selectedTool === "select" && selectedText !== null && (
        <Button onClick={() => activateTextTool()} size="sm" title="Edit text" variant="outline"><Type /> Edit text</Button>
      )}

      {selectedTool === "pen" && (
        <div className="wb-pen-controls" role="group" aria-label="Pen settings">
          <PaletteChoices label="Pen color" selectedColor={penColor} onChoose={setPenColor} />
          <ToolbarSelect aria-label="Pen line weight" className="wb-line-weight-select" onChange={(value) => isLineWeight(value) && setPenLineWeight(value)} options={[{ value: "thin", label: "Thin line" }, { value: "medium", label: "Medium line" }, { value: "thick", label: "Thick line" }]} value={penLineWeight} />
        </div>
      )}

      {isLineTool && (
        <div className="wb-line-controls" role="group" aria-label="Line settings">
          <PaletteChoices label="Line color" selectedColor={lineColor} onChoose={setLineColor} />
          <ToolbarSelect aria-label="Line weight" className="wb-line-weight-select" onChange={(value) => isLineWeight(value) && setLineLineWeight(value)} options={[{ value: "thin", label: "Thin" }, { value: "medium", label: "Medium" }, { value: "thick", label: "Thick" }]} value={lineLineWeight} />
          <ToolbarSelect aria-label="Connector routing" className="wb-line-weight-select" onChange={(value) => CONNECTOR_ROUTINGS.includes(value as ConnectorRouting) && setConnectorRouting(value as ConnectorRouting)} options={[{ value: "orthogonal", label: "Orthogonal" }, { value: "straight", label: "Straight" }, { value: "curved", label: "Curved" }]} value={connectorRouting} />
        </div>
      )}

      {showShapeStyle && (
        <div className="wb-shape-style-controls" role="group" aria-label="Shape style">
          <PaletteChoices label="Stroke color" selectedColor={currentShapeStroke} onChoose={chooseShapeStroke} />
          <ToolbarSelect aria-label="Shape fill" className="wb-line-weight-select" onChange={chooseShapeFill} options={[{ value: "none", label: "No Fill" }, ...(!WHITEBOARD_PALETTE.some((color) => color.value === currentShapeFill) && currentShapeFill !== "none" ? [{ value: currentShapeFill, label: "Current fill" }] : []), ...WHITEBOARD_PALETTE.map((color) => ({ value: color.value, label: color.name }))]} value={currentShapeFill} />
          <ToolbarSelect aria-label="Shape border line weight" className="wb-line-weight-select" onChange={chooseShapeLineWeight} options={[{ value: "thin", label: "Thin Border" }, { value: "medium", label: "Medium Border" }, { value: "thick", label: "Thick Border" }]} value={currentShapeWeight} />
        </div>
      )}

      <div className="wb-tool-group wb-history-tools">
        <Button aria-label="Undo" className="wb-tool-btn" disabled={!canUndo} onClick={undoEdit} size="icon" title="Undo (Ctrl/Cmd+Z)" variant="ghost"><Undo2 /><span aria-hidden="true">Undo</span></Button>
        <Button aria-label="Redo" className="wb-tool-btn" disabled={!canRedo} onClick={redoEdit} size="icon" title="Redo (Ctrl/Cmd+Shift+Z)" variant="ghost"><Redo2 /><span aria-hidden="true">Redo</span></Button>
      </div>
    </nav>
  );
};
