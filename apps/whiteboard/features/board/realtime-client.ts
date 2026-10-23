import type { WhiteboardEditChange, WhiteboardRealtimeServerMessage } from "@workspace/types";
import { parseBoardXml, serializeBoardXml, type Board, type BoardObject } from "@workspace/whiteboard";

const propertyPaths: Readonly<Record<BoardObject["type"], readonly string[]>> = {
  shape: ["geometry.x", "geometry.y", "geometry.width", "geometry.height", "style.fill", "style.stroke", "style.lineWeight", "stickyNote"],
  text: ["geometry.x", "geometry.y", "geometry.width", "geometry.height", "text", "alignment", "fontSize", "bold", "italic", "underline", "color", "parentShapeId"],
  stroke: ["points", "color", "lineWeight"],
  line: ["start", "end", "color", "lineWeight", "startArrow", "endArrow", "routing", "waypoints"],
  arrow: ["start", "end", "color", "lineWeight", "startArrow", "endArrow", "routing", "waypoints"],
  connector: ["start", "end", "color", "lineWeight", "startArrow", "endArrow", "routing", "waypoints"]
};

const readPath = (object: object, path: string): unknown => path.split(".").reduce<unknown>((value, key) => typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined, object);
const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);

export const diffBoardChanges = (before: Board, after: Board): readonly WhiteboardEditChange[] => {
  const changes: WhiteboardEditChange[] = [];
  if (before.title !== after.title) changes.push({ kind: "board.title", value: after.title });
  if (before.templateId !== after.templateId) changes.push({ kind: "board.template", value: after.templateId });
  const previous = new Map(before.objects.map((object) => [object.id, object]));
  const current = new Map(after.objects.map((object) => [object.id, object]));
  for (const object of before.objects) if (!current.has(object.id)) changes.push({ kind: "object.remove", objectId: object.id });
  for (const object of after.objects) {
    const prior = previous.get(object.id);
    if (prior === undefined) { changes.push({ kind: "object.add", object }); continue; }
    if (prior.type !== object.type) { changes.push({ kind: "object.remove", objectId: prior.id }, { kind: "object.add", object }); continue; }
    for (const property of propertyPaths[object.type]) {
      const beforeValue = readPath(prior, property);
      const afterValue = readPath(object, property);
      if (!equal(beforeValue, afterValue)) changes.push({ kind: "object.set", objectId: object.id, property: property as Extract<WhiteboardEditChange, { kind: "object.set" }>['property'], value: afterValue ?? null });
    }
  }
  const projectedOrder = [
    ...before.objects.filter(({ id }) => current.has(id)).map(({ id }) => id),
    ...after.objects.filter(({ id }) => !previous.has(id)).map(({ id }) => id)
  ];
  const finalOrder = after.objects.map(({ id }) => id);
  if (!equal(projectedOrder, finalOrder)) changes.push({ kind: "objects.order", objectIds: finalOrder });
  return Object.freeze(changes);
};

export const applyLocalBoardChanges = (board: Board, changes: readonly WhiteboardEditChange[]): Board => {
  let title = board.title;
  let templateId = board.templateId;
  let objects = [...board.objects];
  for (const change of changes) {
    if (change.kind === "board.title") { title = change.value; continue; }
    if (change.kind === "board.template") { templateId = change.value; continue; }
    if (change.kind === "object.add") {
      if (!objects.some(({ id }) => id === (change.object as BoardObject).id)) objects.push(change.object as BoardObject);
      continue;
    }
    if (change.kind === "object.remove") { objects = objects.filter(({ id }) => id !== change.objectId); continue; }
    if (change.kind === "objects.order") {
      const ordered = change.objectIds.flatMap((id) => { const object = objects.find((item) => item.id === id); return object === undefined ? [] : [object]; });
      const included = new Set(change.objectIds);
      objects = [...ordered, ...objects.filter(({ id }) => !included.has(id))];
      continue;
    }
    objects = objects.map((object) => {
      if (object.id !== change.objectId) return object;
      const [parent, child] = change.property.split(".");
      const updated = { ...object } as Record<string, unknown>;
      if (child !== undefined) updated[parent ?? ""] = { ...(updated[parent ?? ""] as Record<string, unknown>), [child]: change.value };
      else if (change.value === null && ["parentShapeId", "italic", "underline", "stickyNote", "startArrow", "endArrow", "routing", "waypoints"].includes(change.property)) delete updated[change.property];
      else updated[change.property] = change.value;
      return updated as unknown as BoardObject;
    });
  }
  return { ...board, title, templateId, objects };
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const rejectionReasons = new Set(["invalid_message", "invalid", "future_sequence", "action_conflict", "forbidden", "rate_limited", "storage_unavailable", "history_unavailable", "unsafe_inverse", "document_too_large"]);

export const validateBoardPayload = (value: unknown): Board | null => {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.title !== "string" || typeof value.templateId !== "string" || !Array.isArray(value.objects)) return null;
  try {
    const result = parseBoardXml(serializeBoardXml(value as unknown as Board));
    return result.ok ? result.board : null;
  } catch { return null; }
};

export const parseRealtimeServerMessage = (payload: string): WhiteboardRealtimeServerMessage | null => {
  try {
    const value: unknown = JSON.parse(payload);
    if (!isRecord(value)) return null;
    if (value.type === "session:ended") return value as WhiteboardRealtimeServerMessage;
    const historyValid = value.history === undefined || (isRecord(value.history) && typeof value.history.canUndo === "boolean" && typeof value.history.canRedo === "boolean");
    if (value.type === "board:state" && isRecord(value.board) && typeof value.sequence === "number" && Number.isSafeInteger(value.sequence) && value.sequence >= 0 && historyValid) {
      return value as WhiteboardRealtimeServerMessage;
    }
    if (value.type === "session:presence" && typeof value.ownerConnected === "boolean") return value as WhiteboardRealtimeServerMessage;
    if (value.type === "session:state" && ["owner", "editor", "viewer"].includes(String(value.role))
      && typeof value.ownerConnected === "boolean") return value as WhiteboardRealtimeServerMessage;
    if (value.type === "board:rejected" && typeof value.reason === "string" && rejectionReasons.has(value.reason)) return value as WhiteboardRealtimeServerMessage;
    return null;
  } catch { return null; }
};
