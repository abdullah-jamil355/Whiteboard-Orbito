import test from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";
import { createSessionController } from "../sessions.controller.js";
import { SessionFailure } from "../sessions.contracts.js";
import type { BoardSession } from "../sessions.contracts.js";
import type { SessionService } from "../sessions.service.js";
import type { IdentityService } from "../../identity/public.js";

const validId = "507f1f77bcf86cd799439011";
const authToken = "s".repeat(43);
const board = { id: "board-1", title: "Board", templateId: "blank", canvas: { gridStyle: "graph-paper" as const, gridSpacing: 20 }, objects: [] };
const session: BoardSession = { id: validId, ownerIdentityId: "owner-1", title: "Team board", status: "active", board, sequence: 3, createdAt: new Date("2026-01-01T00:00:00Z"), updatedAt: new Date("2026-01-02T00:00:00Z"), endedAt: null };

type Reply = { statusCode: number; body: unknown; headers: Map<string, string> };
const response = (): { reply: Reply; target: Response } => {
  const reply: Reply = { statusCode: 200, body: undefined, headers: new Map() };
  const target = {
    status(code: number) { reply.statusCode = code; return this; },
    json(body: unknown) { reply.body = body; return this; },
    setHeader(name: string, value: string) { reply.headers.set(name.toLowerCase(), value); return this; }
  } as unknown as Response;
  return { reply, target };
};
const request = (body?: unknown, params: Record<string, string> = {}, headers: Record<string, string> = {}): Request => ({ body, params, headers } as unknown as Request);

const createController = (sessionMethods: Partial<SessionService> = {}, signedIn = true) => {
  const identity = { getIdentityForSession: () => Promise.resolve(signedIn ? { id: "owner-1", email: "owner@example.com" } : null) } as unknown as IdentityService;
  const sessions = {
    create: () => Promise.resolve(session), get: () => Promise.resolve(session),
    listMine: () => Promise.resolve([{ id: validId, title: session.title, sequence: session.sequence, updatedAt: session.updatedAt }]),
    rename: () => Promise.resolve(session), end: () => Promise.resolve(session), ...sessionMethods
  } as unknown as SessionService;
  return createSessionController({ identity, sessions });
};

void test("create validates the board request before authentication and creates a private session", async () => {
  const api = createController();
  const invalid = response();
  await api.create(request({ title: "" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  const ok = response();
  await api.create(request({ title: "Team board", board }, {}, { cookie: `wb_session=${authToken}` }), ok.target);
  assert.equal(ok.reply.statusCode, 201);
  assert.equal(ok.reply.headers.get("cache-control"), "no-store");
  assert.deepEqual((ok.reply.body as { session: Record<string, unknown> }).session, {
    id: session.id, ownerIdentityId: session.ownerIdentityId, title: session.title, status: session.status,
    board: session.board, sequence: session.sequence, createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(), endedAt: null
  });
});

void test("session endpoints return unavailable or unauthorized when dependencies or identity are missing", async () => {
  const unavailable = createSessionController({ identity: null, sessions: null });
  const unavailableReply = response();
  await unavailable.listMine(request(), unavailableReply.target);
  assert.equal(unavailableReply.reply.statusCode, 503);
  const anonymous = createController({}, false);
  const anonymousReply = response();
  await anonymous.create(request({ title: "Team board", board }), anonymousReply.target);
  assert.equal(anonymousReply.reply.statusCode, 401);
});

void test("get validates session IDs and serializes a found session", async () => {
  const api = createController();
  const invalid = response();
  await api.get(request(undefined, { sessionId: "bad-id" }), invalid.target);
  assert.equal(invalid.reply.statusCode, 404);
  const ok = response();
  await api.get(request(undefined, { sessionId: validId }), ok.target);
  assert.equal(ok.reply.statusCode, 200);
  assert.equal(ok.reply.headers.get("cache-control"), "no-store");
  assert.equal((ok.reply.body as { session: { id: string } }).session.id, validId);
});

void test("listMine returns only the public session summary", async () => {
  const api = createController();
  const reply = response();
  await api.listMine(request(), reply.target);
  assert.deepEqual(reply.reply.body, { sessions: [{ id: validId, title: session.title, sequence: 3, updatedAt: session.updatedAt.toISOString() }] });
  assert.equal(reply.reply.headers.get("cache-control"), "no-store");
});

void test("rename validates identifiers and title before returning the renamed session", async () => {
  const api = createController();
  const invalidId = response();
  await api.rename(request({ title: "Updated" }, { sessionId: "invalid" }), invalidId.target);
  assert.equal(invalidId.reply.statusCode, 400);
  const invalidTitle = response();
  await api.rename(request({ title: "" }, { sessionId: validId }), invalidTitle.target);
  assert.equal(invalidTitle.reply.statusCode, 400);
  const renamed = { ...session, title: "Updated" };
  const apiWithRename = createController({ rename: () => Promise.resolve(renamed) });
  const ok = response();
  await apiWithRename.rename(request({ title: "Updated" }, { sessionId: validId }), ok.target);
  assert.equal((ok.reply.body as { session: { title: string } }).session.title, "Updated");
});

void test("end accepts an expected sequence and rejects malformed preconditions", async () => {
  let expected: number | undefined;
  const api = createController({ end: (_id, _owner, sequence) => { expected = sequence; return Promise.resolve({ ...session, status: "ended", endedAt: new Date("2026-01-03T00:00:00Z") }); } });
  const invalid = response();
  await api.end(request({ expectedSequence: -1 }, { sessionId: validId }), invalid.target);
  assert.equal(invalid.reply.statusCode, 400);
  const ok = response();
  await api.end(request({ expectedSequence: 3 }, { sessionId: validId }), ok.target);
  assert.equal(expected, 3);
  assert.equal((ok.reply.body as { session: { endedAt: string } }).session.endedAt, "2026-01-03T00:00:00.000Z");
});

void test("session failures map to not found, conflict, payload too large and unavailable", async () => {
  const cases = [
    ["not_found", 404], ["revision_changed", 409], ["board_too_large", 413], ["storage_unavailable", 503]
  ] as const;
  for (const [code, expectedStatus] of cases) {
    const api = createController({ get: () => Promise.reject(new SessionFailure(code)) });
    const reply = response();
    await api.get(request(undefined, { sessionId: validId }), reply.target);
    assert.equal(reply.reply.statusCode, expectedStatus);
  }
  const unexpected = createController({ get: () => Promise.reject(new Error("unexpected")) });
  const reply = response();
  await unexpected.get(request(undefined, { sessionId: validId }), reply.target);
  assert.equal(reply.reply.statusCode, 503);
});
