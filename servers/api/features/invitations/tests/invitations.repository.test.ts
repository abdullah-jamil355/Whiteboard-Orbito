import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mongoose } from "../../../integrations/mongodb/index.js";
import { createInvitationRepository, ensureInvitationIndexes } from "../invitations.repository.js";
import { InvitationCapacityError, InvitationMembershipExistsError } from "../invitations.contracts.js";
import { WbInvitationModel } from "../invitations.model.js";
import { WbBoardSessionModel } from "../../sessions/public.js";

const sessionId = new mongoose.Types.ObjectId();
const memberId = new mongoose.Types.ObjectId();
const inviteId = new mongoose.Types.ObjectId();
const now = new Date("2026-01-01T00:00:00Z");
const record = (overrides: Record<string, unknown> = {}) => ({
  _id: inviteId, sessionId, recipientEmail: "person@example.com", role: "editor" as const, tokenHash: "token-hash",
  createdAt: now, expiresAt: new Date(now.getTime() + 60_000), canceledAt: null, acceptedAt: null,
  acceptedIdentityId: null, displayName: null, toObject: () => ({ _id: inviteId, sessionId, recipientEmail: "person@example.com", role: "editor" as const, tokenHash: "token-hash", createdAt: now, expiresAt: new Date(now.getTime() + 60_000), canceledAt: null, acceptedAt: null, acceptedIdentityId: null, displayName: null }),
  ...overrides
});
const exec = <T>(value: T) => ({ exec: () => Promise.resolve(value) });
const mock = (context: TestContext, model: object, method: string, implementation: (...args: never[]) => unknown): void => {
  context.mock.method(model as Record<string, (...args: never[]) => unknown>, method, implementation as never);
};

void test("creates and maps an invitation with session references converted to ObjectIds", async (context) => {
  let created: Record<string, unknown> | undefined;
  mock(context, WbInvitationModel, "create", ((input: Record<string, unknown>) => { created = input; return Promise.resolve(record()); }));
  const result = await createInvitationRepository().create({
    sessionId: sessionId.toHexString(), recipientEmail: "person@example.com", role: "editor", tokenHash: "token-hash",
    createdAt: now, expiresAt: new Date(now.getTime() + 60_000), canceledAt: null, acceptedAt: null, acceptedIdentityId: null, displayName: null
  });
  assert.equal((created?.sessionId as mongoose.Types.ObjectId).toHexString(), sessionId.toHexString());
  assert.equal(created?.deleteAt, created?.expiresAt);
  assert.equal(result.id, inviteId.toHexString());
});

void test("lists pending invitations in descending order and finds only usable invitations", async (context) => {
  let pendingQuery: unknown;
  mock(context, WbInvitationModel, "find", ((query: unknown) => {
    pendingQuery = query;
    return { sort(order: unknown) { assert.deepEqual(order, { createdAt: -1 }); return this; }, limit(count: number) { assert.equal(count, 100); return this; }, exec: () => Promise.resolve([record()]) };
  }));
  const repository = createInvitationRepository();
  assert.equal((await repository.findPending(sessionId.toHexString(), now))[0]?.id, inviteId.toHexString());
  assert.deepEqual(pendingQuery, { sessionId, acceptedAt: null, canceledAt: null, expiresAt: { $gt: now } });
  let usableQuery: unknown;
  mock(context, WbInvitationModel, "findOne", ((query: unknown) => { usableQuery = query; return exec(record()); }));
  assert.equal((await repository.findUsable("token-hash", "person@example.com", now))?.role, "editor");
  assert.deepEqual(usableQuery, { tokenHash: "token-hash", recipientEmail: "person@example.com", acceptedAt: null, canceledAt: null, expiresAt: { $gt: now } });
  mock(context, WbInvitationModel, "findOne", (() => exec(null)));
  assert.equal(await repository.findUsable("invalid", "person@example.com", now), null);
});

