import { createOpaqueSecret, hashOpaqueSecret, normalizeEmail } from "../identity/public.js";
import { InvitationCapacityError, InvitationFailure, InvitationMembershipExistsError } from "./invitations.contracts.js";
import type { InvitationRepository } from "./invitations.contracts.js";
import type { InvitationMailer } from "../identity/public.js";
import type { SessionRepository } from "../sessions/public.js";
import { SessionFailure } from "../sessions/public.js";
import type { SessionService } from "../sessions/public.js";
import type { InvitationRole } from "./invitations.contracts.js";

type Dependencies = Readonly<{
  invitations: InvitationRepository;
  sessions: SessionService;
  sessionRepository: SessionRepository;
  mailer: InvitationMailer;
  reserveRateLimit: (identityId: string, ipAddress: string) => Promise<boolean>;
  webOrigin: string;
  closeMemberConnections?: (sessionId: string, identityId: string) => void;
  isMemberConnected?: (sessionId: string, identityId: string) => boolean;
  generateSecret?: () => string;
  now?: () => Date;
}>;
export type InvitationService = Readonly<{
  create: (sessionId: string, ownerId: string, email: string, ipAddress: string, role: InvitationRole) => Promise<Readonly<{ invitationUrl: string; delivered: boolean }>>;
  list: (sessionId: string, ownerId: string) => Promise<readonly Readonly<{ id: string; email: string; role: InvitationRole; createdAt: Date; expiresAt: Date }>[] >;
  cancel: (sessionId: string, ownerId: string, invitationId: string) => Promise<void>;
  listMembers: (sessionId: string, ownerId: string) => Promise<readonly Readonly<{ identityId: string; email: string; role: InvitationRole; displayName: string; connected: boolean }>[] >;
  removeMember: (sessionId: string, ownerId: string, identityId: string) => Promise<void>;
  accept: (token: string, identity: Readonly<{ id: string; email: string }>, displayName: string, ipAddress: string) => Promise<Readonly<{ sessionId: string; role: InvitationRole; sessionTitle: string }>>;
  hasMembership: (sessionId: string, identityId: string) => Promise<boolean>;
}>;
const lifetimeMs = 10 * 60 * 1000;
const requireOwnedActiveSession = async (sessions: SessionService, sessionId: string, ownerId: string) => {
  try {
    const session = await sessions.get(sessionId, ownerId);
    if (session.status !== "active") throw new InvitationFailure("not_found");
    return session;
  } catch (error) {
    if (error instanceof InvitationFailure) throw error;
    if (error instanceof SessionFailure && error.code === "storage_unavailable") throw new InvitationFailure("storage_unavailable");
    throw new InvitationFailure("not_found");
  }
};

