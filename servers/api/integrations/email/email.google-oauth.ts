import type { OutgoingEmail } from "./email.contracts.js";
import { randomUUID } from "node:crypto";

const authorizationEndpoint = "https://accounts.google.com/o/oauth2/v2/auth";
const tokenEndpoint = "https://oauth2.googleapis.com/token";
const userInfoEndpoint = "https://openidconnect.googleapis.com/v1/userinfo";
const gmailSendEndpoint = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";
const isEmailAddress = (value: string): boolean => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
const gmailSendScope = "https://www.googleapis.com/auth/gmail.send";
type OAuthHttpResponse = Readonly<{ ok: boolean; json: () => Promise<unknown> }>;
const requestOAuth = (url: string, init: RequestInit): Promise<OAuthHttpResponse> =>
  globalThis.fetch(url, init);

export type GoogleMailIdentity = Readonly<{ email: string; refreshToken: string }>;
export type GoogleOAuthConfiguration = Readonly<{
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}>;

const readJson = async (response: OAuthHttpResponse): Promise<Record<string, unknown>> => {
  const value: unknown = await response.json().catch(() => ({}));
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("Google OAuth returned an invalid response.");
  return value as Record<string, unknown>;
};

export const createGoogleOAuthIntegration = (configuration: GoogleOAuthConfiguration) => Object.freeze({
  authorizationUrl: (state: string, emailHint?: string): string => {
    const url = new URL(authorizationEndpoint);
    url.search = new URLSearchParams({
      client_id: configuration.clientId,
      redirect_uri: configuration.redirectUri,
      response_type: "code",
      scope: `openid email ${gmailSendScope}`,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
      ...(emailHint ? { login_hint: emailHint } : {})
    }).toString();
    return url.toString();
  },
  exchangeCode: async (code: string): Promise<GoogleMailIdentity> => {
    const tokenResponse = await requestOAuth(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        redirect_uri: configuration.redirectUri,
        grant_type: "authorization_code"
      }),
      signal: AbortSignal.timeout(15_000)
    });
    const tokens = await readJson(tokenResponse);
    if (!tokenResponse.ok || typeof tokens.access_token !== "string" || typeof tokens.refresh_token !== "string") throw new Error("Google OAuth token exchange failed.");
    const profileResponse = await requestOAuth(userInfoEndpoint, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(15_000)
    });
    const profile = await readJson(profileResponse);
    if (!profileResponse.ok || profile.email_verified !== true || typeof profile.email !== "string" || !isEmailAddress(profile.email)) throw new Error("Google did not return a verified Gmail identity.");
    return Object.freeze({ email: profile.email.toLowerCase(), refreshToken: tokens.refresh_token });
  },
  revokeToken: async (refreshToken: string): Promise<void> => {
    const response = await requestOAuth("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token: refreshToken }),
      signal: AbortSignal.timeout(15_000)
    });
    if (!response.ok) throw new Error("Google could not revoke the connected Gmail authorization.");
  },
  sendEmail: async (identity: GoogleMailIdentity, email: OutgoingEmail): Promise<void> => {
    const deadline = Date.now() + 15_000;
    const tokenResponse = await requestOAuth(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: configuration.clientId,
        client_secret: configuration.clientSecret,
        refresh_token: identity.refreshToken,
        grant_type: "refresh_token"
      }),
      signal: AbortSignal.timeout(Math.max(1, deadline - Date.now()))
    });
    const tokens = await readJson(tokenResponse);
    if (!tokenResponse.ok || typeof tokens.access_token !== "string") throw new Error("Google could not refresh the connected Gmail authorization.");
    const boundary = `whiteboard_${randomUUID()}`;
    const encodeBody = (value: string): string => Buffer.from(value, "utf8").toString("base64").replace(/.{1,76}/g, "$&\r\n").trim();
    const encodedSubject = `=?UTF-8?B?${Buffer.from(email.subject, "utf8").toString("base64")}?=`;
    const mimeMessage = [
      `From: Whiteboard <${identity.email}>`,
      `To: ${email.recipient}`,
      `Subject: ${encodedSubject}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBody(email.text),
      `--${boundary}`,
      "Content-Type: text/html; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      encodeBody(email.html),
      `--${boundary}--`,
      ""
    ].join("\r\n");
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) throw new Error("Gmail invitation delivery exceeded its 15-second deadline.");
    const sendResponse = await requestOAuth(gmailSendEndpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ raw: Buffer.from(mimeMessage, "utf8").toString("base64url") }),
      signal: AbortSignal.timeout(remainingMs)
    });
    if (!sendResponse.ok) throw new Error("Google Gmail API rejected the invitation message.");
  }
});
