import type { Board, BoardObject } from "./board";
import type { BoardObjectsEdit, IndexedBoardObject } from "./eraser";

export type BoardHistoryEdit = BoardObjectsEdit & Readonly<{
  beforeTitle?: string;
  afterTitle?: string;
}>;

const indexObjects = (objects: readonly BoardObject[]): ReadonlyMap<string, IndexedBoardObject> =>
  new Map(objects.map((object, index) => [object.id, { index, object }]));

const areObjectsEqual = (first: BoardObject, second: BoardObject): boolean =>
  first === second || JSON.stringify(first) === JSON.stringify(second);

export const createBoardHistoryEdit = (before: Board, after: Board): BoardHistoryEdit | null => {
  const beforeById = indexObjects(before.objects);
  const afterById = indexObjects(after.objects);
  const affectedIds = new Set<string>();

  for (const [id, previous] of beforeById) {
    const next = afterById.get(id);
    if (next === undefined || !areObjectsEqual(previous.object, next.object)) affectedIds.add(id);
  }
  for (const id of afterById.keys()) {
    if (!beforeById.has(id)) affectedIds.add(id);
  }

  const sharedIds = new Set([...beforeById.keys()].filter((id) => afterById.has(id)));
  const previousOrder = before.objects.filter(({ id }) => sharedIds.has(id)).map(({ id }) => id);
  const nextOrder = after.objects.filter(({ id }) => sharedIds.has(id)).map(({ id }) => id);
  const orderChanged = previousOrder.some((id, index) => id !== nextOrder[index]);
  if (orderChanged) {
    for (const id of beforeById.keys()) affectedIds.add(id);
    for (const id of afterById.keys()) affectedIds.add(id);
  }

  const titleChanged = before.title !== after.title;
  if (affectedIds.size === 0 && !titleChanged) return null;

  const beforeObjects = before.objects.flatMap((object, index) =>
    affectedIds.has(object.id) ? [{ index, object }] : []
  );
  const afterObjects = after.objects.flatMap((object, index) =>
    affectedIds.has(object.id) ? [{ index, object }] : []
  );

  return {
    affectedIds: [...affectedIds],
    before: beforeObjects,
    after: afterObjects,
    ...(titleChanged ? { beforeTitle: before.title, afterTitle: after.title } : {})
  };
};

export const applyBoardHistorySnapshot = (
  board: Board,
  edit: BoardHistoryEdit,
  snapshot: "before" | "after"
): Board => {
  const affectedIds = new Set(edit.affectedIds);
  const objects = board.objects.filter((object) => !affectedIds.has(object.id));
  for (const item of [...edit[snapshot]].sort((first, second) => first.index - second.index)) {
    objects.splice(Math.min(item.index, objects.length), 0, item.object);
  }

  const title = snapshot === "before" ? edit.beforeTitle : edit.afterTitle;
  return {
    ...board,
    ...(title === undefined ? {} : { title }),
    objects
  };
};
