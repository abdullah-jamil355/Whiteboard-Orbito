import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { mongoose } from "../../../integrations/mongodb/index.js";
import { createIdentityRepository, ensureIdentityIndexes } from "../identity.repository.js";
import { WbGoogleMailAccountModel, WbGoogleMailStateModel, WbIdentityModel, WbMagicLinkModel, WbMagicLinkRateLimitModel, WbSessionModel } from "../identity.model.js";

const id = new mongoose.Types.ObjectId();
const now = new Date("2026-01-01T00:00:00Z");
const userRecord = { _id: id, email: "owner@example.com", name: "Owner", createdAt: now, verifiedAt: now };
const exec = <T>(value: T) => ({ exec: () => Promise.resolve(value) });
const mock = (context: TestContext, model: object, method: string, implementation: (...args: never[]) => unknown): void => {
  context.mock.method(model as Record<string, (...args: never[]) => unknown>, method, implementation as never);
};

void test("creates identities and resolves duplicate insertion races by reading the existing identity", async (context) => {
  let query: unknown;
  mock(context, WbIdentityModel, "findOneAndUpdate", ((filter: unknown) => { query = filter; return exec(userRecord); }));
  const repository = createIdentityRepository();
  assert.deepEqual(await repository.findOrCreateIdentity("owner@example.com", now), {
    id: id.toHexString(), email: userRecord.email, name: "Owner", createdAt: now, verifiedAt: now
  });
  assert.deepEqual(query, { email: "owner@example.com" });

  mock(context, WbIdentityModel, "findOneAndUpdate", (() => exec(Promise.reject(Object.assign(new Error("duplicate"), { code: 11_000 })))));
  mock(context, WbIdentityModel, "findOne", (() => exec(userRecord)));
  assert.equal((await repository.findOrCreateIdentity(userRecord.email, now)).id, id.toHexString());
});

void test("propagates non-duplicate identity insertion errors", async (context) => {
  const failure = new Error("database unavailable");
  mock(context, WbIdentityModel, "findOneAndUpdate", (() => ({ exec: () => Promise.reject(failure) })));
  await assert.rejects(createIdentityRepository().findOrCreateIdentity(userRecord.email, now), (error: unknown) => error === failure);
});

void test("reserves rate-limit counters and retries a duplicate-key race", async (context) => {
  let attempt = 0;
  const queries: unknown[] = [];
  mock(context, WbMagicLinkRateLimitModel, "findOneAndUpdate", ((filter: unknown) => {
    queries.push(filter);
    attempt += 1;
    return attempt === 1
      ? { exec: () => Promise.reject(Object.assign(new Error("duplicate"), { code: 11_000 })) }
      : exec({ count: 2 });
  }));
  assert.equal(await createIdentityRepository().reserveRateLimitCounter({ keyHash: "key", windowStart: now, expiresAt: new Date(now.getTime() + 60_000), limit: 3 }), true);
  assert.equal(queries.length, 2);

  mock(context, WbMagicLinkRateLimitModel, "findOneAndUpdate", (() => exec(null)));
  assert.equal(await createIdentityRepository().reserveRateLimitCounter({ keyHash: "key", windowStart: now, expiresAt: new Date(now.getTime() + 60_000), limit: 3 }), true);
});

void test("denies a rate-limit reservation when a duplicate-key retry finds the counter already full", async (context) => {
  let attempts = 0;
  mock(context, WbMagicLinkRateLimitModel, "findOneAndUpdate", (() => {
    attempts += 1;
    return attempts === 1
      ? { exec: () => Promise.reject(Object.assign(new Error("duplicate"), { code: 11_000 })) }
      : exec(null);
  }));
  assert.equal(await createIdentityRepository().reserveRateLimitCounter({ keyHash: "full", windowStart: now, expiresAt: now, limit: 1 }), false);
});

