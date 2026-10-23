import { createHash, randomBytes } from "node:crypto";

export const identityPolicy = Object.freeze({
  magicLinkLifetimeMs: 10 * 60 * 1000,
  magicLinkRateLimitWindowMs: 15 * 60 * 1000,
  magicLinkMaxPerEmail: 3,
  magicLinkMaxPerIp: 10,
  apiRequestRateLimitWindowMs: 60 * 1000,
  apiRequestsPerSubject: 300,
  apiRequestsPerIp: 1_800,
  rateLimitRecordRetentionMs: 60 * 60 * 1000,
  serverSessionLifetimeMs: 7 * 24 * 60 * 60 * 1000,
  opaqueSecretBytes: 32
});

export type SecretGenerator = (size: number) => Buffer;

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const createOpaqueSecret = (
  generateBytes: SecretGenerator = randomBytes
): string => generateBytes(identityPolicy.opaqueSecretBytes).toString("base64url");

export const hashOpaqueSecret = (secret: string): string =>
  createHash("sha256").update(secret, "utf8").digest("hex");

export type OneTimeCredentialState = Readonly<{
  expiresAt: Date;
  consumedAt: Date | null;
  revokedAt?: Date | null;
}>;

export const isCredentialUsable = (
  credential: OneTimeCredentialState,
  now: Date
): boolean => credential.consumedAt === null
  && (credential.revokedAt === undefined || credential.revokedAt === null)
  && credential.expiresAt.getTime() > now.getTime();

export const addDuration = (now: Date, durationMs: number): Date =>
  new Date(now.getTime() + durationMs);
