import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "../../../bootstrap/create-server.js";
import { createSessionRoutes } from "../routes/sessions.route.js";
import { createSessionService } from "../sessions.service.js";
import type { IdentityService } from "../../identity/public.js";
import type { BoardSession, SessionRepository } from "../sessions.contracts.js";
import type { Logger } from "@workspace/logging";

const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
const board = { id: "board-1", title: "Untitled", templateId: "blank", canvas: { gridStyle: "graph-paper" as const, gridSpacing: 22 }, objects: [] };

const start = async () => {
  let session: BoardSession | null = null;
  const repository: SessionRepository = {
    create: ({ ownerIdentityId, title, board: snapshot, now }) => {
      session = { id: "507f1f77bcf86cd799439011", ownerIdentityId, title, board: snapshot, sequence: 0, status: "active", createdAt: now, updatedAt: now, endedAt: null };
      return Promise.resolve(session);
    },
    findById: (id) => Promise.resolve(id === session?.id ? session : null),
    findActiveForMember: (identityId) => Promise.resolve(session?.status === "active" && session.ownerIdentityId === identityId ? [session] : []),
    rename: (_id, ownerIdentityId, title, now) => {
      if (!session || session.ownerIdentityId !== ownerIdentityId || session.status !== "active") return Promise.resolve(null);
      session = { ...session, title, updatedAt: now };
      return Promise.resolve(session);
    },
    end: (_id, ownerIdentityId, now) => {
      if (!session || session.ownerIdentityId !== ownerIdentityId) return Promise.resolve(null);
      session = { ...session, status: "ended", endedAt: now, updatedAt: now };
      return Promise.resolve(session);
    },
    deleteEndedSession: () => Promise.resolve()
  };
  const identity: IdentityService = {
    reserveHttpRequestRateLimit: () => Promise.resolve({ allowed: true, retryAfterSeconds: 60 }),
    requestMagicLink: () => Promise.resolve(),
    consumeMagicLink: () => Promise.resolve({ identityId: "owner-1", sessionToken: "token", expiresAt: new Date() }),
    registerWithPassword: () => Promise.resolve({
      identity: { id: "owner-1", email: "owner@example.test", createdAt: new Date(), verifiedAt: new Date() },
      sessionToken: "token",
      expiresAt: new Date()
    }),
    loginWithPassword: () => Promise.resolve({
      identity: { id: "owner-1", email: "owner@example.test", createdAt: new Date(), verifiedAt: new Date() },
      sessionToken: "token",
      expiresAt: new Date()
    }),
    getIdentityForSession: (token) => Promise.resolve(token === "owner" ? { id: "owner-1", email: "owner@example.test" } : null),
    revokeSession: () => Promise.resolve(),
    reserveInvitationRateLimit: () => Promise.resolve(true),
    startGoogleMailConnect: () => Promise.resolve("https://accounts.google.com"),
    finishGoogleMailConnect: () => Promise.resolve(),
    getGoogleMailStatus: () => Promise.resolve({ configured: true, connected: false }),
    disconnectGoogleMail: () => Promise.resolve(),
    sendAsGoogleMail: () => Promise.resolve()
  };
  const app = express();
  app.use(express.json());
  app.use(createSessionRoutes({ identity, sessions: createSessionService({ repository }), webOrigin: "http://localhost:3100" }));
  const server = createServer({ app, config: { environment: "test", host: "127.0.0.1", port: 0, webOrigin: "http://localhost:3100", logLevel: "silent" }, logger });
  await server.start();
  const address = server.raw.address();
  assert.ok(address && typeof address === "object");
  return { server, origin: `http://127.0.0.1:${String(address.port)}` };
};

void test("creates an active session only for a verified cookie identity and same-origin request", async (context) => {
  const running = await start();
  context.after(async () => { await running.server.stop(); });
  const body = { title: "Team board", board };
  const anonymous = await fetch(`${running.origin}/sessions`, { method: "POST", headers: { Origin: "http://localhost:3100", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(anonymous.status, 401);
  const crossOrigin = await fetch(`${running.origin}/sessions`, { method: "POST", headers: { Origin: "https://attacker.example", Cookie: "wb_session=owner", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(crossOrigin.status, 401);
  const created = await fetch(`${running.origin}/sessions`, { method: "POST", headers: { Origin: "http://localhost:3100", Cookie: "wb_session=owner", "Content-Type": "application/json" }, body: JSON.stringify(body) });
  assert.equal(created.status, 201);
  const result = await created.json() as { session: BoardSession };
  assert.equal(result.session.status, "active");
  assert.equal(result.session.ownerIdentityId, "owner-1");
  const anonymousList = await fetch(`${running.origin}/sessions/mine`);
  assert.equal(anonymousList.status, 401);
  const listed = await fetch(`${running.origin}/sessions/mine`, { headers: { Cookie: "wb_session=owner" } });
  assert.equal(listed.status, 200);
  const listResult = await listed.json() as { sessions: readonly Readonly<{ id: string; title: string }>[] };
  assert.deepEqual(listResult.sessions.map(({ id, title }) => ({ id, title })), [{ id: result.session.id, title: result.session.title }]);
});
