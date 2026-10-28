import { isObjectIdString, objectIdFromString, objectIdToString, type MongoObjectId } from "../../integrations/mongodb/index.js";
import type { Identity, IdentityRepository, MagicLinkChallenge, ServerSession } from "./identity.contracts.js";
import { identityPolicy } from "./identity.rules.js";
import { WbGoogleMailAccountModel, WbGoogleMailStateModel, WbIdentityModel, WbMagicLinkModel, WbMagicLinkRateLimitModel, WbSessionModel } from "./identity.model.js";

const mapIdentity = (record: { _id: MongoObjectId; email: string; name?: string; createdAt: Date; verifiedAt: Date }): Identity =>
  Object.freeze({
    id: objectIdToString(record._id),
    email: record.email,
    ...(record.name ? { name: record.name } : {}),
    createdAt: record.createdAt,
    verifiedAt: record.verifiedAt
  });

const mapChallenge = (record: {
  _id: MongoObjectId;
  email: string;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  consumedAt: Date | null;
}): MagicLinkChallenge => Object.freeze({
  id: objectIdToString(record._id),
  email: record.email,
  tokenHash: record.tokenHash,
  createdAt: record.createdAt,
  expiresAt: record.expiresAt,
  consumedAt: record.consumedAt
});

const mapSession = (record: {
  _id: MongoObjectId;
  identityId: MongoObjectId;
  tokenHash: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}): ServerSession => Object.freeze({
  id: objectIdToString(record._id),
  identityId: objectIdToString(record.identityId),
  tokenHash: record.tokenHash,
  createdAt: record.createdAt,
  expiresAt: record.expiresAt,
  revokedAt: record.revokedAt
});

const reserveRateLimitCounter: IdentityRepository["reserveRateLimitCounter"] = async ({ keyHash, windowStart, expiresAt, limit }) => {
  try {
    await WbMagicLinkRateLimitModel.findOneAndUpdate(
      { keyHash, windowStart, count: { $lt: limit } },
      { $inc: { count: 1 }, $setOnInsert: { keyHash, windowStart, deleteAt: expiresAt } },
      { upsert: true, returnDocument: "after" }
    ).exec();
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11_000) return false;
    throw error;
  }
};