void test("reserves both API counters and releases the subject reservation if the IP limit is reached", async (context) => {
  let counter = 0;
  const updates: unknown[] = [];
  mock(context, WbMagicLinkRateLimitModel, "findOneAndUpdate", (() => {
    counter += 1;
    if (counter === 1) return exec({ count: 1 });
    if (counter === 2) return { exec: () => Promise.reject(Object.assign(new Error("duplicate"), { code: 11_000 })) };
    return exec(null);
  }));
  mock(context, WbMagicLinkRateLimitModel, "updateOne", ((filter: unknown) => { updates.push(filter); return exec({ modifiedCount: 1 }); }));
  const allowed = await createIdentityRepository().reserveApiRequestRateLimit({ subjectKeyHash: "subject", ipKeyHash: "ip", windowStart: now, expiresAt: now, subjectLimit: 5, ipLimit: 10 });
  assert.equal(allowed, false);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0], { keyHash: "subject", windowStart: now, count: { $gt: 0 } });
});

void test("creates and consumes one-time magic links with their persistence expiry", async (context) => {
  let created: unknown;
  mock(context, WbMagicLinkModel, "create", ((record: unknown) => { created = record; return Promise.resolve(record); }));
  mock(context, WbMagicLinkModel, "findOneAndUpdate", (() => exec({ _id: id, email: userRecord.email, tokenHash: "hash", createdAt: now, expiresAt: now, consumedAt: null })));
  const repository = createIdentityRepository();
  await repository.createMagicLink({ email: userRecord.email, tokenHash: "hash", createdAt: now, expiresAt: now });
  assert.equal((created as { consumedAt: unknown }).consumedAt, null);
  assert.ok((created as { deleteAt: Date }).deleteAt > now);
  assert.deepEqual(await repository.consumeMagicLink("hash", now), { id: id.toHexString(), email: userRecord.email, tokenHash: "hash", createdAt: now, expiresAt: now, consumedAt: null });
  mock(context, WbMagicLinkModel, "findOneAndUpdate", (() => exec(null)));
  assert.equal(await repository.consumeMagicLink("missing", now), null);
});

void test("looks up identities and sets passwords only for valid existing IDs", async (context) => {
  mock(context, WbIdentityModel, "findOne", (() => exec(userRecord)));
  assert.equal((await createIdentityRepository().findIdentityByEmail(userRecord.email))?.id, id.toHexString());
  mock(context, WbIdentityModel, "findOne", (() => exec(null)));
  assert.equal(await createIdentityRepository().findIdentityByEmail("missing@example.com"), null);
  mock(context, WbIdentityModel, "findOneAndUpdate", (() => exec(userRecord)));
  assert.equal((await createIdentityRepository().setPasswordForIdentity({ identityId: id.toHexString(), name: "Owner", passwordHash: "hash", passwordSalt: "salt" })).email, userRecord.email);
  await assert.rejects(createIdentityRepository().setPasswordForIdentity({ identityId: "bad-id", name: "Owner", passwordHash: "hash", passwordSalt: "salt" }), /Invalid identity ID/);
  mock(context, WbIdentityModel, "findOneAndUpdate", (() => exec(null)));
  await assert.rejects(createIdentityRepository().setPasswordForIdentity({ identityId: id.toHexString(), name: "Owner", passwordHash: "hash", passwordSalt: "salt" }), /Identity not found/);
});

