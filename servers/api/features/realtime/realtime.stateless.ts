import type { Connection } from "@hocuspocus/server";
import type { Logger } from "@workspace/logging";
import type { RealtimeInvitationRepository } from "../invitations/public.js";
import type { RealtimeSessionRepository } from "../sessions/public.js";
import { BoardEditRejected, realtimeClientMessageSchema } from "../sessions/public.js";

export type RealtimeContext = Readonly<{
  connectionId: string;
  displayName: string;
  identityId: string;
  role: "editor" | "owner" | "viewer";
  sessionId: string;
}>;

const actionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const readActionId = (value: unknown): string | undefined => {
  if (
    typeof value === "object" &&
    value !== null &&
    "actionId" in value &&
    typeof value.actionId === "string" &&
    actionIdPattern.test(value.actionId)
  ) {
    return value.actionId;
  }
  if (typeof value !== "object" || value === null || !("command" in value)) return undefined;
  const command = value.command;
  if (typeof command !== "object" || command === null || !("actionId" in command)) return undefined;
  return typeof command.actionId === "string" && actionIdPattern.test(command.actionId)
    ? command.actionId
    : undefined;
};

type StatelessDependencies = Readonly<{
  commandWindows: Map<string, { count: number; startedAt: number }>;
  commandWindowMs: number;
  enqueueSession: <T>(sessionId: string, task: () => Promise<T>) => Promise<T>;
  invitations: RealtimeInvitationRepository;
  logger: Logger;
  maximumCommandsPerWindow: number;
  sessions: RealtimeSessionRepository;
}>;

export const handleRealtimeStatelessMessage = async (
  connection: Connection<RealtimeContext>,
  document: { broadcastStateless: (payload: string) => void },
  documentName: string,
  payload: string,
  deps: StatelessDependencies
): Promise<void> => {
  const { context } = connection;
  if (documentName !== context.sessionId) return;
  const now = Date.now();
  const window = deps.commandWindows.get(context.connectionId);
  const currentWindow =
    window && now - window.startedAt < deps.commandWindowMs ? window : { startedAt: now, count: 0 };
  currentWindow.count += 1;
  deps.commandWindows.set(context.connectionId, currentWindow);

  if (currentWindow.count > deps.maximumCommandsPerWindow) {
    if (currentWindow.count === deps.maximumCommandsPerWindow + 1) {
      deps.logger.warn("Realtime semantic command rate limit exceeded.", { sessionId: context.sessionId });
    }
    connection.sendStateless(JSON.stringify({ type: "board:rejected", reason: "rate_limited" }));
    return;
  }

  let value: unknown;
  try {
    value = JSON.parse(payload) as unknown;
  } catch {
    connection.sendStateless(JSON.stringify({ type: "board:rejected", reason: "invalid_message" }));
    return;
  }

  const parsed = realtimeClientMessageSchema.safeParse(value);
  if (!parsed.success) {
    connection.sendStateless(
      JSON.stringify({ type: "board:rejected", actionId: readActionId(value), reason: "invalid_message" })
    );
    return;
  }

  const session = await deps.sessions.findById(context.sessionId);
  if (!session || session.status !== "active") {
    connection.close({ code: 4403, reason: "Session access has been revoked." });
    return;
  }

  if (parsed.data.type === "board:sync") {
    const member =
      context.role === "owner"
        ? session.ownerIdentityId === context.identityId
        : await deps.invitations.findMembership(context.sessionId, context.identityId);
    if (!member) {
      connection.close({ code: 4403, reason: "Session access has been revoked." });
      return;
    }
    const history = await deps.sessions.getHistoryState(context.sessionId);
    connection.sendStateless(
      JSON.stringify({ type: "board:state", board: session.board, sequence: session.sequence, history })
    );
    return;
  }

  if (parsed.data.type === "board:undo" || parsed.data.type === "board:redo") {
    const { actionId } = parsed.data;
    if (context.role === "viewer") {
      connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId, reason: "forbidden" }));
      return;
    }
    if (
      context.role !== "owner" &&
      !(await deps.invitations.findMembership(context.sessionId, context.identityId))
    ) {
      connection.close({ code: 4403, reason: "Session access has been revoked." });
      return;
    }
    await deps.enqueueSession(context.sessionId, async () => {
      try {
        const result = await deps.sessions.applyHistoryAction(
          context.sessionId,
          context.identityId,
          actionId,
          parsed.data.type === "board:undo" ? "undo" : "redo",
          new Date()
        );
        if (!result) {
          connection.close({ code: 4403, reason: "Session access has been revoked." });
          return;
        }
        document.broadcastStateless(
          JSON.stringify({
            type: "board:state",
            actionId: result.actionId,
            actorIdentityId: context.identityId,
            board: result.board,
            sequence: result.sequence,
            history: result.history
          })
        );
      } catch (error) {
        if (error instanceof BoardEditRejected) {
          connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId, reason: error.reason }));
          return;
        }
        deps.logger.error("Realtime shared history action could not be persisted.", {
          sessionId: context.sessionId,
          errorType: error instanceof Error ? error.name : "UnknownError"
        });
        connection.sendStateless(
          JSON.stringify({ type: "board:rejected", actionId, reason: "storage_unavailable" })
        );
      }
    });
    return;
  }

  const { command } = parsed.data;
  if (context.role === "viewer") {
    connection.sendStateless(
      JSON.stringify({ type: "board:rejected", actionId: command.actionId, reason: "forbidden" })
    );
    return;
  }
  if (
    context.role !== "owner" &&
    !(await deps.invitations.findMembership(context.sessionId, context.identityId))
  ) {
    connection.close({ code: 4403, reason: "Session access has been revoked." });
    return;
  }
  await deps.enqueueSession(context.sessionId, async () => {
    try {
      const result = await deps.sessions.applyEdit(
        context.sessionId,
        context.identityId,
        command,
        new Date()
      );
      if (!result) {
        connection.close({ code: 4403, reason: "Session access has been revoked." });
        return;
      }
      document.broadcastStateless(
        JSON.stringify({
          type: "board:state",
          actionId: result.actionId,
          actorIdentityId: context.identityId,
          board: result.board,
          sequence: result.sequence,
          history: result.history
        })
      );
    } catch (error) {
      if (error instanceof BoardEditRejected) {
        connection.sendStateless(
          JSON.stringify({ type: "board:rejected", actionId: command.actionId, reason: error.reason })
        );
        return;
      }
      deps.logger.error("Realtime board edit could not be persisted.", {
        sessionId: context.sessionId,
        errorType: error instanceof Error ? error.name : "UnknownError"
      });
      connection.sendStateless(
        JSON.stringify({ type: "board:rejected", actionId: command.actionId, reason: "storage_unavailable" })
      );
    }
  });
};
