import test from "node:test";
import assert from "node:assert/strict";
import { createIdentityService } from "../identity.service.js";
import { IdentityServiceFailure } from "../identity.contracts.js";
import { hashOpaqueSecret } from "../identity.rules.js";
import type {
  Identity,
  IdentityRepository,
  MagicLinkChallenge,
  ServerSession
} from "../identity.contracts.js";

const createFakeRepository = () => {
  let challenge: MagicLinkChallenge | null = null;
  let session: ServerSession | null = null;
  let identity: Identity | null = null;
  let emailRateAllowed = true;
  const repository: IdentityRepository = {
    reserveRateLimitCounter: () => Promise.resolve(true),
    reserveApiRequestRateLimit: () => Promise.resolve(true),
    reserveMagicLinkRateLimit: () => Promise.resolve(emailRateAllowed),
    createMagicLink: (input) => {
      challenge = { ...input, id: "challenge-1", consumedAt: null };
      return Promise.resolve();
    },
    consumeMagicLink: (tokenHash, now) => {
      if (!challenge || challenge.tokenHash !== tokenHash || challenge.consumedAt !== null || challenge.expiresAt <= now) return Promise.resolve(null);
      const previous = challenge;
      challenge = { ...challenge, consumedAt: now };
      return Promise.resolve(previous);
    },
    findOrCreateIdentity: (email, now) => {
      identity ??= { id: "identity-1", email, createdAt: now, verifiedAt: now };
      return Promise.resolve(identity);
    },
    findIdentityByEmail: (email) => {
      if (identity && identity.email === email) {
        return Promise.resolve({
          ...identity,
          passwordHash: (identity as Identity & { passwordHash?: string; passwordSalt?: string }).passwordHash,
          passwordSalt: (identity as Identity & { passwordHash?: string; passwordSalt?: string }).passwordSalt
        });
      }
      return Promise.resolve(null);
    },
    createPasswordIdentity: ({ email, name, passwordHash, passwordSalt, now }) => {
      identity = Object.assign({ id: "identity-1", email, name, createdAt: now, verifiedAt: now }, { passwordHash, passwordSalt });
      return Promise.resolve(identity);
    },
    getIdentityById: (identityId) => Promise.resolve(identity?.id === identityId ? identity : null),
    createSession: (input) => {
      session = { ...input, id: "session-1", revokedAt: null };
      return Promise.resolve();
    },
    findSession: (tokenHash, now) => Promise.resolve(session?.tokenHash === tokenHash
      && session.revokedAt === null && session.expiresAt > now ? session : null),
    revokeSession: (tokenHash, now) => {
      if (session?.tokenHash === tokenHash) session = { ...session, revokedAt: now };
      return Promise.resolve();
    },
    createGoogleMailState: () => Promise.resolve(),
    consumeGoogleMailState: () => Promise.resolve(false),
    saveGoogleMailAccount: () => Promise.resolve(),
    getGoogleMailAccount: () => Promise.resolve(null),
    removeGoogleMailAccount: () => Promise.resolve()
  };
  return {
    repository,
    getChallenge: () => challenge,
    getSession: () => session,
    setEmailRateAllowed: (allowed: boolean) => { emailRateAllowed = allowed; }
  };
};

void test("sends an email-normalized magic link and stores only its hash", async () => {
  const fake = createFakeRepository();
  const messages: string[] = [];
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: ({ verificationUrl }) => { messages.push(verificationUrl); return Promise.resolve(); } },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key",
    generateSecret: () => "m".repeat(43)
  });

  await service.requestMagicLink({ email: " Owner@Example.COM ", ipAddress: "127.0.0.1" });

  assert.equal(fake.getChallenge()?.email, "owner@example.com");
  assert.equal(fake.getChallenge()?.tokenHash, hashOpaqueSecret("m".repeat(43)));
  assert.equal(messages.length, 1);
  assert.equal(new URL(messages[0] ?? "").hash, `#token=${"m".repeat(43)}`);
});

