import {
  addDuration,
  createOpaqueSecret,
  hashOpaqueSecret,
  hashPassword,
  identityPolicy,
  isCredentialUsable,
  normalizeEmail,
  verifyPassword
} from "./identity.rules.js";
import { IdentityServiceFailure } from "./identity.contracts.js";
import type { Identity, IdentityMailer, IdentityRepository, ServerSession } from "./identity.contracts.js";
import { createGoogleOAuthIntegration } from "../../integrations/index.js";
import type { GoogleOAuthConfiguration, OutgoingEmail } from "../../integrations/index.js";
import { createRateKeyHasher, createTokenEncrypter } from "./identity.crypto.js";
import { createGoogleMailOperations } from "./identity.google.js";

type IdentityServiceDependencies = Readonly<{
  generateSecret?: () => string;
  googleOAuth?: GoogleOAuthConfiguration;
  googleTokenEncryptionKey?: string;
  mailer: IdentityMailer;
  rateLimitKey: string;
  repository: IdentityRepository;
  webOrigin: string;
}>;

export type IdentityService = Readonly<{
  consumeMagicLink: (token: string) => Promise<Readonly<{ expiresAt: Date; identityId: string; sessionToken: string }>>;
  disconnectGoogleMail: (identityId: string) => Promise<void>;
  finishGoogleMailConnect: (identityId: string, state: string, code: string) => Promise<void>;
  getGoogleMailStatus: (identityId: string) => Promise<Readonly<{ configured: boolean; connected: boolean; email?: string }>>;
  getIdentityForSession: (sessionToken: string | undefined) => Promise<Readonly<{ email: string; id: string; name?: string }> | null>;
  loginWithPassword: (input: Readonly<{ email: string; password: string }>) => Promise<Readonly<{ expiresAt: Date; identity: Identity; sessionToken: string }>>;
  registerWithPassword: (input: Readonly<{ email: string; name: string; password: string }>) => Promise<Readonly<{ expiresAt: Date; identity: Identity; sessionToken: string }>>;
  requestMagicLink: (input: Readonly<{ email: string; ipAddress: string }>) => Promise<void>;
  reserveHttpRequestRateLimit: (input: Readonly<{ ipAddress: string; sessionToken?: string }>) => Promise<Readonly<{ allowed: boolean; retryAfterSeconds: number }>>;
  reserveInvitationRateLimit: (input: Readonly<{ identityId: string; ipAddress: string }>) => Promise<boolean>;
  revokeSession: (sessionToken: string | undefined) => Promise<void>;
  sendAsGoogleMail: (identityId: string, email: OutgoingEmail) => Promise<void>;
  startGoogleMailConnect: (identityId: string, email: string) => Promise<string>;
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
  const { encryptToken, decryptToken } = createTokenEncrypter(encryptionKey);
  const hashRateKey = createRateKeyHasher(rateLimitKey);

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
    try {
      await repository.createMagicLink({ email: normalizedEmail, tokenHash: hashOpaqueSecret(token), createdAt: now, expiresAt });
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
      await repository.createSession({ identityId: identity.id, tokenHash: hashOpaqueSecret(sessionToken), createdAt: now, expiresAt });
      return Object.freeze({ identityId: identity.id, sessionToken, expiresAt });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const registerWithPassword: IdentityService["registerWithPassword"] = async ({ email, name, password }) => {
    const normalizedEmail = normalizeEmail(email);
    const trimmedName = name.trim();
    const existing = await repository.findIdentityByEmail(normalizedEmail);
    if (existing && existing.passwordHash) throw new IdentityServiceFailure("email_already_registered");
    const { hash, salt } = await hashPassword(password);
    const now = new Date();
    let identity: Identity;
    try {
      if (existing) {
        identity = await repository.setPasswordForIdentity({ identityId: existing.id, name: trimmedName, passwordHash: hash, passwordSalt: salt });
      } else {
        identity = await repository.createPasswordIdentity({ email: normalizedEmail, name: trimmedName, passwordHash: hash, passwordSalt: salt, now });
      }
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
    const sessionToken = generateSecret();
    const expiresAt = addDuration(now, identityPolicy.serverSessionLifetimeMs);
    try {
      await repository.createSession({ identityId: identity.id, tokenHash: hashOpaqueSecret(sessionToken), createdAt: now, expiresAt });
      return Object.freeze({ identity, sessionToken, expiresAt });
    } catch {
      throw new IdentityServiceFailure("storage_unavailable");
    }
  };

  const loginWithPassword: IdentityService["loginWithPassword"] = async ({ email, password }) => {
    const normalizedEmail = normalizeEmail(email);
    const record = await repository.findIdentityByEmail(normalizedEmail);
    if (!record || !record.passwordHash || !record.passwordSalt) {
      if (record && !record.passwordHash) throw new IdentityServiceFailure("password_not_set");
      throw new IdentityServiceFailure("invalid_credentials");
    }
    const valid = await verifyPassword(password, record.passwordHash, record.passwordSalt);
    if (!valid) throw new IdentityServiceFailure("invalid_credentials");
    const now = new Date();
    const sessionToken = generateSecret();
    const expiresAt = addDuration(now, identityPolicy.serverSessionLifetimeMs);
    try {
      await repository.createSession({ identityId: record.id, tokenHash: hashOpaqueSecret(sessionToken), createdAt: now, expiresAt });
      const identity: Identity = Object.freeze({
        id: record.id,
        email: record.email,
        ...(record.name ? { name: record.name } : {}),
        createdAt: record.createdAt,
        verifiedAt: record.verifiedAt
      });
      return Object.freeze({ identity, sessionToken, expiresAt });
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
      return identity ? Object.freeze({ id: identity.id, email: identity.email, ...(identity.name ? { name: identity.name } : {}) }) : null;
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
        emailLimit: 30, ipLimit: 100
      });
    } catch { throw new IdentityServiceFailure("storage_unavailable"); }
  };

  const googleMailOps = createGoogleMailOperations({
    decryptToken,
    encryptToken,
    encryptionKey,
    generateSecret,
    google,
    repository
  });

  return Object.freeze({
    reserveHttpRequestRateLimit,
    requestMagicLink,
    consumeMagicLink,
    registerWithPassword,
    loginWithPassword,
    getIdentityForSession,
    revokeSession,
    reserveInvitationRateLimit,
    ...googleMailOps
  });
};
