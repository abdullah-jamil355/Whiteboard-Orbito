export type Identity = Readonly<{ id: string; email: string; name?: string; createdAt: Date; verifiedAt: Date }>;

export type MagicLinkChallenge = Readonly<{
  id: string;
  email: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}>;

export type ServerSession = Readonly<{
  id: string;
  identityId: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}>;

export type IdentityRepository = Readonly<{
  reserveRateLimitCounter: (input: Readonly<{
    keyHash: string;
    windowStart: Date;
    expiresAt: Date;
    limit: number;
  }>) => Promise<boolean>;
  reserveApiRequestRateLimit: (input: Readonly<{
    subjectKeyHash: string;
    ipKeyHash: string;
    windowStart: Date;
    expiresAt: Date;
    subjectLimit: number;
    ipLimit: number;
  }>) => Promise<boolean>;
  reserveMagicLinkRateLimit: (input: Readonly<{
    emailKeyHash: string;
    ipKeyHash: string;
    windowStart: Date;
    expiresAt: Date;
    emailLimit: number;
    ipLimit: number;
  }>) => Promise<boolean>;
  createMagicLink: (input: Omit<MagicLinkChallenge, "id" | "consumedAt">) => Promise<void>;
  consumeMagicLink: (tokenHash: string, now: Date) => Promise<MagicLinkChallenge | null>;
  findOrCreateIdentity: (email: string, now: Date) => Promise<Identity>;
  findIdentityByEmail: (email: string) => Promise<(Identity & { passwordHash?: string | undefined; passwordSalt?: string | undefined }) | null>;
  createPasswordIdentity: (input: Readonly<{
    email: string;
    name: string;
    passwordHash: string;
    passwordSalt: string;
    now: Date;
  }>) => Promise<Identity>;
  setPasswordForIdentity: (input: Readonly<{
    identityId: string;
    name: string;
    passwordHash: string;
    passwordSalt: string;
  }>) => Promise<Identity>;
  getIdentityById: (identityId: string) => Promise<Identity | null>;
  createSession: (input: Omit<ServerSession, "id" | "revokedAt">) => Promise<void>;
  findSession: (tokenHash: string, now: Date) => Promise<ServerSession | null>;
  revokeSession: (tokenHash: string, now: Date) => Promise<void>;
  createGoogleMailState: (input: Readonly<{ stateHash: string; identityId: string; expiresAt: Date }>) => Promise<void>;
  consumeGoogleMailState: (stateHash: string, identityId: string, now: Date) => Promise<boolean>;
  saveGoogleMailAccount: (identityId: string, email: string, encryptedRefreshToken: string, connectedAt: Date) => Promise<void>;
  getGoogleMailAccount: (identityId: string) => Promise<Readonly<{ email: string; encryptedRefreshToken: string }> | null>;
  removeGoogleMailAccount: (identityId: string) => Promise<void>;
}>;

export type MagicLinkEmail = Readonly<{
  recipient: string;
  verificationUrl: string;
  expiresAt: Date;
}>;

export type IdentityMailer = Readonly<{
  sendMagicLink: (email: MagicLinkEmail) => Promise<void>;
}>;

export type InvitationEmail = Readonly<{
  ownerIdentityId: string;
  recipient: string;
  invitationUrl: string;
  sessionTitle: string;
  expiresAt: Date;
}>;

export type InvitationMailer = Readonly<{
  sendInvitation: (email: InvitationEmail) => Promise<void>;
}>;

export type IdentityServiceFailureCode =
  | "rate_limited"
  | "invalid_or_expired_link"
  | "storage_unavailable"
  | "delivery_unavailable"
  | "google_account_mismatch"
  | "email_already_registered"
  | "invalid_credentials"
  | "password_not_set";

export class IdentityServiceFailure extends Error {
  constructor(readonly code: IdentityServiceFailureCode, readonly retryAfterSeconds?: number) {
    super(code);
    this.name = "IdentityServiceFailure";
  }
}
