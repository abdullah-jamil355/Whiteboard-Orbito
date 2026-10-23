import test from "node:test";
import assert from "node:assert/strict";
import {
  addDuration,
  createOpaqueSecret,
  hashOpaqueSecret,
  identityPolicy,
  isCredentialUsable,
  normalizeEmail
} from "../index.js";

void test("normalizes email for consistent identity matching", () => {
  assert.equal(normalizeEmail("  Owner@Example.COM "), "owner@example.com");
});

void test("creates opaque secrets with cryptographic-sized input and hashes without retaining the secret", () => {
  const secret = createOpaqueSecret((size) => Buffer.alloc(size, 7));
  assert.equal(Buffer.from(secret, "base64url").byteLength, identityPolicy.opaqueSecretBytes);
  assert.equal(hashOpaqueSecret(secret), hashOpaqueSecret(secret));
  assert.notEqual(hashOpaqueSecret(secret), secret);
  assert.equal(hashOpaqueSecret(secret).length, 64);
});

void test("creates expiry timestamps from an explicit clock and duration", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");
  assert.equal(
    addDuration(now, identityPolicy.magicLinkLifetimeMs).toISOString(),
    "2026-10-18T12:10:00.000Z"
  );
});

void test("accepts only unconsumed, unrevoked credentials before their expiry", () => {
  const now = new Date("2026-10-18T12:00:00.000Z");
  const valid = { expiresAt: addDuration(now, 1), consumedAt: null };
  assert.equal(isCredentialUsable(valid, now), true);
  assert.equal(isCredentialUsable({ ...valid, expiresAt: now }, now), false);
  assert.equal(isCredentialUsable({ ...valid, consumedAt: now }, now), false);
  assert.equal(isCredentialUsable({ ...valid, revokedAt: now }, now), false);
});
