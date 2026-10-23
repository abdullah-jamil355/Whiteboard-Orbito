import type { BoardEditChange, BoardSnapshot } from "./sessions.validation.js";

export type BoardHistoryGuard =
  | Readonly<{ kind: "board.title"; value: string }>
  | Readonly<{ kind: "board.template"; value: string }>
  | Readonly<{ kind: "object.state"; objectId: string; value: BoardSnapshot["objects"][number] | null }>
  | Readonly<{ kind: "object.property"; objectId: string; property: string; value: unknown }>
  | Readonly<{ kind: "objects.order"; objectIds: readonly string[] }>;

export type BoardHistoryStacks = Readonly<{ undo: readonly string[]; redo: readonly string[] }>;
export type BoardHistoryAction = "undo" | "redo";

const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const readPath = (value: unknown, path: string): unknown => path.split(".").reduce<unknown>(
  (current, part) => typeof current === "object" && current !== null ? (current as Record<string, unknown>)[part] : undefined,
  value
);

export const createBoardHistoryGuards = (changes: readonly BoardEditChange[], board: BoardSnapshot): readonly BoardHistoryGuard[] => {
  const guards = new Map<string, BoardHistoryGuard>();
  for (const change of changes) {
    if (change.kind === "board.title") guards.set("board.title", { kind: "board.title", value: board.title });
    else if (change.kind === "board.template") guards.set("board.template", { kind: "board.template", value: board.templateId });
    else if (change.kind === "object.add" || change.kind === "object.remove") {
      const objectId = change.kind === "object.add" ? (change.object as { id: string }).id : change.objectId;
      const object = board.objects.find((item) => item.id === objectId) ?? null;
      guards.set(`object:${objectId}`, { kind: "object.state", objectId, value: object });
    } else if (change.kind === "object.set") {
      const key = `${change.objectId}:${change.property}`;
      const object = board.objects.find((item) => item.id === change.objectId);
      guards.set(key, { kind: "object.property", objectId: change.objectId, property: change.property, value: object === undefined ? undefined : readPath(object, change.property) });
    } else {
      guards.set("objects.order", { kind: "objects.order", objectIds: board.objects.map(({ id }) => id) });
    }
  }
  return Object.freeze([...guards.values()]);
};

export const boardHistoryGuardsMatch = (board: BoardSnapshot, guards: readonly BoardHistoryGuard[]): boolean => guards.every((guard) => {
  if (guard.kind === "board.title") return board.title === guard.value;
  if (guard.kind === "board.template") return board.templateId === guard.value;
  if (guard.kind === "object.state") return equal(board.objects.find(({ id }) => id === guard.objectId) ?? null, guard.value);
  if (guard.kind === "objects.order") return equal(board.objects.map(({ id }) => id), guard.objectIds);
  const object = board.objects.find(({ id }) => id === guard.objectId);
  const currentValue = object === undefined ? undefined : readPath(object, guard.property);
  return equal(currentValue, guard.value);
});

export const appendForwardHistoryAction = (stacks: BoardHistoryStacks, actionId: string, meaningful: boolean, maximumActions: number): BoardHistoryStacks => meaningful
  ? Object.freeze({ undo: Object.freeze([...stacks.undo, actionId].slice(-maximumActions)), redo: Object.freeze([]) })
  : stacks;

export const applyBoardHistoryTransition = (stacks: BoardHistoryStacks, action: BoardHistoryAction, targetActionId: string, maximumActions: number): BoardHistoryStacks => {
  if (action === "undo") {
    if (stacks.undo.at(-1) !== targetActionId) throw new Error("Undo target is no longer the latest shared action.");
    return Object.freeze({ undo: Object.freeze(stacks.undo.slice(0, -1)), redo: Object.freeze([...stacks.redo, targetActionId].slice(-maximumActions)) });
  }
  if (stacks.redo.at(-1) !== targetActionId) throw new Error("Redo target is no longer the latest undone shared action.");
  return Object.freeze({ undo: Object.freeze([...stacks.undo, targetActionId].slice(-maximumActions)), redo: Object.freeze(stacks.redo.slice(0, -1)) });
};

