import mongoose, { Schema, type Model, type Types } from "../../integrations/mongodb/index.js";

type HistoryRecord = Readonly<{
  sessionId: Types.ObjectId;
  undoActionIds: readonly string[];
  redoActionIds: readonly string[];
  updatedAt: Date;
}>;

const historySchema = new Schema<HistoryRecord>({
  sessionId: { type: Schema.Types.ObjectId, required: true, ref: "WbBoardSession", unique: true },
  undoActionIds: { type: [String], required: true, default: [] },
  redoActionIds: { type: [String], required: true, default: [] },
  updatedAt: { type: Date, required: true }
}, { versionKey: false });

export const WbBoardHistoryModel: Model<HistoryRecord> =
  (mongoose.models.WbBoardHistory as Model<HistoryRecord> | undefined) ?? mongoose.model<HistoryRecord>("WbBoardHistory", historySchema);
