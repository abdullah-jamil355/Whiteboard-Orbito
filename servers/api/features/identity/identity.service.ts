import { createCipheriv, createDecipheriv, createHmac, randomBytes } from "node:crypto";
import {
  addDuration,
  createOpaqueSecret,
  hashOpaqueSecret,
  identityPolicy,
  isCredentialUsable,
  normalizeEmail
} from "./identity.rules.js";
import { IdentityServiceFailure } from "./identity.contracts.js";
import type { IdentityMailer, IdentityRepository, ServerSession } from "./identity.contracts.js";
import { createGoogleOAuthIntegration } from "../../integrations/index.js";
import type { GoogleOAuthConfiguration, OutgoingEmail } from "../../integrations/index.js";

type IdentityServiceDependencies = Readonly<{
  repository: IdentityRepository;
  mailer: IdentityMailer;
  webOrigin: string;
  rateLimitKey: string;
  generateSecret?: () => string;
  googleOAuth?: GoogleOAuthConfiguration;
  googleTokenEncryptionKey?: string;
}>;

export type IdentityService = Readonly<{
  reserveHttpRequestRateLimit: (input: Readonly<{ sessionToken?: string; ipAddress: string }>) => Promise<Readonly<{ allowed: boolean; retryAfterSeconds: number }>>;
  requestMagicLink: (input: Readonly<{ email: string; ipAddress: string }>) => Promise<void>;
  consumeMagicLink: (token: string) => Promise<Readonly<{ identityId: string; sessionToken: string; expiresAt: Date }>>;
  getIdentityForSession: (sessionToken: string | undefined) => Promise<Readonly<{ id: string; email: string }> | null>;
  revokeSession: (sessionToken: string | undefined) => Promise<void>;
  reserveInvitationRateLimit: (input: Readonly<{ identityId: string; ipAddress: string }>) => Promise<boolean>;
  startGoogleMailConnect: (identityId: string, email: string) => Promise<string>;
  finishGoogleMailConnect: (identityId: string, state: string, code: string) => Promise<void>;
  getGoogleMailStatus: (identityId: string) => Promise<Readonly<{ configured: boolean; connected: boolean; email?: string }>>;
  disconnectGoogleMail: (identityId: string) => Promise<void>;
  sendAsGoogleMail: (identityId: string, email: OutgoingEmail) => Promise<void>;
}>;

