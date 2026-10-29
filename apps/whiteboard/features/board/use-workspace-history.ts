"use client";

import { useCallback, useState } from "react";
import {
  applyBoardHistorySnapshot,
  type Board,
  type BoardHistoryEdit,
  type BoardSession
} from "@workspace/whiteboard";

export type BoardHistory = Readonly<{
  future: readonly BoardHistoryEdit[];
  past: readonly BoardHistoryEdit[];
}>;

type UseWorkspaceHistoryProps = Readonly<{
  activeSession: BoardSession | null;
  board: Board;
  realtime: {
    historyBusy: boolean;
    queuedEditCount: number;
    redoShared: () => void;
    role: string | null;
    sharedHistory: { canRedo: boolean; canUndo: boolean };
    status: string;
    undoShared: () => void;
  };
  setBoard: (nextBoard: Board) => void;
}>;

export const useWorkspaceHistory = ({
  activeSession,
  board,
  realtime,
  setBoard
}: UseWorkspaceHistoryProps) => {
  const [boardHistory, setBoardHistory] = useState<BoardHistory>({ past: [], future: [] });

  const resetBoardHistory = useCallback((): void => {
    setBoardHistory({ past: [], future: [] });
  }, []);

  const undoEdit = useCallback((): void => {
    if (activeSession !== null) {
      realtime.undoShared();
      return;
    }
    const action = boardHistory.past.at(-1);
    if (action === undefined) return;
    setBoard(applyBoardHistorySnapshot(board, action, "before"));
    setBoardHistory((current) => ({
      past: current.past.slice(0, -1),
      future: [action, ...current.future]
    }));
  }, [activeSession, board, boardHistory.past, realtime, setBoard]);

  const redoEdit = useCallback((): void => {
    if (activeSession !== null) {
      realtime.redoShared();
      return;
    }
    const action = boardHistory.future[0];
    if (action === undefined) return;
    const unaffectedIds = new Set(
      board.objects
        .filter((object) => !action.affectedIds.includes(object.id))
        .map((object) => object.id)
    );
    if (action.after.some(({ object }) => unaffectedIds.has(object.id))) return;
    setBoard(applyBoardHistorySnapshot(board, action, "after"));
    setBoardHistory((current) => ({
      past: [...current.past, action],
      future: current.future.slice(1)
    }));
  }, [activeSession, board, boardHistory.future, realtime, setBoard]);

  const canUndo = activeSession === null
    ? boardHistory.past.length > 0
    : realtime.status === "connected" &&
      realtime.role !== "viewer" &&
      realtime.sharedHistory.canUndo &&
      realtime.queuedEditCount === 0 &&
      !realtime.historyBusy;

  const canRedo = activeSession === null
    ? boardHistory.future.length > 0
    : realtime.status === "connected" &&
      realtime.role !== "viewer" &&
      realtime.sharedHistory.canRedo &&
      realtime.queuedEditCount === 0 &&
      !realtime.historyBusy;

  return {
    boardHistory,
    canRedo,
    canUndo,
    redoEdit,
    resetBoardHistory,
    setBoardHistory,
    undoEdit
  };
};
