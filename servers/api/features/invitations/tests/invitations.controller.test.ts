import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import type { IdentityService } from "../../identity/public.js";
import { InvitationFailure } from "../invitations.contracts.js";
import { createInvitationController } from "../invitations.controller.js";
import type { InvitationService } from "../invitations.service.js";
import { ERROR_CODES, HTTP_STATUS } from "../../../constants/index.js";

const sessionId = "507f1f77bcf86cd799439011";
const identityId = "507f1f77bcf86cd799439012";
const sessionToken = "test-session-token-that-is-long-enough-to-be-valid";
const owner = Object.freeze({ id: identityId, email: "owner@example.com" });

type CapturedResponse = Readonly<{
  body: unknown;
  headers: Readonly<Record<string, string | number>>;
  response: Response;
  statusCode: number | undefined;
}>;

const makeResponse = (): CapturedResponse => {
  let statusCode: number | undefined;
  let body: unknown;
  const headers: Record<string, string | number> = {};
  const response = {
    status: (status: number) => { statusCode = status; return response; },
    json: (value: unknown) => { body = value; return response; },
    setHeader: (name: string, value: string | number) => { headers[name] = value; return response; },
    sendStatus: (status: number) => { statusCode = status; return response; }
  } as unknown as Response;
  return {
    get body() { return body; },
    headers,
    response,
    get statusCode() { return statusCode; }
  };
};

const makeRequest = (options: Readonly<{
  body?: unknown;
  params?: Readonly<Record<string, string>>;
  authenticated?: boolean;
}> = {}): Request => ({
  body: options.body ?? {},
  headers: options.authenticated === false ? {} : { authorization: `Bearer ${sessionToken}` },
  ip: "127.0.0.1",
  params: options.params ?? { sessionId }
} as unknown as Request);

const makeInvitationService = (
  overrides: Partial<InvitationService> = {}
): InvitationService => ({
  create: () => Promise.resolve({ invitationUrl: "http://localhost:3000/invite/accept#token=secret", delivered: true }),
  list: () => Promise.resolve([]),
  cancel: () => Promise.resolve(),
  listMembers: () => Promise.resolve([]),
  removeMember: () => Promise.resolve(),
  accept: () => Promise.resolve({ sessionId, role: "editor", sessionTitle: "Planning" }),
  hasMembership: () => Promise.resolve(false),
  ...overrides
});

const makeIdentityService = (
  lookup: IdentityService["getIdentityForSession"] = (token) => Promise.resolve(token ? owner : null)
): IdentityService => ({ getIdentityForSession: lookup } as unknown as IdentityService);

