import mongoose from "../../integrations/mongodb/index.js";
import type { BoardSnapshot, BoardEditChange } from "./sessions.validation.js";

export const maximumPersistedBsonBytes = 8 * 1024 * 1024;

export class BoardPersistenceLimitError extends Error {
  constructor() {
    super("The board exceeds Whiteboard's safe MongoDB document limit.");
    this.name = "BoardPersistenceLimitError";
  }
}

export const persistedBoardSizeBytes = (board: BoardSnapshot): number =>
  mongoose.mongo.BSON.calculateObjectSize({ board });

export const assertBoardFitsPersistenceLimit = (board: BoardSnapshot): void => {
  if (persistedBoardSizeBytes(board) > maximumPersistedBsonBytes) throw new BoardPersistenceLimitError();
};

export const acceptedOperationSizeBytes = (input: Readonly<{
  changes: readonly BoardEditChange[];
  inverseChanges: readonly BoardEditChange[];
  guards: readonly unknown[];
  inverseGuards: readonly unknown[];
}>): number => mongoose.mongo.BSON.calculateObjectSize(input);
