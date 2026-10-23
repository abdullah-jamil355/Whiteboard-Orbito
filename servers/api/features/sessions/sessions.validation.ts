import { z } from "zod";

const coordinate = z.number().min(-1_000_000).max(1_000_000);
const geometry = z.object({
  x: coordinate,
  y: coordinate,
  width: z.number().positive().max(1_000_000),
  height: z.number().positive().max(1_000_000)
}).strict();
const lineWeight = z.enum(["thin", "medium", "thick"]);
const color = z.string().regex(/^#[\da-f]{6}$/i);
const endpoint = z.object({
  x: coordinate,
  y: coordinate,
  shapeId: z.string().min(1).max(128).optional(),
  connectionPoint: z.enum(["top", "right", "bottom", "left", "center"]).optional()
}).strict();
const objectId = z.string().min(1).max(128);

const shapeKind = z.enum([
  "rectangle", "rounded-rectangle", "circle", "diamond", "triangle", "hexagon", "parallelogram", "trapezoid",
  "pentagon", "octagon", "star", "cross", "cylinder", "cloud", "document", "speech-bubble",
  "right-arrow", "left-arrow", "up-arrow", "down-arrow", "double-arrow", "left-right-arrow"
]);
const arrowHead = z.enum(["none", "open", "triangle", "block", "diamond", "circle"]);
const connectorRouting = z.enum(["straight", "orthogonal", "curved"]);
const waypoints = z.array(z.object({ x: coordinate, y: coordinate }).strict()).max(100);

const shapeObject = z.object({
  id: objectId,
  type: z.literal("shape"),
  shape: shapeKind,
  geometry,
  style: z.object({ fill: z.union([color, z.literal("none")]), stroke: color, lineWeight }).strict(),
  stickyNote: z.boolean().optional()
}).strict();
const textObject = z.object({
  id: objectId,
  type: z.literal("text"),
  geometry,
  text: z.string().max(10_000),
  alignment: z.enum(["left", "center", "right"]),
  fontSize: z.number().min(1).max(512),
  bold: z.boolean(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  color,
  parentShapeId: objectId.optional()
}).strict();
const strokeObject = z.object({
  id: objectId,
  type: z.literal("stroke"),
  points: z.array(z.object({ x: coordinate, y: coordinate }).strict()).min(1).max(100_000),
  color,
  lineWeight
}).strict();
const lineObject = z.object({
  id: objectId,
  type: z.enum(["line", "arrow"]),
  start: endpoint,
  end: endpoint,
  color,
  lineWeight,
  startArrow: arrowHead.optional(),
  endArrow: arrowHead.optional(),
  routing: connectorRouting.optional(),
  waypoints: waypoints.optional()
}).strict();
const connectorObject = z.object({
  id: objectId,
  type: z.literal("connector"),
  start: endpoint,
  end: endpoint,
  color,
  lineWeight,
  startArrow: arrowHead.optional(),
  endArrow: arrowHead.optional(),
  routing: connectorRouting.optional(),
  waypoints: waypoints.optional()
}).strict();

export const boardSnapshotSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(120),
  templateId: z.string().min(1).max(128),
  canvas: z.object({ gridStyle: z.literal("graph-paper"), gridSpacing: z.number().min(1).max(256) }).strict(),
  objects: z.array(z.discriminatedUnion("type", [shapeObject, textObject, strokeObject, lineObject, connectorObject]))
    .max(10_000)
}).strict().superRefine((board, context) => {
  const ids = new Set<string>();
  const shapeIds = new Set(board.objects.filter((item) => item.type === "shape").map((item) => item.id));
  for (const [index, item] of board.objects.entries()) {
    if (ids.has(item.id)) context.addIssue({ code: "custom", path: ["objects", index, "id"], message: "Object IDs must be unique." });
    ids.add(item.id);
    if (item.type === "text" && item.parentShapeId && !shapeIds.has(item.parentShapeId)) {
      context.addIssue({ code: "custom", path: ["objects", index, "parentShapeId"], message: "Bound text must reference a shape on this board." });
    }
    if (item.type === "line" || item.type === "arrow" || item.type === "connector") {
      for (const [end, value] of [["start", item.start], ["end", item.end]] as const) {
        if (value.shapeId && !shapeIds.has(value.shapeId)) {
          context.addIssue({ code: "custom", path: ["objects", index, end, "shapeId"], message: "Connector references must point to a shape on this board." });
        }
      }
    }
  }
});

const boardObjectPropertyValues = [
  "geometry.x", "geometry.y", "geometry.width", "geometry.height",
  "style.fill", "style.stroke", "style.lineWeight",
  "text", "alignment", "fontSize", "bold", "italic", "underline",
  "stickyNote", "color", "points", "start", "end", "parentShapeId",
  "startArrow", "endArrow", "routing", "waypoints"
] as const;
const boardObjectProperty = z.enum(boardObjectPropertyValues);
export const boardEditChangeSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("board.title"), value: z.string().max(120) }).strict(),
  z.object({ kind: z.literal("board.template"), value: z.string().min(1).max(128) }).strict(),
  z.object({ kind: z.literal("object.add"), object: z.discriminatedUnion("type", [shapeObject, textObject, strokeObject, lineObject, connectorObject]) }).strict(),
  z.object({ kind: z.literal("object.remove"), objectId }).strict(),
  z.object({ kind: z.literal("object.set"), objectId, property: boardObjectProperty, value: z.unknown() }).strict(),
  z.object({ kind: z.literal("objects.order"), objectIds: z.array(objectId).max(10_000) }).strict()
]);

export const boardEditCommandSchema = z.object({
  actionId: z.uuid(),
  baseSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  changes: z.array(boardEditChangeSchema).min(1).max(512)
}).strict();

export const realtimeClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("board:sync") }).strict(),
  z.object({ type: z.literal("board:edit"), command: boardEditCommandSchema }).strict(),
  z.object({ type: z.literal("board:undo"), actionId: z.uuid() }).strict(),
  z.object({ type: z.literal("board:redo"), actionId: z.uuid() }).strict(),
]);

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120),
  board: boardSnapshotSchema
}).strict();
export const renameSessionSchema = z.object({ title: z.string().trim().min(1).max(120) }).strict();
export const endSessionSchema = z.object({ expectedSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }).strict();
export type BoardSnapshot = z.infer<typeof boardSnapshotSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type BoardEditChange = z.infer<typeof boardEditChangeSchema>;
export type BoardEditCommand = z.infer<typeof boardEditCommandSchema>;
export type BoardObjectProperty = typeof boardObjectPropertyValues[number];
