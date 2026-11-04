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
