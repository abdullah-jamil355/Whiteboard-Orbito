"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import type { WhiteboardHistoryState } from "@workspace/types";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import type { Board, CollaboratorPresence } from "@workspace/whiteboard";
import { diffBoardChanges, parseRealtimeServerMessage } from "./realtime-client";
import { maximumQueueAgeMs, maximumQueueBytes, maximumQueueEntries, nextQueuedEdit, queueStorageKey, readQueue, type PendingEdit } from "./realtime-queue";
import { createHistoryBusyStore, createNumberStore, inactiveHistoryBusy } from "./realtime-stores";
import { getRealtimeUrl, resetInFlightActionOnTransportLoss } from "./realtime-connection";
import { useWorkspacePresencePublishing } from "./use-workspace-presence-publishing";
import { readCollaborators } from "./realtime-presence";
import { createWhiteboardId } from "./create-whiteboard-id";
import { getStoredSessionToken } from "./api-client";
import { handleRealtimeServerMessage } from "./realtime-message-handler";

type RealtimeStatus = "inactive" | "connecting" | "connected" | "disconnected";
type Dependencies = Readonly<{
  sessionId: string | null;
  onBoardState: (board: Board, sequence: number) => void;
  onFeedback: (message: string | null) => void;
  onSessionEnded: () => void;
}>;

