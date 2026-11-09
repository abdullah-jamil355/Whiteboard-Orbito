import test from "node:test";
import assert from "node:assert/strict";
import { createInvitationMailer } from "../invitations.mailer.js";

void test("sends invitation content with escaped HTML and owner-scoped sender call", async () => {
  let ownerIdentityId = "";
  let email: unknown;
  const mailer = createInvitationMailer((ownerId, message) => {
    ownerIdentityId = ownerId;
    email = message;
    return Promise.resolve();
  });
  await mailer.sendInvitation({
    ownerIdentityId: "owner-1", recipient: "person@example.com", invitationUrl: "https://example.test/join?x=<tag>&y=\"z\"",
    sessionTitle: "<Plan & Review>", expiresAt: new Date("2026-01-01T10:00:00Z")
  });
  assert.equal(ownerIdentityId, "owner-1");
  const sent = email as { recipient: string; subject: string; html: string; text: string };
  assert.equal(sent.recipient, "person@example.com");
  assert.match(sent.subject, /<Plan & Review>/);
  assert.match(sent.html, /&lt;Plan &amp; Review&gt;/);
  assert.match(sent.html, /x=&lt;tag&gt;&amp;y=&quot;z&quot;/);
  assert.match(sent.html, /person@example\.com/);
  assert.match(sent.text, /https:\/\/example\.test\/join/);
  assert.match(sent.text, /expires at 2026-01-01T10:00:00\.000Z UTC/);
});

void test("propagates invitation email delivery errors", async () => {
  const failure = new Error("mail unavailable");
  const mailer = createInvitationMailer(() => Promise.reject(failure));
  await assert.rejects(mailer.sendInvitation({
    ownerIdentityId: "owner-1", recipient: "person@example.com", invitationUrl: "https://example.test", sessionTitle: "Plan", expiresAt: new Date()
  }), (error: unknown) => error === failure);
});
