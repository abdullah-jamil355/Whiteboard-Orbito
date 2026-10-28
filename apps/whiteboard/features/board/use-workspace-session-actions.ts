"use client";

import { useState } from "react";
import { isBoardSessionOwner, type Board, type BoardSession } from "@workspace/whiteboard";
import { createServerSession, endServerSession, getServerSession, isUnavailableSessionError, renameServerSession, toLocalSession, type VerifiedIdentity } from "./api-client";

type WorkspaceSessionState = Readonly<{
  board: Board;
  isImporting: boolean;
  sessionBusy: boolean;
  activeSession: BoardSession | null;
  currentOwnerId: string | null;
  identity: VerifiedIdentity | null;
  sessionTitleDraft: string;
  savedDocumentXmlRef: { current: string | null };
  setIsDirty: (dirty: boolean) => void;
  setLocalSource: (source: "new" | "downloaded" | "opened" | "template" | "session") => void;
  setSessionTitleDraft: (title: string) => void;
  setActiveSession: (session: BoardSession | null) => void;
  setCurrentOwnerId: (id: string | null) => void;
  setAuthDialogOpen: (open: boolean) => void;
  setSessionFeedback: (message: string | null) => void;
  setSessionBusy: (busy: boolean) => void;
  setSessionDialog: (dialog: "start" | "rename" | "end" | null) => void;
  resetBoardHistory: () => void;
  downloadBoardXml: (board: Board) => boolean;
  endExportSequence: number | null;
  setEndExportSequence: (sequence: number | null) => void;
}>;

export const useWorkspaceSessionActions = (state: WorkspaceSessionState) => {
  const [sessionEndedDialogOpen, setSessionEndedDialogOpen] = useState(false);
  const { board, isImporting, sessionBusy, activeSession, currentOwnerId, identity, sessionTitleDraft } = state;
  const savedDocumentXmlRef = state.savedDocumentXmlRef;
  const canManageSession = activeSession !== null && currentOwnerId !== null && isBoardSessionOwner(activeSession, currentOwnerId);
  const handleRemoteSessionEnd = (): void => {
    window.sessionStorage.removeItem("wb_active_session_id");
    savedDocumentXmlRef.current = null;
    state.setIsDirty(true);
    state.setLocalSource("new");
    state.resetBoardHistory();
    state.setActiveSession(null);
    state.setCurrentOwnerId(null);
    state.setSessionDialog(null);
    state.setEndExportSequence(null);
    state.setSessionFeedback(null);
    setSessionEndedDialogOpen(true);
  };
  const openStartSession = (): void => {
    if (activeSession !== null || isImporting || sessionBusy) return;
    if (identity === null) {
      state.setSessionFeedback("Sign in to start a live session.");
      state.setAuthDialogOpen(true);
      return;
    }
    state.setSessionTitleDraft(board.title.trim() || "Untitled");
    state.setSessionDialog("start");
  };
  const startSession = async (): Promise<void> => {
    const title = sessionTitleDraft.trim();
    if (title.length === 0 || activeSession !== null || isImporting || sessionBusy || identity === null) return;
    state.setSessionBusy(true);
    state.setSessionFeedback(null);
    try {
      const { session } = await createServerSession({ title, board });
      state.resetBoardHistory();
      state.setCurrentOwnerId(identity.id);
      state.setActiveSession(toLocalSession(session));
      state.setLocalSource("session");
      window.sessionStorage.setItem("wb_active_session_id", session.id);
      state.setSessionDialog(null);
    } catch (error) {
      state.setSessionFeedback(error instanceof Error ? error.message : "Could not start the server session.");
    } finally {
      state.setSessionBusy(false);
    }
  };
  const saveSessionRename = async (): Promise<void> => {
    if (activeSession === null || currentOwnerId === null || sessionTitleDraft.trim().length === 0 || sessionBusy) return;
    state.setSessionBusy(true);
    state.setSessionFeedback(null);
    try {
      const { session } = await renameServerSession(activeSession.id, sessionTitleDraft.trim());
      state.setActiveSession(toLocalSession(session));
      state.setSessionDialog(null);
    } catch (error) {
      state.setSessionFeedback(error instanceof Error ? error.message : "Could not rename the server session.");
    } finally {
      state.setSessionBusy(false);
    }
  };
  const endSession = async (choice: "download" | "confirm" | "without-download"): Promise<void> => {
    if (!canManageSession || activeSession === null || sessionBusy) return;
    state.setSessionBusy(true);
    state.setSessionFeedback(null);
    try {
      const latest = choice === "download" ? await getServerSession(activeSession.id) : null;
      if (latest !== null && latest.session.status !== "active") throw new Error("This session has already ended.");
      if (choice === "download" && latest !== null) {
        if (!state.downloadBoardXml(latest.session.board)) throw new Error("The XML download could not be started. The session is still active.");
        state.setEndExportSequence(latest.session.sequence);
        state.setSessionFeedback(null);
        return;
      }
      const expectedSequence = choice === "confirm" ? state.endExportSequence : null;
      if (choice === "confirm" && expectedSequence === null) throw new Error("Download the latest XML before confirming session end.");
      if (choice === "without-download") state.setEndExportSequence(null);
      await endServerSession(activeSession.id, expectedSequence ?? undefined);
      window.sessionStorage.removeItem("wb_active_session_id");
      state.resetBoardHistory();
      state.setActiveSession(null); state.setCurrentOwnerId(null); state.setSessionDialog(null); state.setEndExportSequence(null);
    } catch (error) {
      if (isUnavailableSessionError(error)) {
        window.sessionStorage.removeItem("wb_active_session_id");
        state.resetBoardHistory();
        state.setActiveSession(null);
        state.setCurrentOwnerId(null);
        state.setSessionDialog(null);
        state.setEndExportSequence(null);
        state.setSessionFeedback("This session has already ended or is no longer available. The local board remains open.");
        return;
      }
      if (choice !== "download") state.setEndExportSequence(null);
      state.setSessionFeedback(error instanceof Error ? error.message : "Could not end the server session.");
    } finally {
      state.setSessionBusy(false);
    }
  };
  const openEndSession = (): void => {
    if (canManageSession && !sessionBusy) {
      state.setEndExportSequence(null);
      state.setSessionFeedback(null);
      state.setSessionDialog("end");
    }
  };
  return { canManageSession, endSession, handleRemoteSessionEnd, openEndSession, openStartSession, saveSessionRename, sessionEndedDialogOpen, setSessionEndedDialogOpen, startSession };
};




