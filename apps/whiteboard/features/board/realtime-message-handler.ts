import type { WhiteboardHistoryState, WhiteboardRealtimeServerMessage } from "@workspace/types";
import type { Board } from "@workspace/whiteboard";
import { applyLocalBoardChanges, validateBoardPayload } from "./realtime-client";
import { cacheStorageKey, queueStorageKey, type PendingEdit } from "./realtime-queue";
import {
  getRealtimeEditRejectionReason,
  getRealtimeHistoryRejectionReason
} from "./realtime-connection";

export type MessageHandlerContext = {
  historyBusyStore: { set: (val: { busy: boolean; sessionId: string | null }) => void };
  onBoardState: (board: Board, sequence: number) => void;
  onFeedback: (message: string | null) => void;
  onSessionEnded: () => void;
  pendingHistoryActionRef: { current: Readonly<{ action: "undo" | "redo"; actionId: string }> | null };
  pendingRef: { current: PendingEdit[] };
  persistQueue: () => void;
  provider: { sendStateless: (payload: string) => void } | null;
  publishQueueCount: () => void;
  retryHistoryAfterSyncRef: { current: boolean };
  sendNext: () => void;
  sendingActionIdRef: { current: string | null };
  sequenceRef: { current: number };
  sessionId: string;
  setHistoryState: (val: { sessionId: string; state: WhiteboardHistoryState }) => void;
  setSessionState: (
    updater:
      | { ownerConnected: boolean; role: "editor" | "owner" | "viewer" | null; sessionId: string }
      | ((curr: { ownerConnected: boolean; role: "editor" | "owner" | "viewer" | null; sessionId: string | null }) => {
          ownerConnected: boolean;
          role: "editor" | "owner" | "viewer" | null;
          sessionId: string;
        })
  ) => void;
};

export const handleRealtimeServerMessage = (
  message: WhiteboardRealtimeServerMessage,
  ctx: MessageHandlerContext
): void => {
  const { sessionId } = ctx;
  if (message.type === "session:ended") {
    ctx.pendingRef.current = [];
    ctx.sendingActionIdRef.current = null;
    ctx.pendingHistoryActionRef.current = null;
    ctx.publishQueueCount();
    try {
      window.localStorage.removeItem(queueStorageKey(sessionId));
      window.localStorage.removeItem(cacheStorageKey(sessionId));
    } catch {
      /* Keep board in memory */
    }
    ctx.onSessionEnded();
    return;
  }
  if (message.type === "session:state") {
    ctx.setSessionState({ sessionId, role: message.role, ownerConnected: message.ownerConnected });
    return;
  }
  if (message.type === "session:presence") {
    ctx.setSessionState((current) => ({
      sessionId: current.sessionId ?? sessionId,
      role: current.role,
      ownerConnected: message.ownerConnected
    }));
    return;
  }
  if (message.type === "board:state" && message.history !== undefined) {
    ctx.setHistoryState({ sessionId, state: message.history });
  }
  if (message.type === "board:state" && ctx.retryHistoryAfterSyncRef.current) {
    ctx.retryHistoryAfterSyncRef.current = false;
    const pendingHistory = ctx.pendingHistoryActionRef.current;
    if (pendingHistory !== null) {
      ctx.provider?.sendStateless(
        JSON.stringify({ type: `board:${pendingHistory.action}`, actionId: pendingHistory.actionId })
      );
    }
  }
  if (message.type === "board:rejected") {
    if (message.actionId !== undefined && ctx.pendingHistoryActionRef.current?.actionId === message.actionId) {
      ctx.pendingHistoryActionRef.current = null;
      ctx.historyBusyStore.set({ sessionId, busy: false });
      ctx.onFeedback(getRealtimeHistoryRejectionReason(message.reason));
      return;
    }
    if (message.actionId !== undefined && message.actionId === ctx.sendingActionIdRef.current) {
      ctx.sendingActionIdRef.current = null;
      if (message.reason === "storage_unavailable" || message.reason === "rate_limited") {
        ctx.onFeedback("The server has not saved your queued edits yet. They remain on this device; reconnect and retry.");
      } else {
        ctx.pendingRef.current = ctx.pendingRef.current.map((pending) =>
          pending.command.actionId === message.actionId ? { ...pending, blocked: true } : pending
        );
        ctx.persistQueue();
        ctx.onFeedback(getRealtimeEditRejectionReason(message.reason));
      }
      return;
    }
    if (message.reason === "forbidden") ctx.onFeedback("This session no longer allows edits from this account.");
    return;
  }

  if (message.actionId !== undefined) {
    if (ctx.pendingHistoryActionRef.current?.actionId === message.actionId) {
      ctx.pendingHistoryActionRef.current = null;
      ctx.historyBusyStore.set({ sessionId, busy: false });
    }
    ctx.pendingRef.current = ctx.pendingRef.current.filter(({ command }) => command.actionId !== message.actionId);
    ctx.publishQueueCount();
    ctx.persistQueue();
    if (ctx.sendingActionIdRef.current === message.actionId) ctx.sendingActionIdRef.current = null;
  }
  if (message.sequence < ctx.sequenceRef.current) {
    ctx.sendNext();
    return;
  }
  ctx.sequenceRef.current = message.sequence;
  const serverBoard = validateBoardPayload(message.board);
  if (serverBoard === null) {
    ctx.onFeedback("The server sent a board that failed validation. Your local queued edits were kept.");
    return;
  }
  let feedback: string | null = null;
  try {
    window.localStorage.setItem(cacheStorageKey(sessionId), JSON.stringify({ board: serverBoard, sequence: message.sequence }));
  } catch {
    feedback = "The latest server board could not be cached on this device.";
  }
  let optimisticBoard = serverBoard;
  try {
    const replayed = ctx.pendingRef.current.reduce((current, pending) => applyLocalBoardChanges(current, pending.command.changes), serverBoard);
    optimisticBoard = validateBoardPayload(replayed) ?? serverBoard;
  } catch {
    feedback = "Some queued edits could not be previewed safely. The server board is shown and the edits remain on this device.";
  }
  ctx.onBoardState(optimisticBoard, message.sequence);
  ctx.onFeedback(feedback);
  ctx.sendNext();
};
