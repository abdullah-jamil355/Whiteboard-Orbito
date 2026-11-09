import test from "node:test";
import assert from "node:assert/strict";
import { createGoogleMailOperations } from "../identity.google.js";
import type { IdentityRepository } from "../identity.contracts.js";
import type { GoogleOAuthIntegration } from "../../../integrations/index.js";

const googleAccount = { email: "owner@example.com", refreshToken: "refresh-token" };
const outgoing = { recipient: "person@example.com", subject: "Join", html: "<p>Join</p>", text: "Join" };

const setup = (options: Readonly<{
  enabled?: boolean;
  account?: Readonly<{ email: string; encryptedRefreshToken: string }> | null;
  identityEmail?: string | null;
  validState?: boolean;
  fail?: string;
  revokeFails?: boolean;
}> = {}) => {
  const calls: string[] = [];
  const repository = {
    createGoogleMailState: () => options.fail === "create-state" ? Promise.reject(new Error("db")) : Promise.resolve(),
    consumeGoogleMailState: () => options.fail === "consume-state" ? Promise.reject(new Error("db")) : Promise.resolve(options.validState ?? true),
    getIdentityById: () => Promise.resolve(options.identityEmail === null ? null : { id: "identity-1", email: options.identityEmail ?? googleAccount.email, createdAt: new Date(), verifiedAt: new Date() }),
    saveGoogleMailAccount: (_id: string, email: string, token: string) => options.fail === "save-account" ? Promise.reject(new Error("db")) : (calls.push(`saved:${email}:${token}`), Promise.resolve()),
    getGoogleMailAccount: () => options.fail === "get-account" ? Promise.reject(new Error("db")) : Promise.resolve(options.account ?? null),
    removeGoogleMailAccount: () => options.fail === "remove-account" ? Promise.reject(new Error("db")) : (calls.push("removed"), Promise.resolve())
  } as unknown as IdentityRepository;
  const google = options.enabled === false ? null : {
    authorizationUrl: (state: string, email: string) => `https://accounts.google.com/?state=${state}&hint=${email}`,
    exchangeCode: () => options.fail === "exchange" ? Promise.reject(new Error("provider")) : Promise.resolve(googleAccount),
    revokeToken: (token: string) => options.revokeFails ? Promise.reject(new Error("revoke")) : (calls.push(`revoked:${token}`), Promise.resolve()),
    sendEmail: (identity: { email: string; refreshToken: string }) => options.fail === "send" ? Promise.reject(new Error("provider")) : (calls.push(`sent:${identity.email}:${identity.refreshToken}`), Promise.resolve())
  } as GoogleOAuthIntegration;
  const operations = createGoogleMailOperations({
    decryptToken: (value) => value.replace("encrypted:", ""),
    encryptToken: (value) => `encrypted:${value}`,
    encryptionKey: options.enabled === false ? null : Buffer.alloc(32, 1),
    generateSecret: () => "opaque-state",
    google,
    repository
  });
  return { operations, calls };
};

void test("starts Gmail authorization, hashes the state and maps unavailable or storage errors", async () => {
  const { operations } = setup();
  const url = await operations.startGoogleMailConnect("identity-1", "owner@example.com");
  assert.match(url, /state=opaque-state/);
  assert.match(url, /hint=owner@example.com/);
  await assert.rejects(setup({ enabled: false }).operations.startGoogleMailConnect("identity-1", "owner@example.com"), { code: "delivery_unavailable" });
  await assert.rejects(setup({ fail: "create-state" }).operations.startGoogleMailConnect("identity-1", "owner@example.com"), { code: "storage_unavailable" });
});

void test("finishes Gmail connection only for a valid state and matching verified identity", async () => {
  const { operations, calls } = setup();
  await operations.finishGoogleMailConnect("identity-1", "opaque-state", "code");
  assert.deepEqual(calls, ["saved:owner@example.com:encrypted:refresh-token"]);
  await assert.rejects(setup({ validState: false }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "invalid_or_expired_link" });
  await assert.rejects(setup({ identityEmail: "different@example.com" }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "google_account_mismatch" });
  await assert.rejects(setup({ identityEmail: null }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "google_account_mismatch" });
});

void test("maps Gmail state, provider and persistence errors to the correct failures", async () => {
  await assert.rejects(setup({ enabled: false }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "delivery_unavailable" });
  await assert.rejects(setup({ fail: "consume-state" }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "storage_unavailable" });
  await assert.rejects(setup({ fail: "exchange" }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "delivery_unavailable" });
  await assert.rejects(setup({ fail: "save-account" }).operations.finishGoogleMailConnect("identity-1", "state", "code"), { code: "delivery_unavailable" });
});

void test("reports configured and connected status and maps repository errors", async () => {
  assert.deepEqual(await setup().operations.getGoogleMailStatus("identity-1"), { configured: true, connected: false });
  assert.deepEqual(await setup({ account: { email: "owner@example.com", encryptedRefreshToken: "encrypted:secret" } }).operations.getGoogleMailStatus("identity-1"), { configured: true, connected: true, email: "owner@example.com" });
  assert.deepEqual(await setup({ enabled: false, account: { email: "owner@example.com", encryptedRefreshToken: "secret" } }).operations.getGoogleMailStatus("identity-1"), { configured: false, connected: true, email: "owner@example.com" });
  await assert.rejects(setup({ fail: "get-account" }).operations.getGoogleMailStatus("identity-1"), { code: "storage_unavailable" });
});

void test("disconnect revokes best-effort then removes local tokens; repository errors remain visible", async () => {
  const connected = setup({ account: { email: "owner@example.com", encryptedRefreshToken: "encrypted:refresh" } });
  await connected.operations.disconnectGoogleMail("identity-1");
  assert.deepEqual(connected.calls, ["revoked:refresh", "removed"]);
  const revokeFailure = setup({ account: { email: "owner@example.com", encryptedRefreshToken: "encrypted:refresh" }, revokeFails: true });
  await revokeFailure.operations.disconnectGoogleMail("identity-1");
  assert.deepEqual(revokeFailure.calls, ["removed"]);
  const noAccount = setup();
  await noAccount.operations.disconnectGoogleMail("identity-1");
  assert.deepEqual(noAccount.calls, ["removed"]);
  await assert.rejects(setup({ fail: "remove-account" }).operations.disconnectGoogleMail("identity-1"), { code: "storage_unavailable" });
});

void test("sends invitations from the connected account and maps missing account and provider failures", async () => {
  const connected = setup({ account: { email: "owner@example.com", encryptedRefreshToken: "encrypted:refresh" } });
  await connected.operations.sendAsGoogleMail("identity-1", outgoing);
  assert.deepEqual(connected.calls, ["sent:owner@example.com:refresh"]);
  await assert.rejects(setup({ enabled: false }).operations.sendAsGoogleMail("identity-1", outgoing), { code: "delivery_unavailable" });
  await assert.rejects(setup().operations.sendAsGoogleMail("identity-1", outgoing), { code: "delivery_unavailable" });
  await assert.rejects(setup({ account: { email: "owner@example.com", encryptedRefreshToken: "encrypted:refresh" }, fail: "send" }).operations.sendAsGoogleMail("identity-1", outgoing), { code: "delivery_unavailable" });
});
