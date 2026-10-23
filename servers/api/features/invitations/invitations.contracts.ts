export type InvitationRole = "editor" | "viewer";
export type SessionMembership = Readonly<{ identityId: string; role: InvitationRole; displayName: string }>;
export type SessionParticipant = Readonly<{ identityId: string; email: string; role: InvitationRole; displayName: string }>;
export type BoardInvitation = Readonly<{
  id: string; sessionId: string; recipientEmail: string; role: InvitationRole;
  tokenHash: string; createdAt: Date; expiresAt: Date; canceledAt: Date | null;
  acceptedAt: Date | null; acceptedIdentityId: string | null; displayName: string | null;
}>;
export type InvitationRepository = Readonly<{
  create: (input: Omit<BoardInvitation, "id">) => Promise<BoardInvitation>;
  findPending: (sessionId: string, now: Date) => Promise<readonly BoardInvitation[]>;
  findUsable: (tokenHash: string, email: string, now: Date) => Promise<BoardInvitation | null>;
  cancel: (sessionId: string, invitationId: string, now: Date) => Promise<BoardInvitation | null>;
  accept: (tokenHash: string, identityId: string, email: string, displayName: string, now: Date) => Promise<BoardInvitation | null>;
  hasMembership: (sessionId: string, identityId: string) => Promise<boolean>;
  listMembers: (sessionId: string) => Promise<readonly SessionParticipant[]>;
  revokeMember: (sessionId: string, identityId: string, now: Date) => Promise<SessionParticipant | null>;
  deleteSessionInvitations: (sessionId: string) => Promise<void>;
}>;
export class InvitationCapacityError extends Error { constructor() { super("session_full"); this.name = "InvitationCapacityError"; } }
export class InvitationMembershipExistsError extends Error { constructor() { super("already_member"); this.name = "InvitationMembershipExistsError"; } }
export type RealtimeInvitationRepository = InvitationRepository & Readonly<{
  findMembership: (sessionId: string, identityId: string) => Promise<SessionMembership | null>;
}>;
export type InvitationFailureCode = "not_found" | "invalid_or_expired" | "email_mismatch" | "already_member" | "session_full" | "rate_limited" | "storage_unavailable" | "delivery_unavailable";
export class InvitationFailure extends Error {
  constructor(readonly code: InvitationFailureCode) { super(code); this.name = "InvitationFailure"; }
}
