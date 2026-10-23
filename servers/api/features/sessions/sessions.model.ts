import mongoose, { Schema, type Model, type Types } from "../../integrations/mongodb/index.js";
import type { BoardSnapshot } from "./sessions.validation.js";

type SessionRecord = Readonly<{
  ownerIdentityId: Types.ObjectId;
  memberIdentityIds: readonly Types.ObjectId[];
  title: string;
  status: "active" | "ended";
  board: BoardSnapshot;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
  activeConnections: readonly Readonly<{ identityId: Types.ObjectId; connectionId: string; leaseExpiresAt: Date }>[];
}>;

const sessionSchema = new Schema<SessionRecord>({
  ownerIdentityId: { type: Schema.Types.ObjectId, required: true, ref: "WbIdentity", index: true },
  memberIdentityIds: { type: [{ type: Schema.Types.ObjectId, required: true, ref: "WbIdentity" }], required: true, default: [] },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  status: { type: String, enum: ["active", "ended"], required: true },
  board: { type: Schema.Types.Mixed, required: true },
  sequence: { type: Number, required: true, default: 0, min: 0 },
  createdAt: { type: Date, required: true },
  updatedAt: { type: Date, required: true },
  endedAt: { type: Date, default: null },
  activeConnections: { type: [{ identityId: { type: Schema.Types.ObjectId, required: true }, connectionId: { type: String, required: true }, leaseExpiresAt: { type: Date, required: true } }], default: [] }
}, { versionKey: false });
sessionSchema.index({ ownerIdentityId: 1, updatedAt: -1 });
sessionSchema.index({ memberIdentityIds: 1, status: 1, updatedAt: -1 });

export const WbBoardSessionModel: Model<SessionRecord> =
  (mongoose.models.WbBoardSession as Model<SessionRecord> | undefined) ?? mongoose.model<SessionRecord>("WbBoardSession", sessionSchema);
