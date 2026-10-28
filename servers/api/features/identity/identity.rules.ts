import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export const identityPolicy = Object.freeze({
  magicLinkLifetimeMs: 10 * 60 * 1000,
  magicLinkRateLimitWindowMs: 15 * 60 * 1000,
  magicLinkMaxPerEmail: 5,
  magicLinkMaxPerIp: 60,
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

export const hashPassword = async (
  password: string,
  salt = randomBytes(16).toString("hex")
): Promise<{ hash: string; salt: string }> => {
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  return { hash: derivedKey.toString("hex"), salt };
};

export const verifyPassword = async (
  password: string,
  hash: string,
  salt: string
): Promise<boolean> => {
  const derivedKey = (await scryptAsync(password, salt, 64)) as Buffer;
  const hashBuffer = Buffer.from(hash, "hex");
  if (derivedKey.length !== hashBuffer.length) return false;
  return timingSafeEqual(derivedKey, hashBuffer);
};
