import mongoose, { isObjectIdString, objectIdFromString, objectIdToString, type MongoObjectId } from "../../integrations/mongodb/index.js";
import { InvitationCapacityError, InvitationMembershipExistsError, type BoardInvitation, type RealtimeInvitationRepository } from "./invitations.contracts.js";
import { WbInvitationModel } from "./invitations.model.js";
import { WbBoardSessionModel } from "../sessions/public.js";

const maxSessionMembers = 25;

type RecordShape = { _id: MongoObjectId; sessionId: MongoObjectId; recipientEmail: string; role: BoardInvitation["role"]; tokenHash: string; createdAt: Date; expiresAt: Date; canceledAt: Date | null; acceptedAt: Date | null; acceptedIdentityId: MongoObjectId | null; displayName: string | null };
const map = (r: RecordShape): BoardInvitation => Object.freeze({ id: objectIdToString(r._id), sessionId: objectIdToString(r.sessionId), recipientEmail: r.recipientEmail, role: r.role, tokenHash: r.tokenHash, createdAt: r.createdAt, expiresAt: r.expiresAt, canceledAt: r.canceledAt, acceptedAt: r.acceptedAt, acceptedIdentityId: r.acceptedIdentityId ? objectIdToString(r.acceptedIdentityId) : null, displayName: r.displayName });
export const createInvitationRepository = (): RealtimeInvitationRepository => Object.freeze({
  create: async (input) => map(await WbInvitationModel.create({ ...input, sessionId: objectIdFromString(input.sessionId), acceptedIdentityId: null, displayName: null, deleteAt: input.expiresAt })),
  findPending: async (sessionId, now) => {
    const records = await WbInvitationModel.find({ sessionId: objectIdFromString(sessionId), acceptedAt: null, canceledAt: null, expiresAt: { $gt: now } }).sort({ createdAt: -1 }).limit(100).exec();
    return Object.freeze(records.map((record) => map(record)));
  },
  findUsable: async (tokenHash, email, now) => {
    const record = await WbInvitationModel.findOne({ tokenHash, recipientEmail: email, acceptedAt: null, canceledAt: null, expiresAt: { $gt: now } }).exec();
    return record ? map(record) : null;
  },
  cancel: async (sessionId, invitationId, now) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(invitationId)) return null;
    const record = await WbInvitationModel.findOneAndUpdate({ _id: objectIdFromString(invitationId), sessionId: objectIdFromString(sessionId), canceledAt: null, acceptedAt: null, expiresAt: { $gt: now } }, { $set: { canceledAt: now } }, { returnDocument: "after" }).exec();
    return record ? map(record) : null;
  },
  accept: async (tokenHash, identityId, email, displayName, now) => {
    if (!isObjectIdString(identityId)) return null;
    const identity = objectIdFromString(identityId);
    const transaction = await mongoose.startSession();
    try {
      let accepted: BoardInvitation | null = null;
      await transaction.withTransaction(async () => {
        const record = await WbInvitationModel.findOneAndUpdate({ tokenHash, recipientEmail: email, acceptedAt: null, canceledAt: null, expiresAt: { $gt: now } }, { $set: { acceptedAt: now, acceptedIdentityId: identity, displayName }, $unset: { deleteAt: "" } }, { returnDocument: "before", session: transaction }).exec();
        if (!record) return;
        const membership = await WbBoardSessionModel.updateOne({ _id: record.sessionId, status: "active", memberIdentityIds: { $ne: identity }, $expr: { $lt: [{ $size: { $ifNull: ["$memberIdentityIds", []] } }, maxSessionMembers] } }, { $addToSet: { memberIdentityIds: identity } }, { session: transaction }).exec();
        if (membership.modifiedCount !== 1) {
          const alreadyMember = await WbBoardSessionModel.exists({ _id: record.sessionId, memberIdentityIds: identity }).session(transaction);
          if (alreadyMember) throw new InvitationMembershipExistsError();
          throw new InvitationCapacityError();
        }
        accepted = map(record);
      });
      return accepted;
    } finally { await transaction.endSession(); }
  },
  hasMembership: async (sessionId, identityId) => isObjectIdString(sessionId) && isObjectIdString(identityId) && Boolean(await WbInvitationModel.exists({ sessionId: objectIdFromString(sessionId), acceptedIdentityId: objectIdFromString(identityId), acceptedAt: { $type: "date" }, canceledAt: null })),
  listMembers: async (sessionId) => {
    if (!isObjectIdString(sessionId)) return Object.freeze([]);
    const records = await WbInvitationModel.find({ sessionId: objectIdFromString(sessionId), acceptedAt: { $type: "date" }, canceledAt: null }).sort({ acceptedAt: 1 }).lean().exec();
    return Object.freeze(records.flatMap((record) => record.acceptedIdentityId
      ? [Object.freeze({ identityId: objectIdToString(record.acceptedIdentityId), email: record.recipientEmail, role: record.role, displayName: record.displayName ?? record.recipientEmail })]
      : []));
  },
  revokeMember: async (sessionId, identityId, now) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(identityId)) return null;
    const sessionObjectId = objectIdFromString(sessionId);
    const memberObjectId = objectIdFromString(identityId);
    const transaction = await mongoose.startSession();
    try {
      const revoked = await transaction.withTransaction(async () => {
        const session = await WbBoardSessionModel.findOne({ _id: sessionObjectId, status: "active", ownerIdentityId: { $ne: memberObjectId }, memberIdentityIds: memberObjectId }).session(transaction).lean().exec();
        if (!session) return null;
        const record = await WbInvitationModel.findOneAndUpdate({ sessionId: sessionObjectId, acceptedIdentityId: memberObjectId, acceptedAt: { $type: "date" }, canceledAt: null }, { $set: { canceledAt: now } }, { returnDocument: "before", session: transaction }).exec();
        if (!record) return null;
        const removed = await WbBoardSessionModel.updateOne({ _id: sessionObjectId, status: "active", ownerIdentityId: { $ne: memberObjectId }, memberIdentityIds: memberObjectId }, { $pull: { memberIdentityIds: memberObjectId, activeConnections: { identityId: memberObjectId } } }, { session: transaction }).exec();
        if (removed.modifiedCount !== 1) throw new Error("Member revocation lost its session membership race.");
        return map({ ...record.toObject(), canceledAt: now });
      });
      return revoked ? Object.freeze({ identityId, email: revoked.recipientEmail, role: revoked.role, displayName: revoked.displayName ?? revoked.recipientEmail }) : null;
    } finally { await transaction.endSession(); }
  },
  deleteSessionInvitations: async (sessionId) => {
    if (!isObjectIdString(sessionId)) return;
    await WbInvitationModel.deleteMany({ sessionId: objectIdFromString(sessionId) }).exec();
  },
  findMembership: async (sessionId, identityId) => {
    if (!isObjectIdString(sessionId) || !isObjectIdString(identityId)) return null;
    const record = await WbInvitationModel.findOne({ sessionId: objectIdFromString(sessionId), acceptedIdentityId: objectIdFromString(identityId), acceptedAt: { $type: "date" }, canceledAt: null }).exec();
    return record ? Object.freeze({ identityId, role: record.role, displayName: record.displayName ?? record.recipientEmail }) : null;
  }
});
export const ensureInvitationIndexes = async (): Promise<void> => {
  await WbInvitationModel.updateMany({ acceptedAt: { $type: "date" }, deleteAt: { $exists: true } }, { $unset: { deleteAt: "" } }).exec();
  await WbInvitationModel.createIndexes();
};
