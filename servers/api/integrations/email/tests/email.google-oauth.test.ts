import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { createGoogleOAuthIntegration } from "../email.google-oauth.js";

const configuration = { clientId: "client-id", clientSecret: "client-secret", redirectUri: "http://localhost:4000/auth/google-mail/callback" };
const jsonResponse = (body: unknown, ok = true): Response => ({ ok, json: () => Promise.resolve(body) }) as Response;
const installFetch = (context: TestContext, implementation: (url: string, init?: RequestInit) => Promise<Response>) => {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  context.mock.method(globalThis, "fetch", ((url: string | URL | Request, init?: RequestInit) => {
    const requestUrl = typeof url === "string" ? url : url instanceof URL ? url.href : url.url;
    calls.push({ url: requestUrl, ...(init === undefined ? {} : { init }) });
    return implementation(requestUrl, init);
  }) as never);
  return calls;
};

void test("builds a consent authorization URL with optional Gmail account hint", () => {
  const integration = createGoogleOAuthIntegration(configuration);
  const url = new URL(integration.authorizationUrl("opaque-state", "owner@example.com"));
  assert.equal(url.origin + url.pathname, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(url.searchParams.get("client_id"), configuration.clientId);
  assert.equal(url.searchParams.get("redirect_uri"), configuration.redirectUri);
  assert.equal(url.searchParams.get("scope"), "openid email https://www.googleapis.com/auth/gmail.send");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
  assert.equal(url.searchParams.get("state"), "opaque-state");
  assert.equal(url.searchParams.get("login_hint"), "owner@example.com");
  assert.equal(new URL(integration.authorizationUrl("state")).searchParams.has("login_hint"), false);
});

void test("exchanges an authorization code and requires a verified valid email", async (context) => {
  const calls = installFetch(context, (url) => Promise.resolve(url.includes("/token")
    ? jsonResponse({ access_token: "access", refresh_token: "refresh" })
    : jsonResponse({ email: "Owner@Example.com", email_verified: true })));
  const account = await createGoogleOAuthIntegration(configuration).exchangeCode("oauth-code");
  assert.deepEqual(account, { email: "owner@example.com", refreshToken: "refresh" });
  assert.equal(calls.length, 2);
  const tokenCall = calls[0];
  const profileCall = calls[1];
  assert.ok(tokenCall?.init);
  assert.ok(profileCall?.init);
  assert.equal(tokenCall.init.method, "POST");
  assert.ok(tokenCall.init.body instanceof URLSearchParams);
  assert.match(tokenCall.init.body.toString(), /grant_type=authorization_code/);
  assert.equal(new Headers(profileCall.init.headers).get("authorization"), "Bearer access");
});

void test("rejects failed or malformed token and profile responses", async (context) => {
  installFetch(context, () => Promise.resolve(jsonResponse({ error: "denied" }, false)));
  await assert.rejects(createGoogleOAuthIntegration(configuration).exchangeCode("code"), /token exchange failed/);
});

void test("treats an unreadable provider JSON response as a rejected exchange", async (context) => {
  installFetch(context, () => Promise.resolve({ ok: true, json: () => Promise.reject(new Error("invalid JSON")) } as Response));
  await assert.rejects(createGoogleOAuthIntegration(configuration).exchangeCode("code"), /token exchange failed/);
});

void test("rejects missing refresh tokens, invalid JSON structures and unverified profiles", async (context) => {
  let call = 0;
  installFetch(context, () => {
    call += 1;
    if (call === 1) return Promise.resolve(jsonResponse({ access_token: "access" }));
    if (call === 2) return Promise.resolve(jsonResponse([]));
    if (call === 3) return Promise.resolve(jsonResponse({ access_token: "access", refresh_token: "refresh" }));
    return Promise.resolve(jsonResponse({ email: "owner@example.com", email_verified: false }));
  });
  const integration = createGoogleOAuthIntegration(configuration);
  await assert.rejects(integration.exchangeCode("no-refresh"), /token exchange failed/);
  await assert.rejects(integration.exchangeCode("invalid-profile"), /invalid response/);
  await assert.rejects(integration.exchangeCode("unverified"), /verified Gmail identity/);
});

void test("revokes refresh tokens", async (context) => {
  const calls = installFetch(context, () => Promise.resolve(jsonResponse({}, true)));
  await createGoogleOAuthIntegration(configuration).revokeToken("refresh-token");
  const revokeCall = calls[0];
  assert.ok(revokeCall?.init);
  assert.equal(revokeCall.url, "https://oauth2.googleapis.com/revoke");
  assert.ok(revokeCall.init.body instanceof URLSearchParams);
  assert.match(revokeCall.init.body.toString(), /token=refresh-token/);
});

void test("reports a provider rejection when revoking a refresh token", async (context) => {
  installFetch(context, () => Promise.resolve(jsonResponse({}, false)));
  await assert.rejects(createGoogleOAuthIntegration(configuration).revokeToken("refresh-token"), /could not revoke/);
});

void test("refreshes Gmail credentials and sends an encoded multipart email", async (context) => {
  let call = 0;
  const calls = installFetch(context, () => {
    call += 1;
    return Promise.resolve(call === 1 ? jsonResponse({ access_token: "access" }) : jsonResponse({ id: "message-id" }));
  });
  const email = { recipient: "participant@example.com", subject: "Invitation ✓", text: "Join board", html: "<b>Join board</b>" };
  await createGoogleOAuthIntegration(configuration).sendEmail({ email: "owner@example.com", refreshToken: "refresh" }, email);
  assert.equal(calls.length, 2);
  const sendCall = calls[1];
  assert.ok(sendCall?.init);
  assert.equal(typeof sendCall.init.body, "string");
  const payload = JSON.parse(sendCall.init.body as string) as { raw: string };
  const mime = Buffer.from(payload.raw, "base64url").toString("utf8");
  assert.match(mime, /From: Whiteboard <owner@example.com>/);
  assert.match(mime, /To: participant@example.com/);
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.match(mime, /Content-Type: multipart\/alternative/);
  assert.match(mime, /Sm9pbiBib2FyZA==/);
  assert.match(mime, /PGI\+Sm9pbiBib2FyZDwvYj4=/);
  assert.equal(new Headers(sendCall.init.headers).get("authorization"), "Bearer access");
});

void test("rejects failed token refresh and Gmail send responses", async (context) => {
  let call = 0;
  installFetch(context, () => {
    call += 1;
    if (call === 1) return Promise.resolve(jsonResponse({ error: "denied" }, false));
    if (call === 2) return Promise.resolve(jsonResponse({ access_token: "access" }));
    return Promise.resolve(jsonResponse({}, false));
  });
  const integration = createGoogleOAuthIntegration(configuration);
  const email = { recipient: "person@example.com", subject: "Subject", text: "Text", html: "<p>Text</p>" };
  await assert.rejects(integration.sendEmail({ email: "owner@example.com", refreshToken: "refresh" }, email), /could not refresh/);
  await assert.rejects(integration.sendEmail({ email: "owner@example.com", refreshToken: "refresh" }, email), /rejected the invitation/);
});

void test("stops Gmail sending when token refresh consumes the delivery deadline", async (context) => {
  let nowCall = 0;
  context.mock.method(Date, "now", (() => { nowCall += 1; return nowCall < 3 ? 0 : 16_000; }) as never);
  installFetch(context, () => Promise.resolve(jsonResponse({ access_token: "access" })));
  const email = { recipient: "person@example.com", subject: "Subject", text: "Text", html: "<p>Text</p>" };
  await assert.rejects(createGoogleOAuthIntegration(configuration).sendEmail({ email: "owner@example.com", refreshToken: "refresh" }, email), /exceeded its 15-second deadline/);
});
