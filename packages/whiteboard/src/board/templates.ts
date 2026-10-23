import { createBoard, type Board } from "./board";
import { diagramTemplates } from "./template-diagrams";
import { scaleTemplateObjectsToCanvas } from "./template-geometry";
import { coreTemplates } from "./template-core";
import { processTemplates } from "./template-process";
import { remapObjectReferences } from "./template-copy";
import type { BoardTemplate } from "./template-primitives";

export type { BoardTemplate } from "./template-primitives";

const builtInTemplates: readonly BoardTemplate[] = [...coreTemplates, ...processTemplates, ...diagramTemplates];

export const listBoardTemplates = (): readonly BoardTemplate[] => builtInTemplates;

export const createBoardFromTemplate = (templateId: string, createId: () => string): Board | null => {
  const template = builtInTemplates.find((candidate) => candidate.id === templateId);
  if (template === undefined) return null;

  const boardId = createId();
  const idMap = new Map<string, string>();
  const usedIds = new Set([boardId]);
  for (const object of template.objects) {
    const objectId = createId();
    if (usedIds.has(objectId)) throw new Error("The ID generator returned a duplicate ID.");
    usedIds.add(objectId);
    idMap.set(object.id, objectId);
  }

  return {
    ...createBoard(boardId),
    title: template.name,
    templateId: template.id,
    objects: scaleTemplateObjectsToCanvas(template.objects).map((object) => remapObjectReferences(object, idMap))
  };
};