void test("cancels valid invitations and ignores malformed IDs", async (context) => {
  let query: unknown;
  mock(context, WbInvitationModel, "findOneAndUpdate", ((filter: unknown) => { query = filter; return exec(record({ canceledAt: now })); }));
  const repository = createInvitationRepository();
  assert.equal(await repository.cancel("bad", inviteId.toHexString(), now), null);
  const canceled = await repository.cancel(sessionId.toHexString(), inviteId.toHexString(), now);
  assert.equal(canceled?.canceledAt, now);
  assert.deepEqual(query, { _id: inviteId, sessionId, canceledAt: null, acceptedAt: null, expiresAt: { $gt: now } });
  mock(context, WbInvitationModel, "findOneAndUpdate", (() => exec(null)));
  assert.equal(await repository.cancel(sessionId.toHexString(), inviteId.toHexString(), now), null);
});

void test("checks membership and lists accepted members with display-name fallback", async (context) => {
  const repository = createInvitationRepository();
  mock(context, WbInvitationModel, "exists", (() => Promise.resolve({ _id: inviteId })));
  assert.equal(await repository.hasMembership(sessionId.toHexString(), memberId.toHexString()), true);
  assert.equal(await repository.hasMembership("bad", memberId.toHexString()), false);
  mock(context, WbInvitationModel, "exists", (() => Promise.resolve(null)));
  assert.equal(await repository.hasMembership(sessionId.toHexString(), memberId.toHexString()), false);
  let query: unknown;
  mock(context, WbInvitationModel, "find", ((filter: unknown) => {
    query = filter;
    const rows = [record({ acceptedAt: now, acceptedIdentityId: memberId, displayName: null }), record({ acceptedAt: now, acceptedIdentityId: null })];
    return { sort(order: unknown) { assert.deepEqual(order, { acceptedAt: 1 }); return this; }, lean() { return this; }, exec: () => Promise.resolve(rows) };
  }));
  const members = await repository.listMembers(sessionId.toHexString());
  assert.deepEqual(members, [{ identityId: memberId.toHexString(), email: "person@example.com", role: "editor", displayName: "person@example.com" }]);
  assert.deepEqual(query, { sessionId, acceptedAt: { $type: "date" }, canceledAt: null });
  assert.deepEqual(await repository.listMembers("bad"), []);
});

void test("finds memberships with their role and display-name fallback", async (context) => {
  const repository = createInvitationRepository();
  assert.equal(await repository.findMembership("bad", memberId.toHexString()), null);
  let query: unknown;
  mock(context, WbInvitationModel, "findOne", ((filter: unknown) => { query = filter; return exec(record({ acceptedIdentityId: memberId, acceptedAt: now })); }));
  assert.deepEqual(await repository.findMembership(sessionId.toHexString(), memberId.toHexString()), { identityId: memberId.toHexString(), role: "editor", displayName: "person@example.com" });
  assert.deepEqual(query, { sessionId, acceptedIdentityId: memberId, acceptedAt: { $type: "date" }, canceledAt: null });
  mock(context, WbInvitationModel, "findOne", (() => exec(null)));
  assert.equal(await repository.findMembership(sessionId.toHexString(), memberId.toHexString()), null);
});

void test("deletes invitations by valid session ID and prepares invitation indexes", async (context) => {
  const repository = createInvitationRepository();
  let deleteQuery: unknown;
  mock(context, WbInvitationModel, "deleteMany", ((query: unknown) => { deleteQuery = query; return exec({ deletedCount: 1 }); }));
  await repository.deleteSessionInvitations("bad");
  await repository.deleteSessionInvitations(sessionId.toHexString());
  assert.deepEqual(deleteQuery, { sessionId });
  let cleanup: unknown;
  mock(context, WbInvitationModel, "updateMany", ((filter: unknown) => { cleanup = filter; return exec({ modifiedCount: 1 }); }));
  let indexes = 0;
  mock(context, WbInvitationModel, "createIndexes", (() => { indexes += 1; return Promise.resolve([]); }));
  await ensureInvitationIndexes();
  assert.deepEqual(cleanup, { acceptedAt: { $type: "date" }, deleteAt: { $exists: true } });
  assert.equal(indexes, 1);
});

