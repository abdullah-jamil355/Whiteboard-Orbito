"use client";

import { useCallback, type ChangeEvent, type MutableRefObject } from "react";
import { createBoard, createBoardFromTemplate, MAX_WHITEBOARD_XML_BYTES, parseBoardXml, serializeBoardXml, type Board, type BoardSession } from "@workspace/whiteboard";
import { downloadBoardXml } from "./board-xml-download";
import { createWhiteboardId } from "./create-whiteboard-id";

type PendingReplacement = Readonly<{ board: Board; source: "new" | "opened" | "template" }>;
type WorkspaceFileState = Readonly<{
  board: Board;
  savedDocumentXmlRef: MutableRefObject<string | null>;
  activeSession: BoardSession | null;
  dirtyContent: boolean;
  pendingReplacement: PendingReplacement | null;
  replaceBoard: (board: Board, source: PendingReplacement["source"]) => void;
  setPendingReplacement: (value: PendingReplacement | null) => void;
  setFileFeedback: (feedback: Readonly<{ kind: "error" | "success"; message: string }> | null) => void;
  setIsImporting: (value: boolean) => void;
  setIsTemplatePickerOpen: (value: boolean) => void;
  setIsDirty: (value: boolean) => void;
  setLocalSource: (value: "new" | "downloaded" | "opened" | "template") => void;
  setSaveFailed: (value: boolean) => void;
}>;

export const useWorkspaceFileActions = (state: WorkspaceFileState) => {
  const { board, setIsDirty, setLocalSource, setSaveFailed, savedDocumentXmlRef } = state;
  const requestNewBoard = (): void => {
    if (state.activeSession !== null) return;
    const next = createBoard(createWhiteboardId());
    if (state.dirtyContent) {
      state.setPendingReplacement({ board: next, source: "new" });
      return;
    }
    state.replaceBoard(next, "new");
  };
  const requestTemplateBoard = (templateId: string): void => {
    if (state.activeSession !== null) return;
    const next = createBoardFromTemplate(templateId, createWhiteboardId);
    state.setIsTemplatePickerOpen(false);
    if (next === null) {
      state.setFileFeedback({ kind: "error", message: "That built-in template is unavailable. Choose another template." });
      return;
    }
    if (state.dirtyContent) {
      state.setPendingReplacement({ board: next, source: "template" });
      return;
    }
    state.replaceBoard(next, "template");
  };
  const openBoardFile = async (event: ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file === undefined) return;
    if (state.activeSession !== null) {
      state.setFileFeedback({ kind: "error", message: "End the active session before replacing its starting board." });
      return;
    }
    state.setFileFeedback(null);
    if (file.size > MAX_WHITEBOARD_XML_BYTES) {
      state.setFileFeedback({ kind: "error", message: "This Whiteboard XML file is too large to open." });
      return;
    }
    state.setIsImporting(true);
    try {
      const source = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer());
      const parsed = parseBoardXml(source);
      if (!parsed.ok) {
        state.setFileFeedback({ kind: "error", message: parsed.error });
        return;
      }
      if (state.dirtyContent) state.setPendingReplacement({ board: parsed.board, source: "opened" });
      else state.replaceBoard(parsed.board, "opened");
    } catch {
      state.setFileFeedback({ kind: "error", message: "This file could not be read as UTF-8 Whiteboard XML. Choose another file and try again." });
    } finally {
      state.setIsImporting(false);
    }
  };
  const saveBoard = useCallback((): boolean => {
    try {
      const xml = serializeBoardXml(board);
      if (!downloadBoardXml(board)) throw new Error("XML download failed.");
      savedDocumentXmlRef.current = xml;
      setIsDirty(false);
      setLocalSource("downloaded");
      setSaveFailed(false);
      return true;
    } catch {
      setSaveFailed(true);
      return false;
    }
  }, [board, savedDocumentXmlRef, setIsDirty, setLocalSource, setSaveFailed]);
  const handlePendingSave = (): void => {
    if (state.pendingReplacement !== null && saveBoard()) {
      state.replaceBoard(state.pendingReplacement.board, state.pendingReplacement.source);
    }
  };
  const handlePendingDiscard = (): void => {
    if (state.pendingReplacement !== null) {
      state.replaceBoard(state.pendingReplacement.board, state.pendingReplacement.source);
    }
  };
  return { handlePendingDiscard, handlePendingSave, openBoardFile, requestNewBoard, requestTemplateBoard, saveBoard };
};




