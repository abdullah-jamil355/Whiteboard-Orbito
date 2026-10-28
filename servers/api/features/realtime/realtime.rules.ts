export const parseRealtimeRoomId = (roomName: string): string | null =>
  /^[\da-f]{24}$/i.test(roomName) ? roomName : null;

export const readRealtimeSessionCookie = (cookieHeader: string | null): string | undefined => {
  const encodedToken = cookieHeader?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("wb_session="))
    ?.slice("wb_session=".length);
  if (!encodedToken) return undefined;
  try {
    return decodeURIComponent(encodedToken);
  } catch {
    return undefined;
  }
};

export const isAllowedRealtimeOrigin = (requestOrigin: string | null, allowedOrigin: string): boolean => {
  if (!requestOrigin) return false;
  return requestOrigin.replace(/\/+$/, "") === allowedOrigin.replace(/\/+$/, "");
};


export const sanitizeRealtimeAwarenessState = (
  state: unknown,
  displayName: string,
  role: "owner" | "editor" | "viewer"
): Readonly<{ user: Readonly<{ name: string; role: "owner" | "editor" | "viewer" }>; cursor?: Readonly<{ x: number; y: number }> }> => {
  const safeName = displayName.trim().slice(0, 80) || "Participant";
  if (typeof state !== "object" || state === null || Array.isArray(state)) return { user: { name: safeName, role } };
  const candidate = (state as Record<string, unknown>).cursor;
  if (typeof candidate === "object" && candidate !== null && !Array.isArray(candidate)) {
    const x = (candidate as Record<string, unknown>).x;
    const y = (candidate as Record<string, unknown>).y;
    if (typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= 1_000_000
      && typeof y === "number" && Number.isFinite(y) && Math.abs(y) <= 1_000_000) {
      return { user: { name: safeName, role }, cursor: { x, y } };
    }
  }
  return { user: { name: safeName, role } };
};
