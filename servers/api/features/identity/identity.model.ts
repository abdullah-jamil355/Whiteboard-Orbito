import mongoose, { Schema, type Model, type Types } from "../../integrations/mongodb/index.js";

type IdentityRecord = Readonly<{
  email: string;
  name?: string;
  passwordHash?: string;
  passwordSalt?: string;
  createdAt: Date;
  verifiedAt: Date;
}>;
type MagicLinkRecord = Readonly<{
  email: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  deleteAt: Date;
  consumedAt: Date | null;
}>;
type RateLimitRecord = Readonly<{ keyHash: string; windowStart: Date; count: number; deleteAt: Date }>;
type SessionRecord = Readonly<{
  identityId: Types.ObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}>;
type GoogleMailStateRecord = Readonly<{ stateHash: string; identityId: Types.ObjectId; expiresAt: Date; consumedAt: Date | null }>;
type GoogleMailAccountRecord = Readonly<{ identityId: Types.ObjectId; email: string; encryptedRefreshToken: string; connectedAt: Date }>;

const identitySchema = new Schema<IdentityRecord>({
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, trim: true },
  passwordHash: { type: String },
  passwordSalt: { type: String },
  createdAt: { type: Date, required: true },
  verifiedAt: { type: Date, required: true }
}, { versionKey: false });

const magicLinkSchema = new Schema<MagicLinkRecord>({
  email: { type: String, required: true, lowercase: true, trim: true },
  tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  deleteAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null }
}, { versionKey: false });
magicLinkSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
magicLinkSchema.index({ email: 1, createdAt: -1 });

const rateLimitSchema = new Schema<RateLimitRecord>({
  keyHash: { type: String, required: true },
  windowStart: { type: Date, required: true },
  count: { type: Number, required: true, min: 0 },
  deleteAt: { type: Date, required: true }
}, { versionKey: false });
rateLimitSchema.index({ keyHash: 1, windowStart: 1 }, { unique: true });
rateLimitSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

const sessionSchema = new Schema<SessionRecord>({
  identityId: { type: Schema.Types.ObjectId, required: true, ref: "WbIdentity" },
  tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null }
}, { versionKey: false });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ identityId: 1, revokedAt: 1 });

const googleMailStateSchema = new Schema<GoogleMailStateRecord>({
  stateHash: { type: String, required: true, unique: true },
  identityId: { type: Schema.Types.ObjectId, required: true, ref: "WbIdentity" },
  expiresAt: { type: Date, required: true },
  consumedAt: { type: Date, default: null }
}, { versionKey: false });
googleMailStateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const googleMailAccountSchema = new Schema<GoogleMailAccountRecord>({
  identityId: { type: Schema.Types.ObjectId, required: true, unique: true, ref: "WbIdentity" },
  email: { type: String, required: true, lowercase: true, trim: true },
  encryptedRefreshToken: { type: String, required: true },
  connectedAt: { type: Date, required: true }
}, { versionKey: false });

export const WbIdentityModel: Model<IdentityRecord> =
  (mongoose.models.WbIdentity as Model<IdentityRecord> | undefined) ?? mongoose.model<IdentityRecord>("WbIdentity", identitySchema);
export const WbMagicLinkModel: Model<MagicLinkRecord> =
  (mongoose.models.WbMagicLink as Model<MagicLinkRecord> | undefined) ?? mongoose.model<MagicLinkRecord>("WbMagicLink", magicLinkSchema);
export const WbMagicLinkRateLimitModel: Model<RateLimitRecord> =
  (mongoose.models.WbMagicLinkRateLimit as Model<RateLimitRecord> | undefined) ?? mongoose.model<RateLimitRecord>("WbMagicLinkRateLimit", rateLimitSchema);
export const WbSessionModel: Model<SessionRecord> =
  (mongoose.models.WbSession as Model<SessionRecord> | undefined) ?? mongoose.model<SessionRecord>("WbSession", sessionSchema);
export const WbGoogleMailStateModel: Model<GoogleMailStateRecord> =
  (mongoose.models.WbGoogleMailState as Model<GoogleMailStateRecord> | undefined) ?? mongoose.model<GoogleMailStateRecord>("WbGoogleMailState", googleMailStateSchema);
export const WbGoogleMailAccountModel: Model<GoogleMailAccountRecord> =
  (mongoose.models.WbGoogleMailAccount as Model<GoogleMailAccountRecord> | undefined) ?? mongoose.model<GoogleMailAccountRecord>("WbGoogleMailAccount", googleMailAccountSchema);
