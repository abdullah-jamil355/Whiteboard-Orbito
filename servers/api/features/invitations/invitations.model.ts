import mongoose, { Schema, type Model, type Types } from "../../integrations/mongodb/index.js";
import type { InvitationRole } from "./invitations.contracts.js";

type InvitationRecord = Readonly<{
  sessionId: Types.ObjectId; recipientEmail: string; role: InvitationRole; tokenHash: string;
  createdAt: Date; expiresAt: Date; deleteAt: Date; canceledAt: Date | null; acceptedAt: Date | null;
  acceptedIdentityId: Types.ObjectId | null; displayName: string | null;
}>;
const schema = new Schema<InvitationRecord>({
  sessionId: { type: Schema.Types.ObjectId, required: true, ref: "WbBoardSession" },
  recipientEmail: { type: String, required: true, lowercase: true, trim: true },
  role: { type: String, enum: ["editor", "viewer"], required: true }, tokenHash: { type: String, required: true, unique: true },
  createdAt: { type: Date, required: true }, expiresAt: { type: Date, required: true }, deleteAt: { type: Date, required: true },
  canceledAt: { type: Date, default: null }, acceptedAt: { type: Date, default: null },
  acceptedIdentityId: { type: Schema.Types.ObjectId, default: null, ref: "WbIdentity" }, displayName: { type: String, default: null }
}, { versionKey: false });
schema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
schema.index({ sessionId: 1, createdAt: -1 });
schema.index({ sessionId: 1, acceptedIdentityId: 1 }, { unique: true, partialFilterExpression: { acceptedAt: { $type: "date" }, canceledAt: null } });
export const WbInvitationModel: Model<InvitationRecord> =
  (mongoose.models.WbInvitation as Model<InvitationRecord> | undefined) ?? mongoose.model<InvitationRecord>("WbInvitation", schema);
