"use client";

import { useCallback, useEffect, useState } from "react";
import type { Board, BoardSession } from "@workspace/whiteboard";
import { getServerSession, getVerifiedIdentity, listMyActiveSessions, toLocalSession, type ApiActiveSession, type VerifiedIdentity } from "./api-client";

type Dependencies = Readonly<{
  activeSession: BoardSession | null;
  hasUnsavedCanvasContent: boolean;
  sessionBusy: boolean;
  replaceBoard: (board: Board, source: "new" | "opened" | "template" | "session") => void;
  setActiveSession: (session: BoardSession | null) => void;
  setCurrentOwnerId: (identityId: string | null) => void;
  setIdentity: (identity: VerifiedIdentity | null) => void;
  setSessionBusy: (busy: boolean) => void;
  setSessionFeedback: (message: string | null) => void;
}>;

const DISMISSED_SESSIONS_KEY = "wb_dismissed_sessions";

const getDismissedSessionIds = (): Set<string> => {
  try {
    const raw = window.sessionStorage.getItem(DISMISSED_SESSIONS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
};

const markSessionsDismissed = (ids: readonly string[]): void => {
  try {
    const existing = getDismissedSessionIds();
    ids.forEach((id) => existing.add(id));
    window.sessionStorage.setItem(DISMISSED_SESSIONS_KEY, JSON.stringify([...existing]));
  } catch { /* storage full / blocked */ }
};

export const useWorkspaceMemberSessions = ({ activeSession, hasUnsavedCanvasContent, sessionBusy, replaceBoard, setActiveSession, setCurrentOwnerId, setIdentity, setSessionBusy, setSessionFeedback }: Dependencies) => {
  const [availableSessions, setAvailableSessions] = useState<readonly ApiActiveSession[]>([]);

  useEffect(() => {
    let cancelled = false;
    void getVerifiedIdentity().then(async (verified) => {
      if (cancelled || verified === null) return;
      setIdentity(verified);
      setCurrentOwnerId(verified.id);
      const sessionId = window.sessionStorage.getItem("wb_active_session_id");
      if (sessionId) {
        try {
          const { session } = await getServerSession(sessionId);
          if (cancelled) return;
          if (session.status === "active") {
            replaceBoard(session.board, "session");
            setActiveSession(toLocalSession(session));
            return;
          }
        } catch { /* Discover active memberships below. */ }
        window.sessionStorage.removeItem("wb_active_session_id");
      }
      try {
        const { sessions } = await listMyActiveSessions();
        if (!cancelled) {
          const dismissed = getDismissedSessionIds();
          setAvailableSessions(sessions.filter((session) => !dismissed.has(session.id)));
        }
      } catch (error) {
        if (!cancelled) setSessionFeedback(error instanceof Error ? error.message : "Could not find active sessions for this verified identity.");
      }
    });
    return () => { cancelled = true; };
  }, [replaceBoard, setActiveSession, setCurrentOwnerId, setIdentity, setSessionFeedback]);

  const rejoinSession = useCallback(async (sessionId: string): Promise<void> => {
    if (sessionBusy || activeSession !== null) return;
    if (hasUnsavedCanvasContent && !window.confirm("Joining this session replaces the current unsaved board. Continue?")) return;
    setSessionBusy(true);
    setSessionFeedback(null);
    try {
      const { session } = await getServerSession(sessionId);
      if (session.status !== "active") throw new Error("This session is no longer active.");
      replaceBoard(session.board, "session");
      setCurrentOwnerId(session.ownerIdentityId);
      setActiveSession(toLocalSession(session));
      window.sessionStorage.setItem("wb_active_session_id", session.id);
      setAvailableSessions([]);
    } catch (error) {
      setSessionFeedback(error instanceof Error ? error.message : "Could not rejoin this session.");
      if (error instanceof Error && error.message.includes("404")) setAvailableSessions((current) => current.filter((session) => session.id !== sessionId));
    } finally { setSessionBusy(false); }
  }, [activeSession, hasUnsavedCanvasContent, replaceBoard, sessionBusy, setActiveSession, setCurrentOwnerId, setSessionBusy, setSessionFeedback]);

  const dismissAvailableSessions = useCallback((): void => {
    markSessionsDismissed(availableSessions.map((session) => session.id));
    setAvailableSessions([]);
  }, [availableSessions]);

  return { availableSessions, rejoinSession, dismissAvailableSessions };
};
