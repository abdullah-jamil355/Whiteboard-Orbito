export type RealtimeTransportStatus = "connecting" | "connected" | "disconnected";

export const resetInFlightActionOnTransportLoss = (
  status: RealtimeTransportStatus,
  actionId: string | null
): string | null => (status === "connected" ? actionId : null);

export const getRealtimeUrl = (): string => {
  if (process.env.NEXT_PUBLIC_WHITEBOARD_REALTIME_URL) {
    return process.env.NEXT_PUBLIC_WHITEBOARD_REALTIME_URL;
  }
  const apiOrigin = process.env.NEXT_PUBLIC_WHITEBOARD_API_ORIGIN;
  if (apiOrigin) {
    try {
      const url = new URL(apiOrigin);
      const isSecure = url.protocol === "https:";
      return `${isSecure ? "wss:" : "ws:"}//${url.host}`;
    } catch {
      // fallback below
    }
  }
  return "ws://localhost:4001";
};

export const getRealtimeHistoryRejectionReason = (reason?: string): string => {
  switch (reason) {
    case "unsafe_inverse":
      return "That action can no longer be safely undone without overwriting a later change. The shared board was left unchanged.";
    case "history_unavailable":
      return "There is no shared action available for that history command.";
    case "storage_unavailable":
      return "The server could not save that history action. The shared board was left unchanged.";
    case "document_too_large":
      return "This shared edit exceeds Whiteboard's safe MongoDB document limit. The shared board was left unchanged.";
    default:
      return "The shared history action was rejected.";
  }
};

export const getRealtimeEditRejectionReason = (reason?: string): string => {
  if (reason === "document_too_large") {
    return "This edit would exceed Whiteboard's safe MongoDB document limit. The shared board was left unchanged; simplify the content before retrying.";
  }
  return "One queued edit needs review and remains saved on this device. Later edits are paused to avoid overwriting it.";
};
