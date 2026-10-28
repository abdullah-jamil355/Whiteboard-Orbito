import type { Board, BoardSession } from "@workspace/whiteboard";

const apiOrigin = process.env.NEXT_PUBLIC_WHITEBOARD_API_ORIGIN ?? "http://localhost:4000";

type ApiFailure = Readonly<{ error?: Readonly<{ code?: string; message?: string }> }>;
export class WhiteboardApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message);
    this.name = "WhiteboardApiError";
  }
}
export const isUnavailableSessionError = (error: unknown): error is WhiteboardApiError =>
  error instanceof WhiteboardApiError && error.code === "session_not_found";
export type VerifiedIdentity = Readonly<{ id: string; email: string }>;
export type ApiBoardSession = Readonly<{
  id: string;
  ownerIdentityId: string;
  title: string;
  status: "active" | "ended";
  board: Board;
  sequence: number;
  createdAt: string;
  updatedAt: string;
  endedAt: string | null;
}>;

const request = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(new URL(path, apiOrigin), {
      ...init,
      cache: "no-store",
      credentials: "include",
      headers: { ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers }
    });
  } catch (err) {
    console.error(`[API FETCH ERROR] Failed to fetch ${path} from ${apiOrigin}:`, err);
    throw new Error("Whiteboard API is unreachable. Check that it is running and API WEB_ORIGIN matches this app's exact origin.");
  }
  if (!response.ok) {
    const body = await response.json().catch((): ApiFailure => ({})) as ApiFailure;
    throw new WhiteboardApiError(body.error?.message ?? `Whiteboard API returned ${response.status}.`, response.status, body.error?.code);
  }
  if (response.status === 204) return undefined as T;
  return await response.json() as T;
};

export const getVerifiedIdentity = async (): Promise<VerifiedIdentity | null> => {
  try {
    const result = await request<{ identity: VerifiedIdentity }>("/auth/session");
    return result.identity;
  } catch (error) {
    if (error instanceof Error && error.message.includes("401")) return null;
    return null;
  }
};

export const requestSignInLink = (email: string): Promise<{ message: string }> =>
  request("/auth/magic-links", { method: "POST", body: JSON.stringify({ email }) });

export const readDevelopmentMailbox = (email: string): Promise<{ messages: readonly Readonly<{ kind: "sign-in" | "invitation"; verificationUrl?: string; invitationUrl?: string; expiresAt: string }>[] }> =>
  request("/__dev/mailbox", { method: "POST", body: JSON.stringify({ email }) });

export const signOut = (): Promise<void> => request("/auth/session", { method: "DELETE" });
export type GoogleMailStatus = Readonly<{ configured: boolean; connected: boolean; email?: string }>;
export const getGoogleMailStatus = (): Promise<GoogleMailStatus> => request("/auth/google-mail/status");
export const startGoogleMailConnect = (): Promise<{ authorizationUrl: string }> => request("/auth/google-mail/connect", { method: "POST" });
export const disconnectGoogleMail = (): Promise<void> => request("/auth/google-mail/connection", { method: "DELETE" });

export const createServerSession = (input: Readonly<{ title: string; board: Board }>): Promise<{ session: ApiBoardSession }> =>
  request("/sessions", { method: "POST", body: JSON.stringify(input) });

export const renameServerSession = (sessionId: string, title: string): Promise<{ session: ApiBoardSession }> =>
  request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "PATCH", body: JSON.stringify({ title }) });

export const endServerSession = (sessionId: string, expectedSequence?: number): Promise<{ session: ApiBoardSession }> =>
  request(`/sessions/${encodeURIComponent(sessionId)}`, { method: "DELETE", ...(expectedSequence === undefined ? {} : { body: JSON.stringify({ expectedSequence }) }) });

export const getServerSession = (sessionId: string): Promise<{ session: ApiBoardSession }> =>
  request(`/sessions/${encodeURIComponent(sessionId)}`);

export type ApiActiveSession = Readonly<{ id: string; title: string; sequence: number; updatedAt: string }>;
export const listMyActiveSessions = (): Promise<{ sessions: readonly ApiActiveSession[] }> => request("/sessions/mine");

export const createInvitation = (sessionId: string, input: Readonly<{ email: string; role: "editor" | "viewer" }>): Promise<{ message: string }> =>
  request(`/sessions/${encodeURIComponent(sessionId)}/invitations`, { method: "POST", body: JSON.stringify(input) });

export type ApiInvitation = Readonly<{ id: string; email: string; role: "editor" | "viewer"; createdAt: string; expiresAt: string }>;
export const listInvitations = (sessionId: string): Promise<{ invitations: readonly ApiInvitation[] }> => request(`/sessions/${encodeURIComponent(sessionId)}/invitations`);
export const cancelInvitation = (sessionId: string, invitationId: string): Promise<void> => request(`/sessions/${encodeURIComponent(sessionId)}/invitations/${encodeURIComponent(invitationId)}`, { method: "DELETE" });
export type ApiParticipant = Readonly<{ identityId: string; email: string; role: "editor" | "viewer"; displayName: string; connected: boolean }>;
export const listSessionParticipants = (sessionId: string): Promise<{ members: readonly ApiParticipant[] }> => request(`/sessions/${encodeURIComponent(sessionId)}/members`);
export const removeSessionParticipant = (sessionId: string, identityId: string): Promise<void> =>
  request(`/sessions/${encodeURIComponent(sessionId)}/members/${encodeURIComponent(identityId)}`, { method: "DELETE" });

export const acceptInvitation = (token: string, displayName: string): Promise<{ membership: Readonly<{ sessionId: string; role: "editor" | "viewer"; sessionTitle: string }> }> =>
  request("/invitations/accept", { method: "POST", body: JSON.stringify({ token, displayName }) });

export const consumeSignInLink = (token: string): Promise<{ identityId: string; expiresAt: string }> =>
  request("/auth/magic-links/consume", { method: "POST", body: JSON.stringify({ token }) });

export const toLocalSession = (session: ApiBoardSession): BoardSession => ({
  id: session.id,
  ownerId: session.ownerIdentityId,
  title: session.title,
  status: "active",
  createdAt: session.createdAt,
  updatedAt: session.updatedAt,
  initialBoard: session.board
});

