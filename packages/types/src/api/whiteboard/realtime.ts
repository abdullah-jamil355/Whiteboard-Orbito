export type WhiteboardEditChange =
  | Readonly<{ kind: "board.title"; value: string }>
  | Readonly<{ kind: "board.template"; value: string }>
  | Readonly<{ kind: "object.add"; object: unknown }>
  | Readonly<{ kind: "object.remove"; objectId: string }>
  | Readonly<{ kind: "object.set"; objectId: string; property: "geometry.x" | "geometry.y" | "geometry.width" | "geometry.height" | "style.fill" | "style.stroke" | "style.lineWeight" | "text" | "alignment" | "fontSize" | "bold" | "italic" | "underline" | "stickyNote" | "color" | "points" | "start" | "end" | "parentShapeId" | "startArrow" | "endArrow" | "routing" | "waypoints"; value: unknown }>
  | Readonly<{ kind: "objects.order"; objectIds: readonly string[] }>;

export type WhiteboardEditCommand = Readonly<{
  actionId: string;
  baseSequence: number;
  changes: readonly WhiteboardEditChange[];
}>;

export type WhiteboardRealtimeClientMessage =
  | Readonly<{ type: "board:sync" }>
  | Readonly<{ type: "board:edit"; command: WhiteboardEditCommand }>
  | Readonly<{ type: "board:undo"; actionId: string }>
  | Readonly<{ type: "board:redo"; actionId: string }>;

export type WhiteboardHistoryState = Readonly<{ canUndo: boolean; canRedo: boolean }>;

export type WhiteboardRealtimeServerMessage =
  | Readonly<{ type: "board:state"; board: unknown; sequence: number; actionId?: string; actorIdentityId?: string; history?: WhiteboardHistoryState }>
  | Readonly<{ type: "session:state"; role: "owner" | "editor" | "viewer"; ownerConnected: boolean }>
  | Readonly<{ type: "session:presence"; ownerConnected: boolean }>
  | Readonly<{ type: "session:ended" }>
  | Readonly<{ type: "board:rejected"; actionId?: string; reason: "invalid_message" | "invalid" | "future_sequence" | "action_conflict" | "forbidden" | "rate_limited" | "storage_unavailable" | "history_unavailable" | "unsafe_inverse" | "document_too_large" }>;