void test("reads verified identities by ID and creates or reads server sessions", async (context) => {
  let identityFilter: unknown;
  mock(context, WbIdentityModel, "findOne", ((filter: unknown) => { identityFilter = filter; return exec(userRecord); }));
  const repository = createIdentityRepository();
  assert.equal((await repository.getIdentityById(id.toHexString()))?.id, id.toHexString());
  assert.deepEqual(identityFilter, { _id: id, verifiedAt: { $type: "date" } });
  assert.equal(await repository.getIdentityById("bad"), null);
  let createdSession: unknown;
  mock(context, WbSessionModel, "create", ((record: unknown) => { createdSession = record; return Promise.resolve(record); }));
  await repository.createSession({ identityId: id.toHexString(), tokenHash: "session-hash", createdAt: now, expiresAt: new Date(now.getTime() + 60_000) });
  assert.equal((createdSession as { identityId: mongoose.Types.ObjectId }).identityId.toHexString(), id.toHexString());
  await assert.rejects(repository.createSession({ identityId: "bad", tokenHash: "hash", createdAt: now, expiresAt: now }), /Invalid identity ID/);
  let sessionFilter: unknown;
  mock(context, WbSessionModel, "findOne", ((filter: unknown) => { sessionFilter = filter; return exec({ _id: id, identityId: id, tokenHash: "session-hash", createdAt: now, expiresAt: now, revokedAt: null }); }));
  assert.equal((await repository.findSession("session-hash", now))?.identityId, id.toHexString());
  assert.deepEqual(sessionFilter, { tokenHash: "session-hash", revokedAt: null, expiresAt: { $gt: now } });
  mock(context, WbSessionModel, "findOne", (() => exec(null)));
  assert.equal(await repository.findSession("missing", now), null);
  mock(context, WbSessionModel, "updateOne", (() => exec({ modifiedCount: 1 })));
  await repository.revokeSession("session-hash", now);
});

void test("persists Google OAuth states and encrypted Gmail account lifecycle", async (context) => {
  const repository = createIdentityRepository();
  let stateFilter: unknown;
  mock(context, WbGoogleMailStateModel, "create", ((record: unknown) => Promise.resolve(record)));
  await repository.createGoogleMailState({ stateHash: "state-hash", identityId: id.toHexString(), expiresAt: now });
  mock(context, WbGoogleMailStateModel, "findOneAndUpdate", ((filter: unknown) => { stateFilter = filter; return exec({}); }));
  assert.equal(await repository.consumeGoogleMailState("state-hash", id.toHexString(), now), true);
  assert.deepEqual(stateFilter, { stateHash: "state-hash", identityId: id.toHexString(), consumedAt: null, expiresAt: { $gt: now } });
  mock(context, WbGoogleMailStateModel, "findOneAndUpdate", (() => exec(null)));
  assert.equal(await repository.consumeGoogleMailState("missing", id.toHexString(), now), false);
  let accountUpdate: unknown[] = [];
  mock(context, WbGoogleMailAccountModel, "updateOne", ((...args: unknown[]) => { accountUpdate = args; return exec({ modifiedCount: 1 }); }));
  await repository.saveGoogleMailAccount(id.toHexString(), userRecord.email, "encrypted", now);
  assert.equal((accountUpdate[2] as { upsert: boolean }).upsert, true);
  mock(context, WbGoogleMailAccountModel, "findOne", (() => exec({ email: userRecord.email, encryptedRefreshToken: "encrypted" })));
  assert.deepEqual(await repository.getGoogleMailAccount(id.toHexString()), { email: userRecord.email, encryptedRefreshToken: "encrypted" });
  mock(context, WbGoogleMailAccountModel, "findOne", (() => exec(null)));
  assert.equal(await repository.getGoogleMailAccount(id.toHexString()), null);
  mock(context, WbGoogleMailAccountModel, "deleteOne", (() => exec({ deletedCount: 1 })));
  await repository.removeGoogleMailAccount(id.toHexString());
});

void test("creates new password identities and ensures every identity index", async (context) => {
  mock(context, WbIdentityModel, "create", (() => Promise.resolve(userRecord)));
  assert.equal((await createIdentityRepository().createPasswordIdentity({ email: userRecord.email, name: "Owner", passwordHash: "hash", passwordSalt: "salt", now })).id, id.toHexString());
  const models = [WbIdentityModel, WbMagicLinkModel, WbMagicLinkRateLimitModel, WbSessionModel, WbGoogleMailStateModel, WbGoogleMailAccountModel];
  const indexed: string[] = [];
  for (const [index, model] of models.entries()) mock(context, model, "createIndexes", (() => { indexed.push(String(index)); return Promise.resolve([]); }));
  await ensureIdentityIndexes();
  assert.equal(indexed.length, models.length);
});
