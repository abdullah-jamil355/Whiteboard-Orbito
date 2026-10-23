import { boardSnapshotSchema, type BoardEditChange, type BoardObjectProperty, type BoardSnapshot } from "./sessions.validation.js";

const allowedProperties: Readonly<Record<BoardSnapshot["objects"][number]["type"], readonly string[]>> = {
  shape: ["geometry.x", "geometry.y", "geometry.width", "geometry.height", "style.fill", "style.stroke", "style.lineWeight", "stickyNote"],
  text: ["geometry.x", "geometry.y", "geometry.width", "geometry.height", "text", "alignment", "fontSize", "bold", "italic", "underline", "color", "parentShapeId"],
  stroke: ["points", "color", "lineWeight"],
  line: ["start", "end", "color", "lineWeight", "startArrow", "endArrow", "routing", "waypoints"],
  arrow: ["start", "end", "color", "lineWeight", "startArrow", "endArrow", "routing", "waypoints"],
  connector: ["start", "end", "color", "lineWeight", "startArrow", "endArrow", "routing", "waypoints"]
};

const equal = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const readProperty = (object: object, property: string): unknown => property.split(".").reduce<unknown>((value, key) => typeof value === "object" && value !== null ? (value as Record<string, unknown>)[key] : undefined, object);

export const diffBoardChanges = (before: BoardSnapshot, after: BoardSnapshot): readonly BoardEditChange[] => {
  const changes: BoardEditChange[] = [];
  if (before.title !== after.title) changes.push({ kind: "board.title", value: after.title });
  if (before.templateId !== after.templateId) changes.push({ kind: "board.template", value: after.templateId });

  const beforeById = new Map(before.objects.map((object) => [object.id, object]));
  const afterById = new Map(after.objects.map((object) => [object.id, object]));
  for (const object of before.objects) {
    if (!afterById.has(object.id)) changes.push({ kind: "object.remove", objectId: object.id });
  }
  for (const object of after.objects) {
    const previous = beforeById.get(object.id);
    if (previous === undefined) {
      changes.push({ kind: "object.add", object });
      continue;
    }
    if (previous.type !== object.type) {
      changes.push({ kind: "object.remove", objectId: previous.id }, { kind: "object.add", object });
      continue;
    }
    for (const property of allowedProperties[object.type]) {
      const beforeValue = readProperty(previous, property);
      const afterValue = readProperty(object, property);
      if (!equal(beforeValue, afterValue)) changes.push({ kind: "object.set", objectId: object.id, property: property as BoardObjectProperty, value: afterValue ?? null });
    }
  }

  const projectedOrder = [
    ...before.objects.filter((object) => afterById.has(object.id)).map(({ id }) => id),
    ...after.objects.filter((object) => !beforeById.has(object.id)).map(({ id }) => id)
  ];
  const finalOrder = after.objects.map(({ id }) => id);
  if (!equal(projectedOrder, finalOrder)) changes.push({ kind: "objects.order", objectIds: finalOrder });
  return Object.freeze(changes);
};

export const applyBoardChanges = (board: BoardSnapshot, changes: readonly BoardEditChange[]): BoardSnapshot => {
  let title = board.title;
  let templateId = board.templateId;
  let objects = [...board.objects];
  for (const change of changes) {
    if (change.kind === "board.title") { title = change.value; continue; }
    if (change.kind === "board.template") { templateId = change.value; continue; }
    if (change.kind === "object.add") {
      if (objects.some(({ id }) => id === change.object.id)) throw new Error("The object ID already exists.");
      objects.push(change.object);
      continue;
    }
    if (change.kind === "object.remove") {
      if (!objects.some(({ id }) => id === change.objectId)) throw new Error("The object no longer exists.");
      objects = objects.filter(({ id }) => id !== change.objectId);
      continue;
    }
    if (change.kind === "objects.order") {
      const ordered = change.objectIds.flatMap((id) => {
        const object = objects.find((item) => item.id === id);
        return object === undefined ? [] : [object];
      });
      const specified = new Set(change.objectIds);
      objects = [...ordered, ...objects.filter(({ id }) => !specified.has(id))];
      continue;
    }
    const target = objects.find((object) => object.id === change.objectId);
    if (target === undefined || !allowedProperties[target.type].includes(change.property)) throw new Error("The board edit target is unavailable.");
    const [parent, child] = change.property.split(".");
    let updated = { ...target } as Record<string, unknown>;
    if (child !== undefined) {
      const nested = updated[parent ?? ""] as Record<string, unknown>;
      updated[parent ?? ""] = { ...nested, [child]: change.value };
    } else if (change.value === null && ["parentShapeId", "italic", "underline", "stickyNote", "startArrow", "endArrow", "routing", "waypoints"].includes(change.property)) {
      updated = Object.fromEntries(Object.entries(updated).filter(([key]) => key !== change.property));
    }
    else updated[change.property] = change.value;
    objects = objects.map((object) => object.id === change.objectId ? updated as unknown as typeof object : object);
  }
  const result = boardSnapshotSchema.safeParse({ ...board, title, templateId, objects });
  if (!result.success) throw new Error("The edit would produce an invalid board.");
  return result.data;
};
