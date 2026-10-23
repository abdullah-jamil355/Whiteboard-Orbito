"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import type { WhiteboardHistoryState, WhiteboardRealtimeServerMessage } from "@workspace/types";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import * as Y from "yjs";
import type { Board, CollaboratorPresence } from "@workspace/whiteboard";
import { applyLocalBoardChanges, diffBoardChanges, parseRealtimeServerMessage, validateBoardPayload } from "./realtime-client";
import { cacheStorageKey, maximumQueueAgeMs, maximumQueueBytes, maximumQueueEntries, nextQueuedEdit, queueStorageKey, readQueue, type PendingEdit } from "./realtime-queue";
import { createHistoryBusyStore, createNumberStore, inactiveHistoryBusy } from "./realtime-stores";
import { resetInFlightActionOnTransportLoss } from "./realtime-connection";
import { useWorkspacePresencePublishing } from "./use-workspace-presence-publishing";
import { readCollaborators } from "./realtime-presence";
import { createWhiteboardId } from "./create-whiteboard-id";

type RealtimeStatus = "inactive" | "connecting" | "connected" | "disconnected";
type Dependencies = Readonly<{
  sessionId: string | null;
  onBoardState: (board: Board, sequence: number) => void;
  onFeedback: (message: string | null) => void;
  onSessionEnded: () => void;
}>;
const realtimeUrl = process.env.NEXT_PUBLIC_WHITEBOARD_REALTIME_URL ?? "ws://localhost:4001";
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

  const handleServerMessage = useCallback((message: WhiteboardRealtimeServerMessage): void => {
    if (sessionId === null) return;
    if (message.type === "session:ended") {
      pendingRef.current = [];
      sendingActionIdRef.current = null;
      pendingHistoryActionRef.current = null;
      publishQueueCount();
      try {
        window.localStorage.removeItem(queueStorageKey(sessionId));
        window.localStorage.removeItem(cacheStorageKey(sessionId));
      } catch { /* The live board remains available in memory as a local copy. */ }
      onSessionEndedRef.current();
      return;
    }
    if (message.type === "session:state") {
      setSessionState({ sessionId, role: message.role, ownerConnected: message.ownerConnected });
      return;
    }
    if (message.type === "session:presence") {
      setSessionState((current) => current.sessionId === sessionId
        ? { ...current, ownerConnected: message.ownerConnected }
        : { sessionId, role: null, ownerConnected: message.ownerConnected });
      return;
    }
    if (message.type === "board:state" && message.history !== undefined) {
      setHistoryState({ sessionId, state: message.history });
    }
    if (message.type === "board:state" && retryHistoryAfterSyncRef.current) {
      retryHistoryAfterSyncRef.current = false;
      const pendingHistory = pendingHistoryActionRef.current;
      if (pendingHistory !== null) providerRef.current?.sendStateless(JSON.stringify({ type: `board:${pendingHistory.action}`, actionId: pendingHistory.actionId }));
    }
    if (message.type === "board:rejected") {
      if (message.actionId !== undefined && pendingHistoryActionRef.current?.actionId === message.actionId) {
        pendingHistoryActionRef.current = null;
        historyBusyStore.set({ sessionId, busy: false });
        const reason = message.reason === "unsafe_inverse"
          ? "That action can no longer be safely undone without overwriting a later change. The shared board was left unchanged."
          : message.reason === "history_unavailable"
            ? "There is no shared action available for that history command."
            : message.reason === "storage_unavailable"
              ? "The server could not save that history action. The shared board was left unchanged."
              : message.reason === "document_too_large"
                ? "This shared edit exceeds Whiteboard's safe MongoDB document limit. The shared board was left unchanged."
                : "The shared history action was rejected.";
        onFeedbackRef.current(reason);
        return;
      }
      if (message.actionId !== undefined && message.actionId === sendingActionIdRef.current) {
        sendingActionIdRef.current = null;
        if (message.reason === "storage_unavailable" || message.reason === "rate_limited") {
          canSendRef.current = false;
          onFeedbackRef.current("The server has not saved your queued edits yet. They remain on this device; reconnect and retry.");
        } else {
          pendingRef.current = pendingRef.current.map((pending) => pending.command.actionId === message.actionId ? { ...pending, blocked: true } : pending);
          persistQueue();
          onFeedbackRef.current(message.reason === "document_too_large"
            ? "This edit would exceed Whiteboard's safe MongoDB document limit. The shared board was left unchanged; simplify the content before retrying."
            : "One queued edit needs review and remains saved on this device. Later edits are paused to avoid overwriting it.");
        }
        return;
      }
      if (message.reason === "forbidden") onFeedbackRef.current("This session no longer allows edits from this account.");
      return;
    }

    if (message.actionId !== undefined) {
      if (pendingHistoryActionRef.current?.actionId === message.actionId) {
        pendingHistoryActionRef.current = null;
        historyBusyStore.set({ sessionId, busy: false });
      }
      pendingRef.current = pendingRef.current.filter(({ command }) => command.actionId !== message.actionId);
      publishQueueCount();
      persistQueue();
      if (sendingActionIdRef.current === message.actionId) sendingActionIdRef.current = null;
    }
    if (message.sequence < sequenceRef.current) {
      sendNext();
      return;
    }
    sequenceRef.current = message.sequence;
    const serverBoard = validateBoardPayload(message.board);
    if (serverBoard === null) {
      onFeedbackRef.current("The server sent a board that failed validation. Your local queued edits were kept.");
      return;
    }
    let feedback: string | null = null;
    try { window.localStorage.setItem(cacheStorageKey(sessionId), JSON.stringify({ board: serverBoard, sequence: message.sequence })); }
    catch { feedback = "The latest server board could not be cached on this device."; }
    let optimisticBoard = serverBoard;
    try {
      const replayed = pendingRef.current.reduce((current, pending) => applyLocalBoardChanges(current, pending.command.changes), serverBoard);
      optimisticBoard = validateBoardPayload(replayed) ?? serverBoard;
    } catch {
      feedback = "Some queued edits could not be previewed safely. The server board is shown and the edits remain on this device.";
    }
    onBoardStateRef.current(optimisticBoard, message.sequence);
    onFeedbackRef.current(feedback);
    sendNext();
  }, [historyBusyStore, persistQueue, publishQueueCount, sendNext, sessionId]);

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
      url: realtimeUrl,
      name: sessionId,
      document,
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
        if (message !== null) handleServerMessage(message);
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
  }, [handleServerMessage, historyBusyStore, publishQueueCount, sessionId]);

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
  const undoShared = useCallback((): void => publishHistoryAction("undo"), [publishHistoryAction]);
  const redoShared = useCallback((): void => publishHistoryAction("redo"), [publishHistoryAction]);

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
  return { status, queuedEditCount, queueBoardEdit, retryQueuedEdits, publishCursor, participants, sharedHistory, historyBusy, undoShared, redoShared, ...currentSessionState };
};
