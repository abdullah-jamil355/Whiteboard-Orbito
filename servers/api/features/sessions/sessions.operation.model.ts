import mongoose, { Schema, type Model, type Types } from "../../integrations/mongodb/index.js";
import type { BoardEditChange } from "./sessions.validation.js";
import type { BoardHistoryGuard } from "./sessions.history.js";

type OperationRecord = Readonly<{
  sessionId: Types.ObjectId;
  sequence: number;
  actionId: string;
  actorIdentityId: Types.ObjectId;
  baseSequence: number;
  changes: readonly BoardEditChange[];
  historyKind?: "edit" | "undo" | "redo";
  targetActionId?: string;
  inverseChanges?: readonly BoardEditChange[];
  guards?: readonly BoardHistoryGuard[];
  inverseGuards?: readonly BoardHistoryGuard[];
  createdAt: Date;
}>;

const operationSchema = new Schema<OperationRecord>({
  sessionId: { type: Schema.Types.ObjectId, required: true, ref: "WbBoardSession" },
  sequence: { type: Number, required: true, min: 1 },
  actionId: { type: String, required: true, maxlength: 36 },
  actorIdentityId: { type: Schema.Types.ObjectId, required: true, ref: "WbIdentity" },
  baseSequence: { type: Number, required: true, min: 0 },
  changes: { type: [Schema.Types.Mixed], required: true },
  historyKind: { type: String, enum: ["edit", "undo", "redo"], required: false },
  targetActionId: { type: String, maxlength: 36, required: false },
  inverseChanges: { type: [Schema.Types.Mixed], required: false },
  guards: { type: [Schema.Types.Mixed], required: false },
  inverseGuards: { type: [Schema.Types.Mixed], required: false },
  createdAt: { type: Date, required: true }
}, { versionKey: false });
operationSchema.index({ sessionId: 1, sequence: 1 }, { unique: true });
operationSchema.index({ sessionId: 1, actionId: 1 }, { unique: true });

export const WbBoardOperationModel: Model<OperationRecord> =
  (mongoose.models.WbBoardOperation as Model<OperationRecord> | undefined) ?? mongoose.model<OperationRecord>("WbBoardOperation", operationSchema);
