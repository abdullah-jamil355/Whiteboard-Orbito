import { Router } from "express";
import type { MetricsRegistry } from "@workspace/logging";
import { createMonitoringController } from "../controllers/index.js";
import type { ActiveRoomObservation } from "../../sessions/public.js";

type Dependencies = Readonly<{
  metrics: MetricsRegistry;
  findActiveRooms?: () => Promise<readonly ActiveRoomObservation[]>;
}>;

export const createMonitoringRoutes = ({ metrics, findActiveRooms }: Dependencies): Router => {
  const router = Router();
  const controller = createMonitoringController({ metrics, ...(findActiveRooms ? { findActiveRooms } : {}) });

  router.get("/observability/stats", controller.getStats);
  router.get("/observability/stream", controller.streamStats);
  router.get("/observability/traces/:traceId", controller.getTrace);
  router.post("/observability/reset", controller.resetStats);
  router.get("/metrics", (req, res, next) => {
    controller.getMetrics(req, res).catch(next);
  });

  return router;
};
