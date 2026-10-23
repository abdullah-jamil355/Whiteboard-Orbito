import type { Board } from "./board";


export type BoardSession = Readonly<{
  id: string;
  ownerId: string;
  title: string;
  status: "active";
  createdAt: string;
  updatedAt: string;
  initialBoard: Board;
}>;

export type CreateBoardSessionInput = Readonly<{
  id: string;
  ownerId: string;
  title: string;
  board: Board;
  createdAt: string;
}>;

export const createBoardSession = ({
  id,
  ownerId,
  title,
  board,
  createdAt
}: CreateBoardSessionInput): BoardSession => ({
  id,
  ownerId,
  title: title.trim(),
  status: "active",
  createdAt,
  updatedAt: createdAt,
  initialBoard: structuredClone(board)
});

export const renameBoardSession = (
  session: BoardSession,
  actorId: string,
  title: string,
  updatedAt: string
): BoardSession | null => {
  if (session.status !== "active" || session.ownerId !== actorId || title.trim().length === 0) return null;
  return { ...session, title: title.trim(), updatedAt };
};

export const isBoardSessionOwner = (session: BoardSession, actorId: string): boolean =>
  session.status === "active" && session.ownerId === actorId;
