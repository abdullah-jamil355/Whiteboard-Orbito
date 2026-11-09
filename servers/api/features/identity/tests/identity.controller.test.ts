import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createIdentityController, readIdentitySessionToken } from "../identity.controller.js";
import { IdentityServiceFailure } from "../identity.contracts.js";
import type { IdentityService } from "../identity.service.js";
import { createDevMailbox } from "../identity.dev-mailbox.js";

const token = "s".repeat(43);
const identity = { id: "identity-1", email: "owner@example.com", name: "Owner", createdAt: new Date("2026-01-01T00:00:00Z"), verifiedAt: new Date("2026-01-01T00:00:00Z") };
const sessionResult = { identity, identityId: identity.id, sessionToken: token, expiresAt: new Date("2026-02-01T00:00:00Z") };

type Reply = {
  statusCode: number;
  body: unknown;
  headers: Map<string, string>;
  redirectUrl?: string;
};

const response = (): { reply: Reply; target: Response } => {
  const reply: Reply = { statusCode: 200, body: undefined, headers: new Map() };
  const target = {
    status(code: number) { reply.statusCode = code; return this; },
    json(body: unknown) { reply.body = body; return this; },
    setHeader(name: string, value: string) { reply.headers.set(name.toLowerCase(), value); return this; },
    sendStatus(code: number) { reply.statusCode = code; return this; },
    redirect(url: string) { reply.redirectUrl = url; reply.statusCode = 302; return this; }
  } as unknown as Response;
  return { reply, target };
};

const request = (body?: unknown, headers: Record<string, string> = {}, extra: Record<string, unknown> = {}): Request => ({
  body, headers, ip: "127.0.0.1", query: {}, ...extra
} as unknown as Request);

const controller = (overrides: Partial<IdentityService> = {}, environment = "development") => {
  const service = {
    requestMagicLink: () => Promise.resolve(),
    consumeMagicLink: () => Promise.resolve({ identityId: identity.id, sessionToken: token, expiresAt: sessionResult.expiresAt }),
    registerWithPassword: () => Promise.resolve(sessionResult),
    loginWithPassword: () => Promise.resolve(sessionResult),
    getIdentityForSession: () => Promise.resolve(identity),
    revokeSession: () => Promise.resolve(),
    startGoogleMailConnect: () => Promise.resolve("https://accounts.google.com/oauth"),
    finishGoogleMailConnect: () => Promise.resolve(),
    getGoogleMailStatus: () => Promise.resolve({ configured: true, connected: false }),
    disconnectGoogleMail: () => Promise.resolve(),
    ...overrides
  } as unknown as IdentityService;
  return createIdentityController({ service, mailbox: createDevMailbox(), config: { webOrigin: "http://localhost:3000/path", environment } });
};

void test("session token reader prefers a valid bearer and falls back to cookie", () => {
  assert.equal(readIdentitySessionToken(request(undefined, { authorization: `Bearer ${token}`, cookie: `wb_session=${token}` })), token);
  assert.equal(readIdentitySessionToken(request(undefined, { authorization: "Bearer short", cookie: `other=x; wb_session=${token}` })), token);
  assert.equal(readIdentitySessionToken(request(undefined, { cookie: "wb_session=bad%ZZ" })), undefined);
  assert.equal(readIdentitySessionToken(request(undefined, { cookie: "wb_session=" })), undefined);
  assert.equal(readIdentitySessionToken(request()), undefined);
});

