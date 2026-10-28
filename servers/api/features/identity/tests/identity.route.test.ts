import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "../../../bootstrap/create-server.js";
import { createDevMailbox } from "../identity.dev-mailbox.js";
import { createIdentityRoutes } from "../routes/identity.route.js";
import type { IdentityService } from "../identity.service.js";
import type { Logger } from "@workspace/logging";

const logger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };

const createTestServer = async (environment: string, host: string) => {
  const config = { environment: "test" as const, host: "127.0.0.1", port: 0, webOrigin: "http://localhost:3100", logLevel: "silent" as const };
  const mailbox = createDevMailbox();
  const service: IdentityService = {
    reserveHttpRequestRateLimit: () => Promise.resolve({ allowed: true, retryAfterSeconds: 60 }),
    requestMagicLink: ({ email }) => mailbox.mailer.sendMagicLink({
      recipient: email,
      verificationUrl: "http://localhost:3100/auth/verify#token=only-in-mailbox",
      expiresAt: new Date(Date.now() + 60_000)
    }),
    consumeMagicLink: () => Promise.resolve({ identityId: "identity-1", sessionToken: "s".repeat(43), expiresAt: new Date(Date.now() + 60_000) }),
    registerWithPassword: () => Promise.resolve({
      identity: { id: "identity-1", email: "owner@example.com", name: "Owner", createdAt: new Date(), verifiedAt: new Date() },
      sessionToken: "s".repeat(43),
      expiresAt: new Date(Date.now() + 60_000)
    }),
    loginWithPassword: () => Promise.resolve({
      identity: { id: "identity-1", email: "owner@example.com", name: "Owner", createdAt: new Date(), verifiedAt: new Date() },
      sessionToken: "s".repeat(43),
      expiresAt: new Date(Date.now() + 60_000)
    }),
    getIdentityForSession: () => Promise.resolve({ id: "identity-1", email: "owner@example.com" }),
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
  app.use(createIdentityRoutes({ service, mailbox, webOrigin: config.webOrigin, environment, host }));
  const server = createServer({ app, config, logger });
  await server.start();
  const address = server.raw.address();
  assert.ok(address && typeof address === "object");
  return { server, origin: `http://127.0.0.1:${String(address.port)}`, mailbox };
};

void test("magic-link request requires the configured web origin and does not return the token", async (context) => {
  const running = await createTestServer("development", "127.0.0.1");
  context.after(async () => { await running.server.stop(); });

  const denied = await fetch(`${running.origin}/auth/magic-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "https://attacker.example" },
    body: JSON.stringify({ email: "owner@example.com" })
  });
  assert.equal(denied.status, 401);

  const accepted = await fetch(`${running.origin}/auth/magic-links`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3100" },
    body: JSON.stringify({ email: "owner@example.com" })
  });
  assert.equal(accepted.status, 202);
  assert.deepEqual(await accepted.json(), { message: "If this address can sign in, a link has been sent." });
  assert.equal(running.mailbox.listFor("owner@example.com").length, 1);
});

void test("dev mail inbox is available only in development on a loopback API host", async (context) => {
  const development = await createTestServer("development", "127.0.0.1");
  const production = await createTestServer("production", "0.0.0.0");
  context.after(async () => {
    await development.server.stop();
    await production.server.stop();
  });

  const devResponse = await fetch(`${development.origin}/__dev/mailbox`, {
    method: "POST",
    headers: { Origin: "http://localhost:3100", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com" })
  });
  assert.equal(devResponse.status, 200);
  assert.deepEqual(await devResponse.json(), { messages: [] });
  const productionResponse = await fetch(`${production.origin}/__dev/mailbox`, {
    method: "POST",
    headers: { Origin: "http://localhost:3100", "Content-Type": "application/json" },
    body: JSON.stringify({ email: "owner@example.com" })
  });
  assert.equal(productionResponse.status, 404);
});

void test("session establishment returns an HttpOnly, SameSite cookie", async (context) => {
  const running = await createTestServer("development", "127.0.0.1");
  context.after(async () => { await running.server.stop(); });

  const response = await fetch(`${running.origin}/auth/magic-links/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: "http://localhost:3100" },
    body: JSON.stringify({ token: "m".repeat(43) })
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("set-cookie") ?? "", /HttpOnly/);
  assert.match(response.headers.get("set-cookie") ?? "", /SameSite=Lax/);
  assert.equal(JSON.stringify(await response.json()).includes("s".repeat(43)), false);
});
