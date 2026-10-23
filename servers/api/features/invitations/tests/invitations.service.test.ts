import assert from "node:assert/strict";
import test from "node:test";
import { createInvitationService } from "../invitations.service.js";
import { InvitationCapacityError, InvitationFailure } from "../invitations.contracts.js";
import type { InvitationRepository, BoardInvitation } from "../invitations.contracts.js";
import type { BoardSession, SessionRepository } from "../../sessions/public.js";
import type { SessionService } from "../../sessions/public.js";

const at = new Date("2026-10-18T12:00:00Z");
const boardSession = (): BoardSession => ({ id: "507f1f77bcf86cd799439011", ownerIdentityId: "507f1f77bcf86cd799439012", title: "Planning", status: "active", board: { id: "b", title: "Planning", templateId: "blank", canvas: { gridStyle: "graph-paper", gridSpacing: 20 }, objects: [] }, sequence: 0, createdAt: at, updatedAt: at, endedAt: null });
const setup = () => {
  const session = boardSession();
  let saved: BoardInvitation | null = null;
  let emailSent = "";
  let acceptError: Error | null = null;
  let currentTime = at;
  const members = [{ identityId: "507f1f77bcf86cd799439014", email: "person@example.com", role: "editor" as const, displayName: "Person" }];
  const revoked: string[] = [];
  const repository: InvitationRepository = {
    create: (input) => Promise.resolve().then(() => { saved = { ...input, id: "507f1f77bcf86cd799439013" }; return saved; }),
    findPending: () => Promise.resolve(saved === null || saved.canceledAt !== null || saved.acceptedAt !== null ? [] : [saved]),
    findUsable: (hash, email, now) => Promise.resolve(saved?.tokenHash === hash && saved.recipientEmail === email && saved.canceledAt === null && saved.acceptedAt === null && saved.expiresAt > now ? saved : null),
    cancel: (_sessionId, _invitationId, now) => {
      if (!saved || saved.acceptedAt !== null || saved.canceledAt !== null) return Promise.resolve(null);
      saved = { ...saved, canceledAt: now };
      return Promise.resolve(saved);
    },
    accept: (hash, identityId, email, displayName) => Promise.resolve().then(() => {
      if (acceptError) throw acceptError;
      if (!saved || saved.tokenHash !== hash || saved.recipientEmail !== email || saved.acceptedAt !== null || saved.canceledAt !== null) return null;
      saved = { ...saved, acceptedAt: at, acceptedIdentityId: identityId, displayName }; return saved;
    }),
    hasMembership: (_sessionId, identityId) => Promise.resolve(saved?.acceptedIdentityId === identityId && !revoked.includes(identityId)),
    listMembers: () => Promise.resolve(members.filter((member) => !revoked.includes(member.identityId))),
    revokeMember: (_sessionId, identityId, now) => {
      const member = members.find((item) => item.identityId === identityId);
      if (!member || revoked.includes(identityId)) return Promise.resolve(null);
      revoked.push(identityId);
      saved = saved?.acceptedIdentityId === identityId ? { ...saved, canceledAt: now } : saved;
      return Promise.resolve(member);
    },
    deleteSessionInvitations: () => { saved = null; return Promise.resolve(); }
  };
  const sessions = { get: async (id: string, ownerId: string) => id === session.id && ownerId === session.ownerIdentityId ? session : Promise.reject(new Error("not found")) } as SessionService;
  const sessionRepository: SessionRepository = {
    create: () => Promise.reject(new Error("Not used by this fixture.")),
    findById: (id) => Promise.resolve(id === session.id ? session : null),
    findActiveForMember: () => Promise.resolve([]),
    rename: () => Promise.resolve(null),
    end: () => Promise.resolve(null),
    deleteEndedSession: () => Promise.resolve()
  };
  const closed: string[] = [];
  const service = createInvitationService({ invitations: repository, sessions, sessionRepository, mailer: { sendInvitation: ({ invitationUrl }) => { emailSent = invitationUrl; return Promise.resolve(); } }, reserveRateLimit: () => Promise.resolve(true), webOrigin: "http://localhost:3100", generateSecret: () => "A".repeat(48), now: () => currentTime, isMemberConnected: (_sessionId, identityId) => identityId.endsWith("014"), closeMemberConnections: (_sessionId, identityId) => closed.push(identityId) });
  return { service, get invitation() { return saved; }, get emailSent() { return emailSent; }, get closed() { return closed; }, session, setNow: (value: Date) => { currentTime = value; }, setAcceptError: (value: Error) => { acceptError = value; } };
};