void test("accepts an invitation transactionally and records the selected member role data", async (context) => {
  const transaction = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: () => Promise.resolve() };
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction)));
  let invitationQuery: unknown;
  let invitationUpdate: unknown;
  mock(context, WbInvitationModel, "findOneAndUpdate", ((filter: unknown, update: unknown) => { invitationQuery = filter; invitationUpdate = update; return exec(record()); }));
  let membershipUpdate: unknown[] = [];
  mock(context, WbBoardSessionModel, "updateOne", ((...args: unknown[]) => { membershipUpdate = args; return exec({ modifiedCount: 1 }); }));
  const result = await createInvitationRepository().accept("token-hash", memberId.toHexString(), "person@example.com", "Person", now);
  assert.ok(result);
  assert.equal(result.id, inviteId.toHexString());
  assert.equal(result.role, "editor");
  assert.deepEqual(invitationQuery, { tokenHash: "token-hash", recipientEmail: "person@example.com", acceptedAt: null, canceledAt: null, expiresAt: { $gt: now } });
  assert.equal((invitationUpdate as { $set: { displayName: string } }).$set.displayName, "Person");
  assert.deepEqual((membershipUpdate[0] as { $expr: unknown }).$expr, { $lt: [{ $size: { $ifNull: ["$memberIdentityIds", []] } }, 25] });
  assert.equal(await createInvitationRepository().accept("token", "bad", "person@example.com", "Person", now), null);
});

void test("rejects membership and capacity races while leaving an unusable invitation unconsumed", async (context) => {
  const transaction = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: () => Promise.resolve() };
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction)));
  mock(context, WbInvitationModel, "findOneAndUpdate", (() => exec(null)));
  assert.equal(await createInvitationRepository().accept("token", memberId.toHexString(), "person@example.com", "Person", now), null);

  mock(context, WbInvitationModel, "findOneAndUpdate", (() => exec(record())));
  mock(context, WbBoardSessionModel, "updateOne", (() => exec({ modifiedCount: 0 })));
  mock(context, WbBoardSessionModel, "exists", (() => ({ session: () => Promise.resolve({ _id: sessionId }) })));
  await assert.rejects(createInvitationRepository().accept("token", memberId.toHexString(), "person@example.com", "Person", now), InvitationMembershipExistsError);

  mock(context, WbBoardSessionModel, "exists", (() => ({ session: () => Promise.resolve(null) })));
  await assert.rejects(createInvitationRepository().accept("token", memberId.toHexString(), "person@example.com", "Person", now), InvitationCapacityError);
});

void test("revokes invited members transactionally and rejects invalid or missing memberships", async (context) => {
  const transaction = { withTransaction: async (callback: () => Promise<unknown>) => callback(), endSession: () => Promise.resolve() };
  mock(context, mongoose, "startSession", (() => Promise.resolve(transaction)));
  assert.equal(await createInvitationRepository().revokeMember("bad", memberId.toHexString(), now), null);
  let sessionQuery: unknown;
  mock(context, WbBoardSessionModel, "findOne", ((query: unknown) => {
    sessionQuery = query;
    return { session() { return this; }, lean() { return this; }, exec: () => Promise.resolve({ _id: sessionId }) };
  }));
  mock(context, WbInvitationModel, "findOneAndUpdate", (() => exec(record({ acceptedIdentityId: memberId, acceptedAt: now }))));
  let removeQuery: unknown;
  mock(context, WbBoardSessionModel, "updateOne", ((query: unknown) => { removeQuery = query; return exec({ modifiedCount: 1 }); }));
  const revoked = await createInvitationRepository().revokeMember(sessionId.toHexString(), memberId.toHexString(), now);
  assert.deepEqual(revoked, { identityId: memberId.toHexString(), email: "person@example.com", role: "editor", displayName: "person@example.com" });
  assert.deepEqual(sessionQuery, { _id: sessionId, status: "active", ownerIdentityId: { $ne: memberId }, memberIdentityIds: memberId });
  assert.deepEqual(removeQuery, { _id: sessionId, status: "active", ownerIdentityId: { $ne: memberId }, memberIdentityIds: memberId });
});
