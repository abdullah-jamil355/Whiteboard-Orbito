import { Router } from "express";
import type { MetricsRegistry } from "@workspace/logging";
import { createMonitoringController } from "../controllers/index.js";

type Dependencies = Readonly<{
  metrics: MetricsRegistry;
}>;

export const createMonitoringRoutes = ({ metrics }: Dependencies): Router => {
  const router = Router();
  const controller = createMonitoringController({ metrics });

  router.get("/observability/stats", controller.getStats);
  router.get("/metrics", (req, res, next) => {
    controller.getMetrics(req, res).catch(next);
  });

  return router;
};