void test("live collaboration invite requires a role and uses a private one-time link", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "  Person@Example.com  ", "127.0.0.1", "editor");
  const invite = state.invitation;
  assert.ok(invite);
  assert.equal(invite.recipientEmail, "person@example.com");
  assert.equal(invite.role, "editor");
  assert.equal(invite.expiresAt.getTime(), at.getTime() + 600_000);
  assert.equal(state.emailSent.includes("#token="), true);
  assert.equal(state.emailSent.includes("?token="), false);
});

void test("invite role is fixed to the role selected at invitation time", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "view@example.com", "127.0.0.1", "viewer");
  assert.equal(state.invitation?.role, "viewer");
});

void test("canceled invitation cannot be accepted", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "person@example.com", "127.0.0.1", "editor");
  const invitation = state.invitation;
  assert.ok(invitation);
  await state.service.cancel(state.session.id, state.session.ownerIdentityId, invitation.id);
  await assert.rejects(state.service.accept("A".repeat(48), { id: "507f1f77bcf86cd799439014", email: "person@example.com" }, "Person", "127.0.0.1"), (error: unknown) => error instanceof InvitationFailure && error.code === "invalid_or_expired");
});

void test("expired invitation is rejected", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "person@example.com", "127.0.0.1", "editor");
  state.setNow(new Date(at.getTime() + 600_000));
  await assert.rejects(state.service.accept("A".repeat(48), { id: "507f1f77bcf86cd799439014", email: "person@example.com" }, "Person", "127.0.0.1"), (error: unknown) => error instanceof InvitationFailure && error.code === "invalid_or_expired");
});

void test("concurrent accepts can create only one membership", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "person@example.com", "127.0.0.1", "editor");
  const identity = { id: "507f1f77bcf86cd799439014", email: "person@example.com" };
  const outcomes = await Promise.allSettled([
    state.service.accept("A".repeat(48), identity, "Person", "127.0.0.1"),
    state.service.accept("A".repeat(48), identity, "Person", "127.0.0.1")
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter((outcome) => outcome.status === "rejected").length, 1);
});

void test("acceptance requires the matching verified email and creates membership", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "person@example.com", "127.0.0.1", "editor");
  const membership = await state.service.accept("A".repeat(48), { id: "507f1f77bcf86cd799439014", email: "PERSON@example.com" }, "Person", "127.0.0.1");
  assert.deepEqual(membership, { sessionId: state.session.id, role: "editor", sessionTitle: "Planning" });
  assert.equal(await state.service.hasMembership(state.session.id, "507f1f77bcf86cd799439014"), true);
});

void test("a different email cannot consume the invitation", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "person@example.com", "127.0.0.1", "editor");
  await assert.rejects(state.service.accept("A".repeat(48), { id: "507f1f77bcf86cd799439014", email: "other@example.com" }, "Other", "127.0.0.1"), (error: unknown) => error instanceof InvitationFailure && error.code === "invalid_or_expired");
  assert.equal(state.invitation?.acceptedAt, null);
});

void test("full session leaves its one-time invitation pending for a later retry", async () => {
  const state = setup();
  await state.service.create(state.session.id, state.session.ownerIdentityId, "person@example.com", "127.0.0.1", "editor");
  state.setAcceptError(new InvitationCapacityError());
  await assert.rejects(state.service.accept("A".repeat(48), { id: "507f1f77bcf86cd799439014", email: "person@example.com" }, "Person", "127.0.0.1"), (error: unknown) => error instanceof InvitationFailure && error.code === "session_full");
  const invitation = state.invitation;
  assert.ok(invitation);
  assert.equal(invitation.acceptedAt, null);
  assert.equal(invitation.canceledAt, null);
});

void test("owner can list active participants with their live connection state", async () => {
  const state = setup();
  assert.deepEqual(await state.service.listMembers(state.session.id, state.session.ownerIdentityId), [{ identityId: "507f1f77bcf86cd799439014", email: "person@example.com", role: "editor", displayName: "Person", connected: true }]);
});

void test("removing a participant revokes membership and closes their live connection", async () => {
  const state = setup();
  await state.service.removeMember(state.session.id, state.session.ownerIdentityId, "507f1f77bcf86cd799439014");
  assert.deepEqual(state.closed, ["507f1f77bcf86cd799439014"]);
  assert.deepEqual(await state.service.listMembers(state.session.id, state.session.ownerIdentityId), []);
});

void test("owner cannot remove themselves as a participant", async () => {
  const state = setup();
  await assert.rejects(state.service.removeMember(state.session.id, state.session.ownerIdentityId, state.session.ownerIdentityId), (error: unknown) => error instanceof InvitationFailure && error.code === "not_found");
  assert.deepEqual(state.closed, []);
});