export const createIdentityRepository = (): IdentityRepository => Object.freeze({
  reserveRateLimitCounter,
  reserveApiRequestRateLimit: async ({ subjectKeyHash, ipKeyHash, windowStart, expiresAt, subjectLimit, ipLimit }) => {
    const releaseSubjectCounter = (): Promise<unknown> => WbMagicLinkRateLimitModel.updateOne(
      { keyHash: subjectKeyHash, windowStart, count: { $gt: 0 } },
      { $inc: { count: -1 } }
    ).exec();
    if (!await reserveRateLimitCounter({ keyHash: subjectKeyHash, windowStart, expiresAt, limit: subjectLimit })) return false;
    try {
      if (await reserveRateLimitCounter({ keyHash: ipKeyHash, windowStart, expiresAt, limit: ipLimit })) return true;
      await releaseSubjectCounter();
      return false;
    } catch (error) {
      await releaseSubjectCounter();
      throw error;
    }
  },
  reserveMagicLinkRateLimit: async ({ emailKeyHash, ipKeyHash, windowStart, expiresAt, emailLimit, ipLimit }) => {
    const release = (keyHash: string): Promise<unknown> => WbMagicLinkRateLimitModel.updateOne(
      { keyHash, windowStart, count: { $gt: 0 } },
      { $inc: { count: -1 } }
    ).exec();

    if (!await reserveRateLimitCounter({ keyHash: emailKeyHash, windowStart, expiresAt, limit: emailLimit })) return false;
    if (await reserveRateLimitCounter({ keyHash: ipKeyHash, windowStart, expiresAt, limit: ipLimit })) return true;
    await release(emailKeyHash);
    return false;
  },
  createMagicLink: async (input) => {
    await WbMagicLinkModel.create({
      ...input,
      deleteAt: new Date(input.createdAt.getTime() + identityPolicy.rateLimitRecordRetentionMs),
      consumedAt: null
    });
  },
  consumeMagicLink: async (tokenHash, now) => {
    const record = await WbMagicLinkModel.findOneAndUpdate(
      { tokenHash, consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: "before" }
    ).exec();
    return record ? mapChallenge(record) : null;
  },
  findOrCreateIdentity: async (email, now) => {
    try {
      const record = await WbIdentityModel.findOneAndUpdate(
        { email },
        { $setOnInsert: { email, createdAt: now, verifiedAt: now } },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      ).exec();
      return mapIdentity(record);
    } catch (error) {
      if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 11_000) throw error;
      const existing = await WbIdentityModel.findOne({ email }).exec();
      if (!existing) throw error;
      return mapIdentity(existing);
    }
  },
  findIdentityByEmail: async (email) => {
    const record = await WbIdentityModel.findOne({ email }).exec();
    if (!record) return null;
    return Object.freeze({
      ...mapIdentity(record),
      passwordHash: record.passwordHash,
      passwordSalt: record.passwordSalt
    });
  },
  createPasswordIdentity: async ({ email, name, passwordHash, passwordSalt, now }) => {
    const record = await WbIdentityModel.create({
      email,
      name,
      passwordHash,
      passwordSalt,
      createdAt: now,
      verifiedAt: now
    });
    return mapIdentity(record);
  },
  getIdentityById: async (identityId) => {
    if (!isObjectIdString(identityId)) return null;
    const record = await WbIdentityModel.findOne({ _id: objectIdFromString(identityId), verifiedAt: { $type: "date" } }).exec();
    return record ? mapIdentity(record) : null;
  },
  createSession: async ({ identityId, tokenHash, createdAt, expiresAt }) => {
    if (!isObjectIdString(identityId)) throw new Error("Invalid identity ID.");
    await WbSessionModel.create({
      identityId: objectIdFromString(identityId),
      tokenHash,
      createdAt,
      expiresAt,
      revokedAt: null
    });
  },
  findSession: async (tokenHash, now) => {
    const record = await WbSessionModel.findOne({ tokenHash, revokedAt: null, expiresAt: { $gt: now } }).exec();
    return record ? mapSession(record) : null;
  },
  revokeSession: async (tokenHash, now) => {
    await WbSessionModel.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: now } }).exec();
  },
  createGoogleMailState: async ({ stateHash, identityId, expiresAt }) => {
    await WbGoogleMailStateModel.create({ stateHash, identityId, expiresAt, consumedAt: null });
  },
  consumeGoogleMailState: async (stateHash, identityId, now) => {
    const state = await WbGoogleMailStateModel.findOneAndUpdate(
      { stateHash, identityId, consumedAt: null, expiresAt: { $gt: now } },
      { $set: { consumedAt: now } },
      { returnDocument: "before" }
    ).exec();
    return state !== null;
  },
  saveGoogleMailAccount: async (identityId, email, encryptedRefreshToken, connectedAt) => {
    await WbGoogleMailAccountModel.updateOne(
      { identityId },
      { $set: { identityId, email, encryptedRefreshToken, connectedAt } },
      { upsert: true }
    ).exec();
  },
  getGoogleMailAccount: async (identityId) => {
    const record = await WbGoogleMailAccountModel.findOne({ identityId }).exec();
    return record ? Object.freeze({ email: record.email, encryptedRefreshToken: record.encryptedRefreshToken }) : null;
  },
  removeGoogleMailAccount: async (identityId) => {
    await WbGoogleMailAccountModel.deleteOne({ identityId }).exec();
  }
});

export const ensureIdentityIndexes = async (): Promise<void> => {
  await Promise.all([
    WbIdentityModel.createIndexes(),
    WbMagicLinkModel.createIndexes(),
    WbMagicLinkRateLimitModel.createIndexes(),
    WbSessionModel.createIndexes(),
    WbGoogleMailStateModel.createIndexes(),
    WbGoogleMailAccountModel.createIndexes()
  ]);
};
