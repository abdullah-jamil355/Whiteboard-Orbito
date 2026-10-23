import { Router } from "express";
import type { IdentityService } from "../../identity/public.js";
import type { SessionService } from "../sessions.service.js";
import { createSessionController } from "../sessions.controller.js";
import { createOriginGuard } from "../../../middleware/index.js";

type SessionRouteDependencies = Readonly<{ identity: IdentityService | null; sessions: SessionService | null; webOrigin: string }>;
export const createSessionRoutes = ({ identity, sessions, webOrigin }: SessionRouteDependencies): Router => {
  const router = Router();
  const controller = createSessionController({ identity, sessions });
  const requireWebOrigin = createOriginGuard(webOrigin);
  router.post("/sessions", requireWebOrigin, controller.create);
  router.get("/sessions/mine", controller.listMine);
  router.get("/sessions/:sessionId", controller.get);
  router.patch("/sessions/:sessionId", requireWebOrigin, controller.rename);
  router.delete("/sessions/:sessionId", requireWebOrigin, controller.end);
  return router;
};
