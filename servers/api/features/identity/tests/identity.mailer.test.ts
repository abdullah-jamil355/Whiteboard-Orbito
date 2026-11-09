import test from "node:test";
import assert from "node:assert/strict";
import { createIdentityMailer } from "../identity.mailer.js";

void test("creates a sign-in email with escaped link, recipient and expiry", async () => {
  let message: unknown;
  const mailer = createIdentityMailer((input) => { message = input; return Promise.resolve(); });
  await mailer.sendMagicLink({ recipient: "owner@example.com", verificationUrl: 'https://example.test/?x="<tag>&', expiresAt: new Date("2026-01-01T10:00:00Z") });
  const email = message as { recipient: string; subject: string; html: string; text: string };
  assert.equal(email.recipient, "owner@example.com");
  assert.equal(email.subject, "Your Whiteboard sign-in link");
  assert.match(email.html, /x=&quot;&lt;tag&gt;&amp;/);
  assert.match(email.text, /https:\/\/example\.test/);
  assert.match(email.html, /2026-01-01T10:00:00\.000Z UTC/);
});

void test("propagates sign-in email delivery errors", async () => {
  const failure = new Error("delivery failed");
  const mailer = createIdentityMailer(() => Promise.reject(failure));
  await assert.rejects(mailer.sendMagicLink({ recipient: "owner@example.com", verificationUrl: "https://example.test", expiresAt: new Date() }), (error: unknown) => error === failure);
});