export const createInvitationService = ({ invitations, sessions, sessionRepository, mailer, reserveRateLimit, webOrigin, closeMemberConnections = () => undefined, isMemberConnected = () => false, generateSecret = createOpaqueSecret, now = () => new Date() }: Dependencies): InvitationService => Object.freeze({
  create: async (sessionId, ownerId, email, ipAddress, role) => {
    const session = await requireOwnedActiveSession(sessions, sessionId, ownerId);
    try { if (!await reserveRateLimit(ownerId, ipAddress)) throw new InvitationFailure("rate_limited"); }
    catch (error) { if (error instanceof InvitationFailure) throw error; throw new InvitationFailure("storage_unavailable"); }
    const recipient = normalizeEmail(email);
    const timestamp = now();
    const active = await invitations.findPending(sessionId, timestamp).catch(() => { throw new InvitationFailure("storage_unavailable"); });
    if (active.length >= 100) throw new InvitationFailure("storage_unavailable");
    const token = generateSecret();
    const expiresAt = new Date(timestamp.getTime() + lifetimeMs);
    try {
      await invitations.create({ sessionId, recipientEmail: recipient, role, tokenHash: hashOpaqueSecret(token), createdAt: timestamp, expiresAt, canceledAt: null, acceptedAt: null, acceptedIdentityId: null, displayName: null });
    } catch { throw new InvitationFailure("storage_unavailable"); }
    const url = new URL("/invite/accept", webOrigin);
    url.hash = new URLSearchParams({ token }).toString();
    let delivered = false;
    try {
      await mailer.sendInvitation({ ownerIdentityId: ownerId, recipient, invitationUrl: url.toString(), sessionTitle: session.title, expiresAt });
      delivered = true;
    } catch {
      delivered = false;
    }
    return Object.freeze({ invitationUrl: url.toString(), delivered });
  },
  list: async (sessionId, ownerId) => {
    await requireOwnedActiveSession(sessions, sessionId, ownerId);
    try { return Object.freeze((await invitations.findPending(sessionId, now())).map(({ id, recipientEmail, role, createdAt, expiresAt }) => Object.freeze({ id, email: recipientEmail, role, createdAt, expiresAt }))); }
    catch { throw new InvitationFailure("storage_unavailable"); }
  },
  cancel: async (sessionId, ownerId, invitationId) => {
    await requireOwnedActiveSession(sessions, sessionId, ownerId);
    try { if (!await invitations.cancel(sessionId, invitationId, now())) throw new InvitationFailure("not_found"); }
    catch (error) { if (error instanceof InvitationFailure) throw error; throw new InvitationFailure("storage_unavailable"); }
  },
  listMembers: async (sessionId, ownerId) => {
    await requireOwnedActiveSession(sessions, sessionId, ownerId);
    try {
      const members = await invitations.listMembers(sessionId);
      return Object.freeze(members.map((member) => Object.freeze({ ...member, connected: isMemberConnected(sessionId, member.identityId) })));
    } catch { throw new InvitationFailure("storage_unavailable"); }
  },
  removeMember: async (sessionId, ownerId, identityId) => {
    const session = await requireOwnedActiveSession(sessions, sessionId, ownerId);
    if (identityId === session.ownerIdentityId) throw new InvitationFailure("not_found");
    try {
      const revoked = await invitations.revokeMember(sessionId, identityId, now());
      if (!revoked) throw new InvitationFailure("not_found");
      closeMemberConnections(sessionId, identityId);
    } catch (error) {
      if (error instanceof InvitationFailure) throw error;
      throw new InvitationFailure("storage_unavailable");
    }
  },
  accept: async (token, identity, displayName, ipAddress) => {
    if (token.length < 32 || token.length > 256) throw new InvitationFailure("invalid_or_expired");
    try { if (!await reserveRateLimit(identity.id, ipAddress)) throw new InvitationFailure("rate_limited"); }
    catch (error) { if (error instanceof InvitationFailure) throw error; throw new InvitationFailure("storage_unavailable"); }
    const email = normalizeEmail(identity.email);
    let invitation;
    try {
      const candidate = await invitations.findUsable(hashOpaqueSecret(token), email, now());
      if (!candidate) throw new InvitationFailure("invalid_or_expired");
      const session = await sessionRepository.findById(candidate.sessionId);
      if (!session || session.status !== "active") throw new InvitationFailure("not_found");
      if (await invitations.hasMembership(candidate.sessionId, identity.id)) throw new InvitationFailure("already_member");
      // Match the verified identity email as part of the atomic one-use consume query.
      invitation = await invitations.accept(candidate.tokenHash, identity.id, email, displayName.trim(), now());
    } catch (error) {
      if (error instanceof InvitationFailure) throw error;
      if (error instanceof InvitationCapacityError) throw new InvitationFailure("session_full");
      if (error instanceof InvitationMembershipExistsError) throw new InvitationFailure("already_member");
      if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) throw new InvitationFailure("already_member");
      throw new InvitationFailure("storage_unavailable");
    }
    if (!invitation) throw new InvitationFailure("invalid_or_expired");
    const session = await sessionRepository.findById(invitation.sessionId).catch(() => { throw new InvitationFailure("storage_unavailable"); });
    if (!session || session.status !== "active") throw new InvitationFailure("not_found");
    return Object.freeze({ sessionId: invitation.sessionId, role: invitation.role, sessionTitle: session.title });
  },
  hasMembership: (sessionId, identityId) => invitations.hasMembership(sessionId, identityId)
});
