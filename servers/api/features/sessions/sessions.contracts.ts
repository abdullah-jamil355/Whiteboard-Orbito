import type { BoardEditCommand, BoardSnapshot, CreateSessionInput } from "./sessions.validation.js";
import type { WhiteboardHistoryState } from "@workspace/types";

export type BoardSession = Readonly<{
  id: string;
  ownerIdentityId: string;
  title: string;
  status: "active" | "ended";
  board: BoardSnapshot;
  sequence: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt: Date | null;
}>;
export type ActiveBoardSession = Readonly<{ id: string; title: string; sequence: number; updatedAt: Date }>;
export type ActiveConnection = Readonly<{ identityId: string; connectionId: string; leaseExpiresAt: Date }>;
export type AppliedBoardEdit = Readonly<{ actionId: string; board: BoardSnapshot; sequence: number; history: WhiteboardHistoryState }>;
export type BoardHistoryAction = "undo" | "redo";
export class BoardEditRejected extends Error {
  constructor(readonly reason: "invalid" | "future_sequence" | "action_conflict" | "history_unavailable" | "unsafe_inverse" | "document_too_large") { super(reason); this.name = "BoardEditRejected"; }
}

export type SessionRepository = Readonly<{
  create: (input: CreateSessionInput & Readonly<{ ownerIdentityId: string; now: Date }>) => Promise<BoardSession>;
  findById: (sessionId: string) => Promise<BoardSession | null>;
  findActiveForMember: (identityId: string) => Promise<readonly ActiveBoardSession[]>;
  rename: (sessionId: string, ownerIdentityId: string, title: string, now: Date) => Promise<BoardSession | null>;
  end: (sessionId: string, ownerIdentityId: string, now: Date, expectedSequence?: number) => Promise<BoardSession | null>;
  deleteEndedSession: (sessionId: string, ownerIdentityId: string) => Promise<void>;
}>;
export type RealtimeSessionRepository = SessionRepository & Readonly<{
  applyEdit: (sessionId: string, actorIdentityId: string, command: BoardEditCommand, now: Date) => Promise<AppliedBoardEdit | null>;
  applyHistoryAction: (sessionId: string, actorIdentityId: string, actionId: string, action: BoardHistoryAction, now: Date) => Promise<AppliedBoardEdit | null>;
  getHistoryState: (sessionId: string) => Promise<WhiteboardHistoryState>;
  claimConnection: (sessionId: string, identityId: string, connectionId: string, now: Date, leaseExpiresAt: Date) => Promise<boolean>;
  refreshConnection: (sessionId: string, connectionId: string, leaseExpiresAt: Date) => Promise<boolean>;
  releaseConnection: (sessionId: string, connectionId: string) => Promise<void>;
}>;

export type SessionFailureCode = "not_found" | "storage_unavailable" | "revision_changed" | "board_too_large";
export class SessionFailure extends Error {
  constructor(readonly code: SessionFailureCode) {
    super(code);
    this.name = "SessionFailure";
  }
}
