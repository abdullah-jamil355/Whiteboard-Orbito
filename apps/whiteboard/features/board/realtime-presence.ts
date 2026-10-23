import type { CollaboratorPresence, Coordinate } from "@workspace/whiteboard";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

export const readCollaborators = (states: ReadonlyMap<number, unknown>, ownClientId: number): readonly CollaboratorPresence[] => [...states.entries()].flatMap(([clientId, rawState]) => {
  if (!isRecord(rawState) || !isRecord(rawState.user)) return [];
  const { name, role } = rawState.user;
  if (typeof name !== "string" || name.trim().length === 0 || !["owner", "editor", "viewer"].includes(String(role))) return [];
  const rawCursor = rawState.cursor;
  const validCursor = isRecord(rawCursor) && typeof rawCursor.x === "number" && Number.isFinite(rawCursor.x) && Math.abs(rawCursor.x) <= 1_000_000
    && typeof rawCursor.y === "number" && Number.isFinite(rawCursor.y) && Math.abs(rawCursor.y) <= 1_000_000;
  const cursor: Coordinate | null = clientId !== ownClientId && validCursor ? { x: rawCursor.x as number, y: rawCursor.y as number } : null;
  return [{ clientId, name: name.slice(0, 80), role: role as CollaboratorPresence["role"], cursor }];
}).sort((left, right) => left.role.localeCompare(right.role) || left.name.localeCompare(right.name));
