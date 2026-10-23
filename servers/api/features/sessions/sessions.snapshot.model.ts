import mongoose, { Schema, type Model, type Types } from "../../integrations/mongodb/index.js";
import type { BoardSnapshot } from "./sessions.validation.js";

type SnapshotRecord = Readonly<{ sessionId: Types.ObjectId; sequence: number; board: BoardSnapshot; createdAt: Date }>;

const snapshotSchema = new Schema<SnapshotRecord>({
  sessionId: { type: Schema.Types.ObjectId, required: true, ref: "WbBoardSession" },
  sequence: { type: Number, required: true, min: 0 },
  board: { type: Schema.Types.Mixed, required: true },
  createdAt: { type: Date, required: true }
}, { versionKey: false });
snapshotSchema.index({ sessionId: 1, sequence: 1 }, { unique: true });

export const WbBoardSnapshotModel: Model<SnapshotRecord> =
  (mongoose.models.WbBoardSnapshot as Model<SnapshotRecord> | undefined) ?? mongoose.model<SnapshotRecord>("WbBoardSnapshot", snapshotSchema);