export const useWorkspaceRealtime = ({ sessionId, onBoardState, onFeedback, onSessionEnded }: Dependencies) => {
  const providerRef = useRef<HocuspocusProvider | null>(null);
  const pendingRef = useRef<PendingEdit[]>([]);
  const sequenceRef = useRef(0);
  const sendingActionIdRef = useRef<string | null>(null);
  const pendingHistoryActionRef = useRef<Readonly<{ actionId: string; action: "undo" | "redo" }> | null>(null);
  const retryHistoryAfterSyncRef = useRef(false);
  const canSendRef = useRef(false);
  const onBoardStateRef = useRef(onBoardState);
  const onFeedbackRef = useRef(onFeedback);
  const onSessionEndedRef = useRef(onSessionEnded);
  const [connectionState, setConnectionState] = useState<Readonly<{ sessionId: string | null; status: RealtimeStatus }>>({ sessionId: null, status: "inactive" });
  const [sessionState, setSessionState] = useState<Readonly<{ sessionId: string | null; role: "owner" | "editor" | "viewer" | null; ownerConnected: boolean }>>({ sessionId: null, role: null, ownerConnected: false });
  const [presenceState, setPresenceState] = useState<Readonly<{ sessionId: string | null; participants: readonly CollaboratorPresence[] }>>({ sessionId: null, participants: [] });
  const [historyState, setHistoryState] = useState<Readonly<{ sessionId: string | null; state: WhiteboardHistoryState }>>({ sessionId: null, state: { canUndo: false, canRedo: false } });
  const [pendingCountStore] = useState(createNumberStore);
  const queuedEditCount = useSyncExternalStore(pendingCountStore.subscribe, pendingCountStore.getSnapshot, () => 0);
  const [historyBusyStore] = useState(createHistoryBusyStore);
  const historyBusyState = useSyncExternalStore(historyBusyStore.subscribe, historyBusyStore.getSnapshot, () => inactiveHistoryBusy);
  const { publishCursor } = useWorkspacePresencePublishing({
    providerRef, sessionId, role: sessionState.role, roleSessionId: sessionState.sessionId
  });

  useEffect(() => {
    onBoardStateRef.current = onBoardState;
    onFeedbackRef.current = onFeedback;
    onSessionEndedRef.current = onSessionEnded;
  }, [onBoardState, onFeedback, onSessionEnded]);

  const publishQueueCount = useCallback((): void => pendingCountStore.set(pendingRef.current.length), [pendingCountStore]);

  const persistQueue = useCallback((): void => {
    if (sessionId === null) return;
    try { window.localStorage.setItem(queueStorageKey(sessionId), JSON.stringify(pendingRef.current)); }
    catch { onFeedbackRef.current("Offline edits could not be saved on this device. Keep this tab open until the server reconnects."); }
  }, [sessionId]);

  const sendNext = useCallback((): void => {
    const provider = providerRef.current;
    if (!canSendRef.current || provider === null || sendingActionIdRef.current !== null) return;
    const pending = nextQueuedEdit(pendingRef.current);
    if (pending === null) return;
    sendingActionIdRef.current = pending.command.actionId;
    provider.sendStateless(JSON.stringify({ type: "board:edit", command: pending.command }));
  }, []);

  useEffect(() => {
    if (sessionId === null) {
      providerRef.current?.destroy();
      providerRef.current = null;
      pendingRef.current = [];
      publishQueueCount();
      sequenceRef.current = 0;
      sendingActionIdRef.current = null;
      pendingHistoryActionRef.current = null;
      retryHistoryAfterSyncRef.current = false;
      historyBusyStore.set({ sessionId: null, busy: false });
      canSendRef.current = false;
      return;
    }
    pendingRef.current = readQueue(sessionId);
    pendingHistoryActionRef.current = null;
    historyBusyStore.set({ sessionId, busy: false });
    if (pendingRef.current.some(({ createdAt }) => Date.now() - createdAt > maximumQueueAgeMs)) {
      onFeedbackRef.current("Some queued edits are older than seven days and need review before retrying. They are still saved on this device.");
    }
    publishQueueCount();
    sendingActionIdRef.current = null;
    sequenceRef.current = 0;
    canSendRef.current = false;
    const document = new Y.Doc();
    const provider = new HocuspocusProvider({
      url: getRealtimeUrl(),
      name: sessionId,
      document,
      token: getStoredSessionToken() ?? null,
      onAuthenticated: () => {
        canSendRef.current = true;
        providerRef.current?.awareness?.setLocalStateField("user", {});
        retryHistoryAfterSyncRef.current = pendingHistoryActionRef.current !== null;
        providerRef.current?.sendStateless(JSON.stringify({ type: "board:sync" }));
      },
      onAuthenticationFailed: () => {
        canSendRef.current = false;
        setConnectionState({ sessionId, status: "disconnected" });
        onFeedbackRef.current("Session authentication failed. Verify that this account is still a member.");
      },
      onStateless: ({ payload }) => {
        const message = parseRealtimeServerMessage(payload);
        if (message !== null) {
          handleRealtimeServerMessage(message, {
            historyBusyStore,
            onBoardState: (b, s) => onBoardStateRef.current(b, s),
            onFeedback: (f) => onFeedbackRef.current(f),
            onSessionEnded: () => onSessionEndedRef.current(),
            pendingHistoryActionRef,
            pendingRef,
            persistQueue,
            provider: providerRef.current,
            publishQueueCount,
            retryHistoryAfterSyncRef,
            sendNext,
            sendingActionIdRef,
            sequenceRef,
            sessionId,
            setHistoryState,
            setSessionState
          });
        }
      },
      onStatus: ({ status: connectionStatus }) => {
        sendingActionIdRef.current = resetInFlightActionOnTransportLoss(connectionStatus, sendingActionIdRef.current);
        if (connectionStatus !== "connected") canSendRef.current = false;
        setConnectionState({ sessionId, status: connectionStatus });
      }
    });
    providerRef.current = provider;
    const awareness = provider.awareness;
    const refreshPresence = (): void => {
      if (awareness !== null) setPresenceState({ sessionId, participants: readCollaborators(awareness.getStates(), awareness.clientID) });
    };
    awareness?.on("change", refreshPresence);
    return () => {
      canSendRef.current = false;
      sendingActionIdRef.current = null;
      providerRef.current = null;
      awareness?.off("change", refreshPresence);
      provider.destroy();
    };
  }, [historyBusyStore, persistQueue, publishQueueCount, sendNext, sessionId]);

  const queueBoardEdit = useCallback((before: Board, after: Board): boolean => {
    if (sessionId === null) return true;
    if (pendingHistoryActionRef.current !== null) {
      onFeedbackRef.current("Wait for the shared Undo/Redo action to finish before editing.");
      return false;
    }
    const changes = diffBoardChanges(before, after);
    if (changes.length === 0) return true;
    const pending: PendingEdit = { command: { actionId: createWhiteboardId(), baseSequence: sequenceRef.current, changes }, blocked: false, createdAt: Date.now() };
    const nextQueue = [...pendingRef.current, pending];
    if (nextQueue.length > maximumQueueEntries || new Blob([JSON.stringify(nextQueue)]).size > maximumQueueBytes) {
      onFeedbackRef.current("Offline edit limit reached. Reconnect and retry pending edits before making more live-session changes.");
      return false;
    }
    pendingRef.current = nextQueue;
    publishQueueCount();
    persistQueue();
    sendNext();
    return true;
  }, [persistQueue, publishQueueCount, sendNext, sessionId]);

  const publishHistoryAction = useCallback((action: "undo" | "redo"): void => {
    const provider = providerRef.current;
    if (sessionId === null || (sessionState.role !== "owner" && sessionState.role !== "editor") || provider?.isAuthenticated !== true) return;
    if (pendingHistoryActionRef.current !== null || sendingActionIdRef.current !== null || pendingRef.current.length > 0) {
      onFeedbackRef.current("Wait until pending live edits finish before using shared Undo/Redo.");
      return;
    }
    const actionId = createWhiteboardId();
    pendingHistoryActionRef.current = { actionId, action };
    historyBusyStore.set({ sessionId, busy: true });
    provider.sendStateless(JSON.stringify({ type: `board:${action}`, actionId }));
  }, [historyBusyStore, sessionId, sessionState.role]);

  const retryQueuedEdits = useCallback((): void => {
    const provider = providerRef.current;
    canSendRef.current = provider?.isAuthenticated ?? false;
    if (!canSendRef.current || provider === null) return;
    const hasExpired = pendingRef.current.some(({ createdAt }) => Date.now() - createdAt > maximumQueueAgeMs);
    if (hasExpired && !window.confirm("Some queued edits are older than seven days. Retrying may replace newer changes. Retry them anyway?")) return;
    pendingRef.current = pendingRef.current.map((pending) => ({ ...pending, blocked: false }));
    persistQueue();
    provider.sendStateless(JSON.stringify({ type: "board:sync" }));
  }, [persistQueue]);

  const status = sessionId === null ? "inactive" : connectionState.sessionId === sessionId ? connectionState.status : "connecting";
  const currentSessionState = sessionState.sessionId === sessionId
    ? sessionState
    : { sessionId, role: null, ownerConnected: false };
  const participants = presenceState.sessionId === sessionId ? presenceState.participants : [];
  const sharedHistory = historyState.sessionId === sessionId ? historyState.state : { canUndo: false, canRedo: false };
  const historyBusy = historyBusyState.sessionId === sessionId && historyBusyState.busy;
  return {
    status, queuedEditCount, queueBoardEdit, retryQueuedEdits, publishCursor,
    participants, sharedHistory, historyBusy,
    undoShared: useCallback((): void => publishHistoryAction("undo"), [publishHistoryAction]),
    redoShared: useCallback((): void => publishHistoryAction("redo"), [publishHistoryAction]),
    ...currentSessionState
  };
};