void test("consumes a magic link once and issues a hashed seven-day server session", async () => {
  const fake = createFakeRepository();
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => Promise.resolve() },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key",
    generateSecret: (() => {
      const secrets = ["m".repeat(43), "s".repeat(43)];
      return () => secrets.shift() ?? "x".repeat(43);
    })()
  });

  await service.requestMagicLink({ email: "owner@example.com", ipAddress: "127.0.0.1" });
  const result = await service.consumeMagicLink("m".repeat(43));
  assert.equal(result.sessionToken, "s".repeat(43));
  assert.equal(fake.getSession()?.tokenHash, hashOpaqueSecret("s".repeat(43)));
  assert.equal(result.expiresAt.getTime() - Date.now() > 6 * 24 * 60 * 60 * 1000, true);
  await assert.rejects(service.consumeMagicLink("m".repeat(43)), (error: unknown) =>
    error instanceof IdentityServiceFailure && error.code === "invalid_or_expired_link"
  );
});

void test("rejects sign-in issuance after the per-email/IP rate limit", async () => {
  const fake = createFakeRepository();
  fake.setEmailRateAllowed(false);
  let sent = false;
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => { sent = true; return Promise.resolve(); } },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key"
  });

  await assert.rejects(
    service.requestMagicLink({ email: "owner@example.com", ipAddress: "127.0.0.1" }),
    (error: unknown) => error instanceof IdentityServiceFailure
      && error.code === "rate_limited"
      && (error.retryAfterSeconds ?? 0) > 0
  );
  assert.equal(sent, false);
});

void test("invitation creation and acceptance use the shared persistent rate limiter", async () => {
  const fake = createFakeRepository();
  fake.setEmailRateAllowed(false);
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => Promise.resolve() },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key"
  });
  assert.equal(await service.reserveInvitationRateLimit({ identityId: "owner-id", ipAddress: "127.0.0.1" }), false);
});

void test("authenticated sessions can be looked up and revoked", async () => {
  const fake = createFakeRepository();
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => Promise.resolve() },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key",
    generateSecret: (() => {
      const secrets = ["m".repeat(43), "s".repeat(43)];
      return () => secrets.shift() ?? "x".repeat(43);
    })()
  });

  await service.requestMagicLink({ email: "owner@example.com", ipAddress: "127.0.0.1" });
  await service.consumeMagicLink("m".repeat(43));
  assert.deepEqual(await service.getIdentityForSession("s".repeat(43)), {
    id: "identity-1",
    email: "owner@example.com"
  });
  await service.revokeSession("s".repeat(43));
  assert.equal(await service.getIdentityForSession("s".repeat(43)), null);
});

void test("registers a new user with password and logs in successfully", async () => {
  const fake = createFakeRepository();
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => Promise.resolve() },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key",
    generateSecret: () => "s".repeat(43)
  });

  const registered = await service.registerWithPassword({
    email: "user@example.com",
    name: "Test User",
    password: "Password123!"
  });
  assert.equal(registered.identity.email, "user@example.com");
  assert.equal(registered.identity.name, "Test User");

  const loggedIn = await service.loginWithPassword({
    email: "user@example.com",
    password: "Password123!"
  });
  assert.equal(loggedIn.identity.id, registered.identity.id);
  assert.equal(loggedIn.identity.email, "user@example.com");
  assert.equal(loggedIn.identity.name, "Test User");
});

void test("rejects registration when email is already registered", async () => {
  const fake = createFakeRepository();
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => Promise.resolve() },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key"
  });

  await service.registerWithPassword({ email: "user@example.com", name: "User", password: "Password123!" });
  await assert.rejects(
    () => service.registerWithPassword({ email: "user@example.com", name: "User Two", password: "Password123!" }),
    /email_already_registered/
  );
});

void test("rejects login with invalid password", async () => {
  const fake = createFakeRepository();
  const service = createIdentityService({
    repository: fake.repository,
    mailer: { sendMagicLink: () => Promise.resolve() },
    webOrigin: "http://localhost:3100",
    rateLimitKey: "development-test-key"
  });

  await service.registerWithPassword({ email: "user@example.com", name: "User", password: "Password123!" });
  await assert.rejects(
    () => service.loginWithPassword({ email: "user@example.com", password: "WrongPassword" }),
    /invalid_credentials/
  );
});
