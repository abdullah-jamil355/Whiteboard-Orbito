export type RealtimePresenceRole = "owner" | "editor" | "viewer" | null;

export type PresencePermission = Readonly<{
  authenticated: boolean;
  currentSession: boolean;
  role: RealtimePresenceRole;
}>;

export const canPublishCursor = ({ authenticated, currentSession, role }: PresencePermission): boolean =>
  authenticated && currentSession && role !== null;
