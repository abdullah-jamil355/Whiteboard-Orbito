import type { Request, Response } from "express";
import type { MetricsRegistry } from "@workspace/logging";
import { HTTP_STATUS } from "../../../constants/index.js";

type Dependencies = Readonly<{
  metrics: MetricsRegistry;
}>;

export const createMonitoringController = ({ metrics }: Dependencies) => Object.freeze({
  getStats: (_req: Request, res: Response): void => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.status(HTTP_STATUS.ok).json(metrics.getSummary());
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
