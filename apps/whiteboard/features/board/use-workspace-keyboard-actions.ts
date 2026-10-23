"use client";

import { useEffect } from "react";
import type { Board, BoardHistoryEdit, WhiteboardTool } from "@workspace/whiteboard";

type WorkspaceKeyboardActions = Readonly<{
  board: Board;
  history: Readonly<{ past: readonly BoardHistoryEdit[]; future: readonly BoardHistoryEdit[] }>;
  canUndo: boolean;
  canRedo: boolean;
  selectedIds: readonly string[];
  isDirty: boolean;
  save: () => boolean;
  undo: () => void;
  redo: () => void;
  copy: (cut?: boolean) => void;
  remove: () => void;
  duplicate: () => void;
  paste: () => void;
  select: (ids: readonly string[]) => void;
  move: (ids: readonly string[], dx: number, dy: number) => void;
  setTool: (tool: WhiteboardTool) => void;
  readOnly?: boolean;
}>;

export const useWorkspaceKeyboardActions = ({ board, history, canUndo, canRedo, selectedIds, isDirty, save, undo, redo, copy, remove, duplicate, paste, select, move, setTool, readOnly = false }: WorkspaceKeyboardActions): void => {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || target.matches("input, textarea, select, [role='textbox']"))) return;
      if (readOnly) return;
      const hasModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      const onBoard = target instanceof Element && target.closest(".wb-drawing-surface") !== null;
      if (!hasModifier && key === "n") { event.preventDefault(); setTool("sticky-note"); return; }
      if (!hasModifier && onBoard && selectedIds.length > 0) {
        const movement = { ArrowUp: [0, -1], ArrowRight: [1, 0], ArrowDown: [0, 1], ArrowLeft: [-1, 0] } as const;
        const delta = movement[event.key as keyof typeof movement];
        if (delta !== undefined) { event.preventDefault(); const step = event.shiftKey ? 10 : 1; move(selectedIds, delta[0] * step, delta[1] * step); return; }
      }
      if (!hasModifier && (key === "delete" || key === "backspace") && selectedIds.length > 0) { event.preventDefault(); remove(); return; }
      if (!hasModifier) return;
      if (key === "s") { event.preventDefault(); save(); return; }
      if (key === "a") { event.preventDefault(); select(board.objects.map(({ id }) => id)); }
      else if (key === "c") { event.preventDefault(); copy(); }
      else if (key === "x") { event.preventDefault(); copy(true); }
      else if (key === "v") { event.preventDefault(); paste(); }
      else if (key === "d") { event.preventDefault(); duplicate(); }
      if ((key === "z" && canUndo) || (key === "y" && canRedo)) {
        event.preventDefault(); if (key === "y") redo(); else undo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [board, history.past.length, history.future.length, canUndo, canRedo, selectedIds, save, undo, redo, copy, remove, duplicate, paste, select, move, setTool, readOnly]);

  useEffect(() => {
    if (!isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty]);
};


