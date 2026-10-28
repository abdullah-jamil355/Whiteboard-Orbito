import type { Server as NodeHttpServer } from "node:http";
import { Server } from "@hocuspocus/server";
import type { Connection } from "@hocuspocus/server";
import type { Logger } from "@workspace/logging";
import type { ApiConfig } from "../../types/index.js";
import type { IdentityService } from "../identity/public.js";
import type { RealtimeInvitationRepository } from "../invitations/public.js";
import type { RealtimeSessionRepository } from "../sessions/public.js";
import { BoardEditRejected } from "../sessions/public.js";
import { realtimeClientMessageSchema } from "../sessions/public.js";
import { isAllowedRealtimeOrigin, parseRealtimeRoomId, readRealtimeSessionCookie, sanitizeRealtimeAwarenessState } from "./realtime.rules.js";

type RealtimeContext = Readonly<{ sessionId: string; identityId: string; displayName: string; role: "owner" | "editor" | "viewer"; connectionId: string }>;
type Dependencies = Readonly<{
  config: ApiConfig;
  logger: Logger;
  identity: IdentityService;
  sessions: RealtimeSessionRepository;
  invitations: RealtimeInvitationRepository;
}>;
const leaseMs = 90_000;
const heartbeatMs = 30_000;
const commandWindowMs = 60_000;
const maximumCommandsPerWindow = 1_200;
const maximumAwarenessUpdatesPerWindow = 2_400;
const maximumAwarenessClientStatesPerUpdate = 30;
const actionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const readActionId = (value: unknown): string | undefined => {
  if (typeof value === "object" && value !== null && "actionId" in value && typeof value.actionId === "string" && actionIdPattern.test(value.actionId)) return value.actionId;
  if (typeof value !== "object" || value === null || !("command" in value)) return undefined;
  const command = value.command;
  if (typeof command !== "object" || command === null || !("actionId" in command)) return undefined;
  return typeof command.actionId === "string" && actionIdPattern.test(command.actionId) ? command.actionId : undefined;
};
export const createRealtimeServer = ({ config, logger, identity, sessions, invitations }: Dependencies) => {
  if (config.realtimePort && !config.realtimeHost) throw new Error("Realtime host is required when realtime port is specified.");
  const timers = new Map<string, NodeJS.Timeout>();
  const connections = new Map<string, Connection<RealtimeContext>>();
  const commandWindows = new Map<string, { startedAt: number; count: number }>();
  const awarenessWindows = new Map<string, { startedAt: number; count: number }>();
  const awarenessAnomalyLogged = new Set<string>();
  const sessionQueues = new Map<string, Promise<unknown>>();
  const enqueueSession = <T>(sessionId: string, task: () => Promise<T>): Promise<T> => {
    const prior = sessionQueues.get(sessionId) ?? Promise.resolve();
    const next = prior.then(task, task);
    sessionQueues.set(sessionId, next);
    void next.finally(() => {
      if (sessionQueues.get(sessionId) === next) sessionQueues.delete(sessionId);
    });
    return next;
  };
  const server = new Server<RealtimeContext>({
    ...(config.realtimeHost ? { address: config.realtimeHost } : {}),
    ...(config.realtimePort ? { port: config.realtimePort } : {}),
    stopOnSignals: false,
    quiet: true,
    websocketOptions: { maxPayload: 1_048_576 },
    onAuthenticate: async ({ documentName, requestHeaders, connectionConfig, socketId }) => {
      const headers = requestHeaders as unknown as Readonly<{ get: (name: string) => string | null }>;
      if (!isAllowedRealtimeOrigin(headers.get("origin"), config.webOrigin)) throw new Error("Origin not allowed.");
      const sessionId = parseRealtimeRoomId(documentName);
      const token = readRealtimeSessionCookie(headers.get("cookie"));
      if (!sessionId || !token) throw new Error("Authentication required.");
      const principal = await identity.getIdentityForSession(token);
      if (!principal) throw new Error("Authentication required.");
      const session = await sessions.findById(sessionId);
      if (!session || session.status !== "active") throw new Error("Session is not active.");
      let context: RealtimeContext;
      if (session.ownerIdentityId === principal.id) {
        context = Object.freeze({ sessionId, identityId: principal.id, displayName: principal.email, role: "owner", connectionId: socketId });
      } else {
        const membership = await invitations.findMembership(sessionId, principal.id);
        if (!membership) throw new Error("Active session membership required.");
        context = Object.freeze({ sessionId, identityId: principal.id, displayName: membership.displayName, role: membership.role, connectionId: socketId });
      }
      const now = new Date();
      const claimed = await sessions.claimConnection(sessionId, principal.id, socketId, now, new Date(now.getTime() + leaseMs));
      if (!claimed) {
        logger.warn("Realtime connection rejected: session ended or membership revoked.", { sessionId });
        throw new Error("Active session membership is required.");
      }
      connectionConfig.readOnly = true;
      let consecutiveLeaseFailures = 0;
      timers.set(socketId, setInterval(() => {
          void sessions.refreshConnection(sessionId, socketId, new Date(Date.now() + leaseMs))
            .then((refreshed) => {
            consecutiveLeaseFailures = refreshed ? 0 : consecutiveLeaseFailures + 1;
            if (!refreshed) {
              connections.get(socketId)?.close({ code: 4408, reason: "Realtime seat lease expired." });
              logger.warn("Realtime seat lease expired; connection closed.", { sessionId });
            } else if (consecutiveLeaseFailures === 3) {
              logger.error("Realtime seat lease refresh failed three consecutive times; connection closed.", { sessionId });
              connections.get(socketId)?.close({ code: 1013, reason: "Realtime authorization could not be refreshed." });
            }
          })
          .catch((error: unknown) => {
            consecutiveLeaseFailures += 1;
            if (consecutiveLeaseFailures === 3) {
              logger.error("Realtime seat lease refresh failed three consecutive times; connection closed.", { sessionId, error: error instanceof Error ? error.message : String(error) });
              connections.get(socketId)?.close({ code: 1013, reason: "Realtime authorization could not be refreshed." });
            }
          });
      }, heartbeatMs));
      return context;
    },
    beforeSync: ({ connection, type }) => {
      if (type !== 2) return Promise.resolve();
      connection.close({ code: 4403, reason: "Use authorized Whiteboard edit commands." });
      return Promise.reject(new Error("Raw Yjs document updates are disabled; use Whiteboard edit commands."));
    },
    connected: async ({ connection, context }) => {
      connections.set(context.connectionId, connection);
      try {
        const session = await sessions.findById(context.sessionId);
        if (session?.status === "active") {
          const ownerConnected = [...connections.values()].some((active) => active.context.sessionId === context.sessionId && active.context.role === "owner");
          const history = await sessions.getHistoryState(context.sessionId);
          connection.sendStateless(JSON.stringify({ type: "board:state", board: session.board, sequence: session.sequence, history }));
          connection.sendStateless(JSON.stringify({ type: "session:state", role: context.role, ownerConnected }));
          if (context.role === "owner") {
            const message = JSON.stringify({ type: "session:presence", ownerConnected: true });
            for (const participant of connections.values()) {
              if (participant.context.sessionId === context.sessionId) participant.sendStateless(message);
            }
          }
        }
        else connection.close({ code: 4403, reason: "Session is no longer active." });
      } catch {
        logger.error("Realtime board state could not be loaded after connection.", { sessionId: context.sessionId });
        connection.close({ code: 1013, reason: "Board state is temporarily unavailable." });
      }
    },
    onStateless: async ({ connection: source, document, documentName, payload }) => {
      const connection = source as Connection<RealtimeContext>;
      const context = connection.context;
      if (documentName !== context.sessionId) return;
      const now = Date.now();
      const window = commandWindows.get(context.connectionId);
      const currentWindow = window && now - window.startedAt < commandWindowMs ? window : { startedAt: now, count: 0 };
      currentWindow.count += 1;
      commandWindows.set(context.connectionId, currentWindow);
      if (currentWindow.count > maximumCommandsPerWindow) {
        if (currentWindow.count === maximumCommandsPerWindow + 1) logger.warn("Realtime semantic command rate limit exceeded.", { sessionId: context.sessionId });
        connection.sendStateless(JSON.stringify({ type: "board:rejected", reason: "rate_limited" }));
        return;
      }
      let value: unknown;
      try { value = JSON.parse(payload) as unknown; } catch { connection.sendStateless(JSON.stringify({ type: "board:rejected", reason: "invalid_message" })); return; }
      const parsed = realtimeClientMessageSchema.safeParse(value);
      if (!parsed.success) { connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId: readActionId(value), reason: "invalid_message" })); return; }
      const session = await sessions.findById(context.sessionId);
      if (!session || session.status !== "active") {
        connection.close({ code: 4403, reason: "Session access has been revoked." });
        return;
      }
      if (parsed.data.type === "board:sync") {
        const member = context.role === "owner" ? session.ownerIdentityId === context.identityId : await invitations.findMembership(context.sessionId, context.identityId);
        if (!member) { connection.close({ code: 4403, reason: "Session access has been revoked." }); return; }
        const history = await sessions.getHistoryState(context.sessionId);
        connection.sendStateless(JSON.stringify({ type: "board:state", board: session.board, sequence: session.sequence, history }));
        return;
      }
      if (parsed.data.type === "board:undo" || parsed.data.type === "board:redo") {
        const { actionId } = parsed.data;
        if (context.role === "viewer") {
          connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId, reason: "forbidden" }));
          return;
        }
        if (context.role !== "owner" && !await invitations.findMembership(context.sessionId, context.identityId)) {
          connection.close({ code: 4403, reason: "Session access has been revoked." });
          return;
        }
        await enqueueSession(context.sessionId, async () => {
          try {
            const result = await sessions.applyHistoryAction(context.sessionId, context.identityId, actionId, parsed.data.type === "board:undo" ? "undo" : "redo", new Date());
            if (!result) { connection.close({ code: 4403, reason: "Session access has been revoked." }); return; }
            document.broadcastStateless(JSON.stringify({ type: "board:state", actionId: result.actionId, actorIdentityId: context.identityId, board: result.board, sequence: result.sequence, history: result.history }));
          } catch (error) {
            if (error instanceof BoardEditRejected) {
              connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId, reason: error.reason }));
              return;
            }
            logger.error("Realtime shared history action could not be persisted.", { sessionId: context.sessionId, errorType: error instanceof Error ? error.name : "UnknownError" });
            connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId, reason: "storage_unavailable" }));
          }
        });
        return;
      }
      const { command } = parsed.data;
      if (context.role === "viewer") {
        connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId: command.actionId, reason: "forbidden" }));
        return;
      }
      if (context.role !== "owner" && !await invitations.findMembership(context.sessionId, context.identityId)) {
        connection.close({ code: 4403, reason: "Session access has been revoked." });
        return;
      }
      await enqueueSession(context.sessionId, async () => {
        try {
          const result = await sessions.applyEdit(context.sessionId, context.identityId, command, new Date());
          if (!result) { connection.close({ code: 4403, reason: "Session access has been revoked." }); return; }
          document.broadcastStateless(JSON.stringify({ type: "board:state", actionId: result.actionId, actorIdentityId: context.identityId, board: result.board, sequence: result.sequence, history: result.history }));
        } catch (error) {
          if (error instanceof BoardEditRejected) {
            connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId: command.actionId, reason: error.reason }));
            return;
          }
          logger.error("Realtime board edit could not be persisted.", { sessionId: context.sessionId, errorType: error instanceof Error ? error.name : "UnknownError" });
          connection.sendStateless(JSON.stringify({ type: "board:rejected", actionId: command.actionId, reason: "storage_unavailable" }));
        }
      });
    },
    beforeHandleAwareness: ({ states, context }) => {
      if (context) {
        const now = Date.now();
        const priorWindow = awarenessWindows.get(context.connectionId);
        const window = priorWindow && now - priorWindow.startedAt < commandWindowMs ? priorWindow : { startedAt: now, count: 0 };
        window.count += 1;
        awarenessWindows.set(context.connectionId, window);
        if (window.count > maximumAwarenessUpdatesPerWindow) {
          if (window.count === maximumAwarenessUpdatesPerWindow + 1) logger.warn("Realtime awareness update rate limit exceeded.", { sessionId: context.sessionId });
          states.clear();
          return Promise.resolve();
        }
        if (states.size > maximumAwarenessClientStatesPerUpdate) {
          if (!awarenessAnomalyLogged.has(context.connectionId)) {
            awarenessAnomalyLogged.add(context.connectionId);
            logger.warn("Realtime awareness update contained multiple client states; update dropped.", { sessionId: context.sessionId });
          }
          states.clear();
          return Promise.resolve();
        }
        for (const [clientId, state] of states) states.set(clientId, sanitizeRealtimeAwarenessState(state, context.displayName, context.role));
      }
      return Promise.resolve();
    },
    onDisconnect: async ({ context }) => {
      const timer = timers.get(context.connectionId);
      if (timer) clearInterval(timer);
      timers.delete(context.connectionId);
      connections.delete(context.connectionId);
      commandWindows.delete(context.connectionId);
      awarenessWindows.delete(context.connectionId);
      awarenessAnomalyLogged.delete(context.connectionId);
      if (context.role === "owner" && ![...connections.values()].some((active) => active.context.sessionId === context.sessionId && active.context.role === "owner")) {
        const message = JSON.stringify({ type: "session:presence", ownerConnected: false });
        for (const participant of connections.values()) {
          if (participant.context.sessionId === context.sessionId) participant.sendStateless(message);
        }
      }
      await sessions.releaseConnection(context.sessionId, context.connectionId).catch((error: unknown) => {
          logger.error("Realtime seat release failed; lease expiry will recover the seat.", { sessionId: context.sessionId, error: error instanceof Error ? error.message : String(error) });
      });
    }
  });
  return Object.freeze({
    closeMemberConnections: (sessionId: string, identityId: string): void => {
      for (const [connectionId, connection] of connections) {
        if (connection.context.sessionId !== sessionId || connection.context.identityId !== identityId) continue;
        connection.close({ code: 4403, reason: "Session membership has been revoked." });
        const timer = timers.get(connectionId);
        if (timer) clearInterval(timer);
        timers.delete(connectionId);
        commandWindows.delete(connectionId);
        awarenessWindows.delete(connectionId);
        awarenessAnomalyLogged.delete(connectionId);
        connections.delete(connectionId);
      }
    },
    isMemberConnected: (sessionId: string, identityId: string): boolean =>
      [...connections.values()].some((connection) => connection.context.sessionId === sessionId && connection.context.identityId === identityId),
    closeSessionConnections: (sessionId: string): void => {
      for (const [connectionId, connection] of connections) {
        if (connection.context.sessionId !== sessionId) continue;
        if (connection.context.role !== "owner") connection.sendStateless(JSON.stringify({ type: "session:ended" }));
        connection.close({ code: 4403, reason: "Session has ended." });
        const timer = timers.get(connectionId);
        if (timer) clearInterval(timer);
        timers.delete(connectionId);
        commandWindows.delete(connectionId);
        awarenessWindows.delete(connectionId);
        awarenessAnomalyLogged.delete(connectionId);
        connections.delete(connectionId);
      }
    },
    start: async (): Promise<void> => {
      await server.listen();
      logger.info("Whiteboard realtime server started.", { host: config.realtimeHost, port: config.realtimePort });
    },
    attachToHttpServer: (httpServer: NodeHttpServer): void => {
      server.httpServer = httpServer;
      (server as unknown as { setupHttpUpgrade: () => void }).setupHttpUpgrade();
      logger.info("Whiteboard realtime server attached to HTTP server (shared port mode).");
    },
    stop: async (): Promise<void> => {
      for (const timer of timers.values()) clearInterval(timer);
      timers.clear();
      await server.destroy();
    }
  });
};
export type RealtimeServer = ReturnType<typeof createRealtimeServer>;