export const createIdentityService = ({
  repository,
  mailer,
  webOrigin,
  rateLimitKey,
  generateSecret = createOpaqueSecret,
  googleOAuth,
  googleTokenEncryptionKey
}: IdentityServiceDependencies): IdentityService => {
  const google = googleOAuth ? createGoogleOAuthIntegration(googleOAuth) : null;
  const encryptionKey = googleTokenEncryptionKey ? Buffer.from(googleTokenEncryptionKey, "hex") : null;
  const encryptToken = (token: string): string => {
    if (!encryptionKey || encryptionKey.byteLength !== 32) throw new IdentityServiceFailure("storage_unavailable");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
    const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
    return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString("base64url")).join(".");
  };
  const decryptToken = (value: string): string => {
    if (!encryptionKey || encryptionKey.byteLength !== 32) throw new IdentityServiceFailure("storage_unavailable");
    const [ivText, tagText, ciphertextText] = value.split(".");
    if (!ivText || !tagText || !ciphertextText) throw new IdentityServiceFailure("storage_unavailable");
    const decipher = createDecipheriv("aes-256-gcm", encryptionKey, Buffer.from(ivText, "base64url"));
    decipher.setAuthTag(Buffer.from(tagText, "base64url"));
    return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
  };
  const hashRateKey = (kind: "email" | "ip" | "request", value: string): string =>
    createHmac("sha256", rateLimitKey).update(`${kind}:${value}`).digest("hex");

  const reserveHttpRequestRateLimit: IdentityService["reserveHttpRequestRateLimit"] = async ({ sessionToken, ipAddress }) => {
    const now = new Date();
    const windowMs = identityPolicy.apiRequestRateLimitWindowMs;
    const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
    let allowed: boolean;
    try {
      allowed = await repository.reserveApiRequestRateLimit({
        subjectKeyHash: hashRateKey("request", sessionToken ? `session:${sessionToken}` : `ip:${ipAddress}`),
        ipKeyHash: hashRateKey("ip", `http-api:${ipAddress}`),
        windowStart: new Date(windowStartMs),
        expiresAt: new Date(windowStartMs + identityPolicy.rateLimitRecordRetentionMs),
        subjectLimit: identityPolicy.apiRequestsPerSubject,
        ipLimit: identityPolicy.apiRequestsPerIp
      });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    return Object.freeze({
      allowed,
      retryAfterSeconds: Math.max(1, Math.ceil((windowStartMs + windowMs - now.getTime()) / 1000))
    });
  };

  const requestMagicLink: IdentityService["requestMagicLink"] = async ({ email, ipAddress }) => {
    const normalizedEmail = normalizeEmail(email);
    const now = new Date();
    const windowMs = identityPolicy.magicLinkRateLimitWindowMs;
    const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
    let isRateLimited: boolean;
    try {
      isRateLimited = !await repository.reserveMagicLinkRateLimit({
        emailKeyHash: hashRateKey("email", normalizedEmail),
        ipKeyHash: hashRateKey("ip", ipAddress),
        windowStart: new Date(windowStartMs),
        expiresAt: new Date(windowStartMs + identityPolicy.rateLimitRecordRetentionMs),
        emailLimit: identityPolicy.magicLinkMaxPerEmail,
        ipLimit: identityPolicy.magicLinkMaxPerIp
      });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    if (isRateLimited) {
      const retryAfterSeconds = Math.max(1, Math.ceil((windowStartMs + windowMs - now.getTime()) / 1000));
      throw new IdentityServiceFailure("rate_limited", retryAfterSeconds);
    }

    const token = generateSecret();
    const expiresAt = addDuration(now, identityPolicy.magicLinkLifetimeMs);
    const tokenHash = hashOpaqueSecret(token);
    try {
      await repository.createMagicLink({
        email: normalizedEmail,
        tokenHash,
        createdAt: now,
        expiresAt
      });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    try {
      const url = new URL("/auth/verify", webOrigin);
      url.hash = new URLSearchParams({ token }).toString();
      await mailer.sendMagicLink({ recipient: normalizedEmail, verificationUrl: url.toString(), expiresAt });
    } catch {
      throw new IdentityServiceFailure("delivery_unavailable");
    }
  };

  const consumeMagicLink: IdentityService["consumeMagicLink"] = async (token) => {
    if (token.length < 32 || token.length > 256) throw new IdentityServiceFailure("invalid_or_expired_link");
    const now = new Date();
    let challenge;
    try {
      challenge = await repository.consumeMagicLink(hashOpaqueSecret(token), now);
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    if (!challenge || !isCredentialUsable(challenge, now)) {
      throw new IdentityServiceFailure("invalid_or_expired_link");
    }
    try {
      const identity = await repository.findOrCreateIdentity(challenge.email, now);
      const sessionToken = generateSecret();
      const expiresAt = addDuration(now, identityPolicy.serverSessionLifetimeMs);
      await repository.createSession({
        identityId: identity.id,
        tokenHash: hashOpaqueSecret(sessionToken),
        createdAt: now,
        expiresAt
      });
      return Object.freeze({ identityId: identity.id, sessionToken, expiresAt });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const getIdentityForSession: IdentityService["getIdentityForSession"] = async (sessionToken) => {
    if (!sessionToken || sessionToken.length < 32 || sessionToken.length > 256) return null;
    let session: ServerSession | null;
    try {
      session = await repository.findSession(hashOpaqueSecret(sessionToken), new Date());
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    if (!session) return null;
    try {
      const identity = await repository.getIdentityById(session.identityId);
      return identity ? Object.freeze({ id: identity.id, email: identity.email }) : null;
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const revokeSession: IdentityService["revokeSession"] = async (sessionToken) => {
    if (!sessionToken || sessionToken.length < 32 || sessionToken.length > 256) return;
    try {
      await repository.revokeSession(hashOpaqueSecret(sessionToken), new Date());
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const reserveInvitationRateLimit: IdentityService["reserveInvitationRateLimit"] = async ({ identityId, ipAddress }) => {
    const now = new Date();
    const windowMs = identityPolicy.magicLinkRateLimitWindowMs;
    const windowStartMs = Math.floor(now.getTime() / windowMs) * windowMs;
    try {
      return await repository.reserveMagicLinkRateLimit({
        emailKeyHash: hashRateKey("email", `invitation-identity:${identityId}`),
        ipKeyHash: hashRateKey("ip", `invitation-ip:${ipAddress}`),
        windowStart: new Date(windowStartMs), expiresAt: new Date(windowStartMs + identityPolicy.rateLimitRecordRetentionMs),
        emailLimit: 10, ipLimit: 30
      });
    } catch { throw new IdentityServiceFailure("storage_unavailable"); }
  };

  const startGoogleMailConnect: IdentityService["startGoogleMailConnect"] = async (identityId, email) => {
    if (!google || !encryptionKey) throw new IdentityServiceFailure("delivery_unavailable");
    const state = generateSecret();
    try {
      await repository.createGoogleMailState({ stateHash: hashOpaqueSecret(state), identityId, expiresAt: new Date(Date.now() + 10 * 60_000) });
      return google.authorizationUrl(state, email);
    } catch { throw new IdentityServiceFailure("storage_unavailable"); }
  };

  const finishGoogleMailConnect: IdentityService["finishGoogleMailConnect"] = async (identityId, state, code) => {
    if (!google || !encryptionKey) throw new IdentityServiceFailure("delivery_unavailable");
    let isValid: boolean;
    try { isValid = await repository.consumeGoogleMailState(hashOpaqueSecret(state), identityId, new Date()); }
    catch { throw new IdentityServiceFailure("storage_unavailable"); }
    if (!isValid) throw new IdentityServiceFailure("invalid_or_expired_link");
    try {
      const account = await google.exchangeCode(code);
      const identity = await repository.getIdentityById(identityId);
      if (!identity || identity.email !== account.email) {
        await google.revokeToken(account.refreshToken).catch(() => undefined);
        throw new IdentityServiceFailure("google_account_mismatch");
      }
      await repository.saveGoogleMailAccount(identityId, account.email, encryptToken(account.refreshToken), new Date());
    } catch (error) {
      if (error instanceof IdentityServiceFailure) throw error;
      throw new IdentityServiceFailure("delivery_unavailable");
    }
  };

  const getGoogleMailStatus: IdentityService["getGoogleMailStatus"] = async (identityId) => {
    try {
      const account = await repository.getGoogleMailAccount(identityId);
      return account ? Object.freeze({ configured: google !== null && encryptionKey !== null, connected: true, email: account.email }) : Object.freeze({ configured: google !== null && encryptionKey !== null, connected: false });
    } catch { throw new IdentityServiceFailure("storage_unavailable"); }
  };

  const disconnectGoogleMail: IdentityService["disconnectGoogleMail"] = async (identityId) => {
    try {
      const account = await repository.getGoogleMailAccount(identityId);
      if (account && google) {
        try { await google.revokeToken(decryptToken(account.encryptedRefreshToken)); }
        catch { /* local token removal must remain available when Google is unreachable */ }
      }
      await repository.removeGoogleMailAccount(identityId);
    }
    catch { throw new IdentityServiceFailure("storage_unavailable"); }
  };

  const sendAsGoogleMail: IdentityService["sendAsGoogleMail"] = async (identityId, email) => {
    if (!google) throw new IdentityServiceFailure("delivery_unavailable");
    try {
      const account = await repository.getGoogleMailAccount(identityId);
      if (!account) throw new IdentityServiceFailure("delivery_unavailable");
      await google.sendEmail({ email: account.email, refreshToken: decryptToken(account.encryptedRefreshToken) }, email);
    } catch (error) {
      if (error instanceof IdentityServiceFailure) throw error;
      throw new IdentityServiceFailure("delivery_unavailable");
    }
  };

  return Object.freeze({ reserveHttpRequestRateLimit, requestMagicLink, consumeMagicLink, getIdentityForSession, revokeSession, reserveInvitationRateLimit, startGoogleMailConnect, finishGoogleMailConnect, getGoogleMailStatus, disconnectGoogleMail, sendAsGoogleMail });
};
