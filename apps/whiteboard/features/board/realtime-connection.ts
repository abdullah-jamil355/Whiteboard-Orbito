export type RealtimeTransportStatus = "connecting" | "connected" | "disconnected";

export const resetInFlightActionOnTransportLoss = (
  status: RealtimeTransportStatus,
  actionId: string | null
): string | null => status === "connected" ? actionId : null;
