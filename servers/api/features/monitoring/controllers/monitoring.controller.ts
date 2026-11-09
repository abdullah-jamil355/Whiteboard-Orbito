import type { Request, Response } from "express";
import type { MetricsRegistry } from "@workspace/logging";
import { HTTP_STATUS } from "../../../constants/index.js";
import type { ActiveRoomObservation } from "../../sessions/public.js";

type Dependencies = Readonly<{
  metrics: MetricsRegistry;
  findActiveRooms?: () => Promise<readonly ActiveRoomObservation[]>;
}>;

export const createMonitoringController = ({ metrics, findActiveRooms }: Dependencies) => Object.freeze({
  getStats: async (_req: Request, res: Response): Promise<void> => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const summary = metrics.getSummary();
    const activeRooms = findActiveRooms ? await findActiveRooms() : summary.activeRooms;
    const activeConnections = activeRooms.reduce((total, room) => total + room.connections, 0);
    res.status(HTTP_STATUS.ok).json({ ...summary, activeSessions: activeRooms.length, activeConnections, activeRooms });
  },

  streamStats: (req: Request, res: Response): void => {
    res.status(HTTP_STATUS.ok);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-store, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    let sending = false;
    let dirty = false;
    const publish = async (): Promise<void> => {
      dirty = true;
      if (sending) return;
      sending = true;
      try {
        while (dirty && !res.writableEnded) {
          dirty = false;
          const summary = metrics.getSummary();
          const activeRooms = findActiveRooms
            ? await findActiveRooms().catch(() => summary.activeRooms)
            : summary.activeRooms;
          const activeConnections = activeRooms.reduce((total, room) => total + room.connections, 0);
          res.write(`event: stats\ndata: ${JSON.stringify({ ...summary, activeSessions: activeRooms.length, activeConnections, activeRooms })}\n\n`);
        }
      } finally {
        sending = false;
      }
    };
    const unsubscribe = metrics.subscribe(() => { void publish(); });
    const heartbeat = setInterval(() => { void publish(); }, 1_000);
    void publish();
    res.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  },

  getTrace: (req: Request<{ traceId: string }>, res: Response): void => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    const { traceId } = req.params;
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(traceId)) {
      res.status(HTTP_STATUS.badRequest).json({ error: { code: "invalid_trace_id", message: "Enter a valid trace ID." } });
      return;
    }
    const trace = metrics.findTrace(traceId);
    if (!trace) {
      res.status(HTTP_STATUS.notFound).json({ error: { code: "trace_not_found", message: "Trace was not found in this API instance's recent request history." } });
      return;
    }
    res.status(HTTP_STATUS.ok).json({ trace });
  },

  resetStats: (_req: Request, res: Response): void => {
    metrics.resetMetrics();
    res.setHeader("Cache-Control", "no-store");
    res.status(HTTP_STATUS.ok).json({ reset: true, timestamp: new Date().toISOString() });
  },

  getMetrics: async (_req: Request, res: Response): Promise<void> => {
    try {
      const data = await metrics.getPrometheusMetrics();
      res.setHeader("Content-Type", metrics.getPrometheusContentType());
      res.setHeader("Cache-Control", "no-store");
      res.status(HTTP_STATUS.ok).send(data);
    } catch {
      res.status(HTTP_STATUS.serviceUnavailable).send("# Failed to collect metrics\n");
    }
  }
});
