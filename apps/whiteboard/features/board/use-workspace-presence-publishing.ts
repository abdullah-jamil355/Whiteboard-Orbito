"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { Coordinate } from "@workspace/whiteboard";

type Dependencies = Readonly<{
  providerRef: RefObject<HocuspocusProvider | null>;
  sessionId: string | null;
  role: "owner" | "editor" | "viewer" | null;
  roleSessionId: string | null;
}>;

export const useWorkspacePresencePublishing = ({ providerRef, sessionId, role, roleSessionId }: Dependencies) => {
  const pendingCursorRef = useRef<Coordinate | null>(null);
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCursorSentAtRef = useRef(0);

  useEffect(() => () => {
    if (cursorTimerRef.current !== null) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = null;
    lastCursorSentAtRef.current = 0;
    pendingCursorRef.current = null;
  }, [sessionId]);

  const publishCursor = useCallback((cursor: Coordinate | null): void => {
    const provider = providerRef.current;
    if (provider?.isAuthenticated !== true || roleSessionId !== sessionId || role === null) return;
    if (cursor === null) {
      if (cursorTimerRef.current !== null) clearTimeout(cursorTimerRef.current);
      cursorTimerRef.current = null;
      pendingCursorRef.current = null;
      provider.awareness?.setLocalStateField("cursor", null);
      lastCursorSentAtRef.current = Date.now();
      return;
    }
    pendingCursorRef.current = cursor;
    const sendPending = (): void => {
      const activeProvider = providerRef.current;
      const pending = pendingCursorRef.current;
      if (activeProvider === null || pending === null || !activeProvider.isAuthenticated) return;
      activeProvider.awareness?.setLocalStateField("cursor", pending);
      pendingCursorRef.current = null;
      lastCursorSentAtRef.current = Date.now();
      cursorTimerRef.current = null;
    };
    const remaining = Math.max(0, 100 - (Date.now() - lastCursorSentAtRef.current));
    if (remaining === 0) sendPending();
    else if (cursorTimerRef.current === null) cursorTimerRef.current = setTimeout(sendPending, remaining);
  }, [providerRef, role, roleSessionId, sessionId]);

  return { publishCursor };
};