void test("creates an invitation for an authenticated owner and returns the private link", async () => {
  let received: readonly unknown[] = [];
  const invitations = makeInvitationService({
    create: (...args) => {
      received = args;
      return Promise.resolve({ invitationUrl: "http://localhost:3000/invite/accept#token=secret", delivered: true });
    }
  });
  const controller = createInvitationController({ identity: makeIdentityService(), invitations });
  const response = makeResponse();

  await controller.create(makeRequest({ body: { email: "person@example.com", role: "editor" } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.accepted);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(received, [sessionId, identityId, "person@example.com", "127.0.0.1", "editor"]);
  assert.deepEqual(response.body, {
    message: "Invitation email sent to person@example.com! Check inbox or spam folder.",
    invitationUrl: "http://localhost:3000/invite/accept#token=secret",
    delivered: true
  });
});

void test("rejects an invalid invitation request before authenticating", async () => {
  let identityLookups = 0;
  const identity = makeIdentityService(() => { identityLookups += 1; return Promise.resolve(owner); });
  const controller = createInvitationController({ identity, invitations: makeInvitationService() });
  const response = makeResponse();

  await controller.create(makeRequest({ body: { email: "bad-email", role: "owner" } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.badRequest);
  assert.equal(identityLookups, 0);
  assert.deepEqual(response.body, { error: { code: ERROR_CODES.validation, message: "Request validation failed." } });
});

void test("rejects a missing sign-in identity", async () => {
  const controller = createInvitationController({
    identity: makeIdentityService(() => Promise.resolve(null)),
    invitations: makeInvitationService()
  });
  const response = makeResponse();

  await controller.create(makeRequest({ body: { email: "person@example.com", role: "viewer" } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.unauthorized);
  assert.deepEqual(response.body, {
    error: { code: ERROR_CODES.authenticationRequired, message: "A valid Whiteboard sign-in is required." }
  });
});

void test("returns service unavailable when invitation dependencies are missing", async () => {
  const controller = createInvitationController({ identity: null, invitations: null });
  const response = makeResponse();

  await controller.create(makeRequest({ body: { email: "person@example.com", role: "viewer" } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.serviceUnavailable);
});

void test("maps invitation failures to their HTTP responses", async (context) => {
  const scenarios: readonly Readonly<{ code: ConstructorParameters<typeof InvitationFailure>[0]; status: number }>[] = [
    { code: "not_found", status: HTTP_STATUS.notFound },
    { code: "invalid_or_expired", status: HTTP_STATUS.badRequest },
    { code: "email_mismatch", status: 403 },
    { code: "already_member", status: HTTP_STATUS.conflict },
    { code: "session_full", status: HTTP_STATUS.conflict },
    { code: "rate_limited", status: HTTP_STATUS.tooManyRequests },
    { code: "storage_unavailable", status: HTTP_STATUS.serviceUnavailable },
    { code: "delivery_unavailable", status: HTTP_STATUS.serviceUnavailable }
  ];

  for (const scenario of scenarios) {
    await context.test(scenario.code, async () => {
      const controller = createInvitationController({
        identity: makeIdentityService(),
        invitations: makeInvitationService({ create: () => Promise.reject(new InvitationFailure(scenario.code)) })
      });
      const response = makeResponse();

      await controller.create(makeRequest({ body: { email: "person@example.com", role: "viewer" } }), response.response);

      assert.equal(response.statusCode, scenario.status);
      assert.ok(response.body && typeof response.body === "object" && "error" in response.body);
      if (scenario.code === "rate_limited") assert.equal(response.headers["Retry-After"], "900");
    });
  }
});

void test("maps unexpected invitation errors to service unavailable", async () => {
  const controller = createInvitationController({
    identity: makeIdentityService(),
    invitations: makeInvitationService({ create: () => Promise.reject(new Error("unexpected")) })
  });
  const response = makeResponse();

  await controller.create(makeRequest({ body: { email: "person@example.com", role: "viewer" } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.serviceUnavailable);
});

void test("lists invitations with ISO timestamps and disables caching", async () => {
  const createdAt = new Date("2026-01-02T03:04:05.000Z");
  const expiresAt = new Date("2026-01-02T03:14:05.000Z");
  const controller = createInvitationController({
    identity: makeIdentityService(),
    invitations: makeInvitationService({ list: () => Promise.resolve([{ id: "invite-1", email: "person@example.com", role: "editor", createdAt, expiresAt }]) })
  });
  const response = makeResponse();

  await controller.list(makeRequest(), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.ok);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(response.body, { invitations: [{ id: "invite-1", email: "person@example.com", role: "editor", createdAt: createdAt.toISOString(), expiresAt: expiresAt.toISOString() }] });
});

void test("returns not found for malformed session and invitation IDs", async (context) => {
  const controller = createInvitationController({ identity: makeIdentityService(), invitations: makeInvitationService() });
  const cases: readonly Readonly<{ name: string; action: "list" | "cancel"; params: Readonly<Record<string, string>> }>[] = [
    { name: "list session", action: "list", params: { sessionId: "invalid" } },
    { name: "cancel session", action: "cancel", params: { sessionId: "invalid", invitationId: sessionId } },
    { name: "cancel invitation", action: "cancel", params: { sessionId, invitationId: "invalid" } }
  ];
  for (const item of cases) {
    await context.test(item.name, async () => {
      const response = makeResponse();
      await controller[item.action](makeRequest({ params: item.params }), response.response);
      assert.equal(response.statusCode, HTTP_STATUS.notFound);
    });
  }
});

void test("cancels an invitation for the authenticated owner", async () => {
  let received: readonly unknown[] = [];
  const controller = createInvitationController({
    identity: makeIdentityService(),
    invitations: makeInvitationService({ cancel: (...args) => { received = args; return Promise.resolve(); } })
  });
  const response = makeResponse();

  await controller.cancel(makeRequest({ params: { sessionId, invitationId: "507f1f77bcf86cd799439013" } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.noContent);
  assert.deepEqual(received, [sessionId, identityId, "507f1f77bcf86cd799439013"]);
});

void test("lists members without exposing private fields", async () => {
  const controller = createInvitationController({
    identity: makeIdentityService(),
    invitations: makeInvitationService({ listMembers: () => Promise.resolve([{ identityId, email: owner.email, role: "editor", displayName: "Owner", connected: true }]) })
  });
  const response = makeResponse();

  await controller.listMembers(makeRequest(), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.ok);
  assert.equal(response.headers["Cache-Control"], "no-store");
  assert.deepEqual(response.body, { members: [{ identityId, email: owner.email, role: "editor", displayName: "Owner", connected: true }] });
});

void test("removes a member for the authenticated owner", async () => {
  let received: readonly unknown[] = [];
  const memberId = "507f1f77bcf86cd799439014";
  const controller = createInvitationController({
    identity: makeIdentityService(),
    invitations: makeInvitationService({ removeMember: (...args) => { received = args; return Promise.resolve(); } })
  });
  const response = makeResponse();

  await controller.removeMember(makeRequest({ params: { sessionId, identityId: memberId } }), response.response);

  assert.equal(response.statusCode, HTTP_STATUS.noContent);
  assert.deepEqual(received, [sessionId, identityId, memberId]);
});

void test("reports invalid accept fields and accepts a valid invitation", async (context) => {
  const invalidController = createInvitationController({ identity: makeIdentityService(), invitations: makeInvitationService() });
  const invalidResponse = makeResponse();
  await invalidController.accept(makeRequest({ body: { token: "short", extra: true } }), invalidResponse.response);
  assert.equal(invalidResponse.statusCode, HTTP_STATUS.badRequest);
  assert.deepEqual(invalidResponse.body, { error: { code: ERROR_CODES.validation, message: "Invitation request has invalid fields: token, displayName." } });

  await context.test("valid token", async () => {
    let received: readonly unknown[] = [];
    const controller = createInvitationController({
      identity: makeIdentityService(),
      invitations: makeInvitationService({ accept: (...args) => { received = args; return Promise.resolve({ sessionId, role: "editor", sessionTitle: "Planning" }); } })
    });
    const response = makeResponse();
    const token = "x".repeat(48);

    await controller.accept(makeRequest({ body: { token, displayName: "Sam" } }), response.response);

    assert.equal(response.statusCode, HTTP_STATUS.ok);
    assert.equal(response.headers["Cache-Control"], "no-store");
    assert.deepEqual(received, [token, owner, "Sam", "127.0.0.1"]);
    assert.deepEqual(response.body, { membership: { sessionId, role: "editor", sessionTitle: "Planning" } });
  });
});