void test("magic-link request validates input, passes IP and returns a private accepted response", async () => {
  let received: unknown;
  const api = controller({ requestMagicLink: (input) => { received = input; return Promise.resolve(); } });
  const invalid = response();
  await api.requestMagicLink(request({ email: "bad" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  const ok = response();
  await api.requestMagicLink(request({ email: "owner@example.com" }), ok.target);
  assert.deepEqual(received, { email: "owner@example.com", ipAddress: "127.0.0.1" });
  assert.equal(ok.reply.statusCode, 202);
  assert.equal(ok.reply.headers.get("cache-control"), "no-store");
});

void test("magic-link request reports unavailable service and mapped throttling failures", async () => {
  const unavailable = createIdentityController({ service: null, mailbox: createDevMailbox(), config: { webOrigin: "http://localhost", environment: "test" } });
  const noService = response();
  await unavailable.requestMagicLink(request({ email: "owner@example.com" }), noService.target);
  assert.equal(noService.reply.statusCode, 503);
  const throttled = controller({ requestMagicLink: () => Promise.reject(new IdentityServiceFailure("rate_limited", 37)) });
  const limited = response();
  await throttled.requestMagicLink(request({ email: "owner@example.com" }), limited.target);
  assert.equal(limited.reply.statusCode, 429);
  assert.equal(limited.reply.headers.get("retry-after"), "37");
});

void test("magic-link consumption validates token and sets development session cookie", async () => {
  const api = controller();
  const invalid = response();
  await api.consumeMagicLink(request({ token: "short" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  const ok = response();
  await api.consumeMagicLink(request({ token }), ok.target);
  assert.equal(ok.reply.statusCode, 200);
  assert.match(ok.reply.headers.get("set-cookie") ?? "", /HttpOnly; SameSite=Lax/);
  assert.equal(ok.reply.headers.get("cache-control"), "no-store");
  assert.deepEqual(ok.reply.body, { identityId: identity.id, expiresAt: sessionResult.expiresAt.toISOString() });
});

void test("magic-link consumption maps expired links and emits secure production cookie", async () => {
  const failed = controller({ consumeMagicLink: () => Promise.reject(new IdentityServiceFailure("invalid_or_expired_link")) });
  const bad = response();
  await failed.consumeMagicLink(request({ token }), bad.target);
  assert.equal(bad.reply.statusCode, 400);
  const api = controller({}, "production");
  const secure = response();
  await api.consumeMagicLink(request({ token }), secure.target);
  assert.match(secure.reply.headers.get("set-cookie") ?? "", /SameSite=None; Max-Age=.*Secure; Partitioned/);
});

void test("registration validates strict fields, sets cookie and maps existing accounts", async () => {
  const api = controller();
  const invalid = response();
  await api.registerWithPassword(request({ email: "bad", name: "", password: "123" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  const ok = response();
  await api.registerWithPassword(request({ email: "owner@example.com", name: "Owner", password: "secret1" }), ok.target);
  assert.equal(ok.reply.statusCode, 200);
  assert.equal(ok.reply.headers.get("cache-control"), "no-store");
  assert.match(ok.reply.headers.get("set-cookie") ?? "", /wb_session=/);
  const duplicate = controller({ registerWithPassword: () => Promise.reject(new IdentityServiceFailure("email_already_registered")) });
  const conflict = response();
  await duplicate.registerWithPassword(request({ email: "owner@example.com", name: "Owner", password: "secret1" }), conflict.target);
  assert.equal(conflict.reply.statusCode, 409);
});

void test("login validates input and maps invalid credentials and missing password", async () => {
  const api = controller();
  const invalid = response();
  await api.loginWithPassword(request({ email: "bad", password: "" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  for (const [code, status] of [["invalid_credentials", 401], ["password_not_set", 400]] as const) {
    const failing = controller({ loginWithPassword: () => Promise.reject(new IdentityServiceFailure(code)) });
    const reply = response();
    await failing.loginWithPassword(request({ email: "owner@example.com", password: "x" }), reply.target);
    assert.equal(reply.reply.statusCode, status);
  }
});

void test("current identity returns null without a session and identity for a valid session", async () => {
  const api = controller();
  const anonymous = response();
  await api.getCurrentIdentity(request(), anonymous.target);
  assert.deepEqual(anonymous.reply.body, { identity: null, sessionToken: null });
  const signedIn = response();
  await api.getCurrentIdentity(request(undefined, { authorization: `Bearer ${token}` }), signedIn.target);
  assert.deepEqual(signedIn.reply.body, { identity, sessionToken: token });
  assert.equal(signedIn.reply.headers.get("cache-control"), "no-store");
  const unavailable = createIdentityController({ service: null, mailbox: createDevMailbox(), config: { webOrigin: "http://localhost", environment: "test" } });
  const noBackend = response();
  await unavailable.getCurrentIdentity(request(), noBackend.target);
  assert.deepEqual(noBackend.reply.body, { identity: null, sessionToken: null });
});

void test("revoke session clears cookie and production attributes", async () => {
  let revoked: string | undefined;
  const api = controller({ revokeSession: (value) => { revoked = value; return Promise.resolve(); } }, "production");
  const reply = response();
  await api.revokeCurrentSession(request(undefined, { authorization: `Bearer ${token}` }), reply.target);
  assert.equal(revoked, token);
  assert.equal(reply.reply.statusCode, 204);
  assert.match(reply.reply.headers.get("set-cookie") ?? "", /Max-Age=0; Secure; Partitioned/);
});

void test("Google mail connect requires identity and returns authorization URL", async () => {
  const anonymousApi = controller({ getIdentityForSession: () => Promise.resolve(null) });
  const anonymous = response();
  await anonymousApi.startGoogleMailConnect(request(), anonymous.target);
  assert.equal(anonymous.reply.statusCode, 401);
  let calledWith: unknown;
  const api = controller({ startGoogleMailConnect: (...args) => { calledWith = args; return Promise.resolve("https://accounts.google.com/oauth"); } });
  const ok = response();
  await api.startGoogleMailConnect(request(undefined, { authorization: `Bearer ${token}` }), ok.target);
  assert.deepEqual(calledWith, [identity.id, identity.email]);
  assert.deepEqual(ok.reply.body, { authorizationUrl: "https://accounts.google.com/oauth" });
});

void test("Google OAuth callback redirects for success, invalid state and account mismatch", async () => {
  const goodQuery = { state: "t".repeat(32), code: "oauth-code" };
  const ok = response();
  await controller().finishGoogleMailConnect(request(undefined, { authorization: `Bearer ${token}` }, { query: goodQuery }), ok.target);
  assert.equal(new URL(ok.reply.redirectUrl ?? "").searchParams.get("google-mail"), "connected");
  const invalid = response();
  await controller().finishGoogleMailConnect(request(), invalid.target);
  assert.equal(new URL(invalid.reply.redirectUrl ?? "").searchParams.get("google-mail"), "failed");
  const mismatch = response();
  const api = controller({ finishGoogleMailConnect: () => Promise.reject(new IdentityServiceFailure("google_account_mismatch")) });
  await api.finishGoogleMailConnect(request(undefined, { authorization: `Bearer ${token}` }, { query: goodQuery }), mismatch.target);
  assert.equal(new URL(mismatch.reply.redirectUrl ?? "").searchParams.get("google-mail"), "account-mismatch");
  assert.equal(mismatch.reply.headers.get("cache-control"), "no-store");
});

void test("Google mail status and disconnect enforce sign-in and expose service results", async () => {
  const anonymous = controller({ getIdentityForSession: () => Promise.resolve(null) });
  const denied = response();
  await anonymous.getGoogleMailStatus(request(), denied.target);
  assert.equal(denied.reply.statusCode, 401);
  const api = controller();
  const status = response();
  await api.getGoogleMailStatus(request(undefined, { authorization: `Bearer ${token}` }), status.target);
  assert.deepEqual(status.reply.body, { configured: true, connected: false });
  const disconnected = response();
  await api.disconnectGoogleMail(request(undefined, { authorization: `Bearer ${token}` }), disconnected.target);
  assert.equal(disconnected.reply.statusCode, 204);
});

void test("dev mailbox validates requests and reads normalized email messages", () => {
  const mailbox = createDevMailbox();
  const api = createIdentityController({ service: null, mailbox, config: { webOrigin: "http://localhost", environment: "test" } });
  const invalid = response();
  api.readDevMailbox(request({ email: "bad" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  const ok = response();
  api.readDevMailbox(request({ email: "Owner@Example.com" }), ok.target);
  assert.equal(ok.reply.statusCode, 200);
  assert.deepEqual(ok.reply.body, { messages: [] });
  assert.equal(ok.reply.headers.get("cache-control"), "no-store");
});
