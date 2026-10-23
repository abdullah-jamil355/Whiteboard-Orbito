import type { WhiteboardEditCommand } from "@workspace/types";

export type PendingEdit = Readonly<{ command: WhiteboardEditCommand; blocked: boolean; createdAt: number }>;

export const nextQueuedEdit = (queue: readonly PendingEdit[]): PendingEdit | null => {
  const first = queue[0];
  return first === undefined || first.blocked ? null : first;
};

export const queueStorageKey = (sessionId: string): string => `wb_pending_edits:${sessionId}`;
export const cacheStorageKey = (sessionId: string): string => `wb_server_board:${sessionId}`;
export const maximumQueueEntries = 500;
export const maximumQueueBytes = 1_000_000;
export const maximumQueueAgeMs = 7 * 24 * 60 * 60 * 1000;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const actionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const editKinds = new Set(["board.title", "board.template", "object.add", "object.remove", "object.set", "objects.order"]);
const editProperties = new Set(["geometry.x", "geometry.y", "geometry.width", "geometry.height", "style.fill", "style.stroke", "style.lineWeight", "text", "alignment", "fontSize", "bold", "italic", "underline", "stickyNote", "color", "points", "start", "end", "parentShapeId", "startArrow", "endArrow", "routing", "waypoints"]);

const isQueuedEdit = (value: unknown): value is PendingEdit => {
  if (!isRecord(value) || typeof value.blocked !== "boolean" || typeof value.createdAt !== "number" || !Number.isSafeInteger(value.createdAt) || value.createdAt < 0 || !isRecord(value.command)) return false;
  const { actionId, baseSequence, changes } = value.command;
  return typeof actionId === "string" && actionIdPattern.test(actionId)
    && typeof baseSequence === "number" && Number.isSafeInteger(baseSequence) && baseSequence >= 0
    && Array.isArray(changes) && changes.length > 0 && changes.length <= 512
    && changes.every((change) => isRecord(change) && typeof change.kind === "string" && editKinds.has(change.kind)
      && (change.kind !== "object.set" || (typeof change.property === "string" && editProperties.has(change.property))));
};

export const readQueue = (sessionId: string): PendingEdit[] => {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(queueStorageKey(sessionId)) ?? "[]");
    if (!Array.isArray(value)) return [];
    const now = Date.now();
    return value.flatMap((entry) => {
      const compatible = isRecord(entry) && isRecord(entry.command) && typeof entry.blocked === "boolean" && entry.createdAt === undefined
        ? { ...entry, createdAt: now }
        : entry;
      if (!isQueuedEdit(compatible)) return [];
      const expired = now - compatible.createdAt > maximumQueueAgeMs;
      return [{ ...compatible, blocked: compatible.blocked || expired }];
    });
  } catch { return []; }
};
