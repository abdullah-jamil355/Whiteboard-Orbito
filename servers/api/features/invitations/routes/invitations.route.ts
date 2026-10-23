import { Router } from "express";
import type { IdentityService } from "../../identity/public.js";
import type { InvitationService } from "../invitations.service.js";
import { createInvitationController } from "../invitations.controller.js";
import { createOriginGuard } from "../../../middleware/index.js";
export const createInvitationRoutes = (dependencies: Readonly<{ identity: IdentityService | null; invitations: InvitationService | null; webOrigin: string }>): Router => {
  const router = Router(); const controller = createInvitationController(dependencies); const requireOrigin = createOriginGuard(dependencies.webOrigin);
  router.post("/sessions/:sessionId/invitations", requireOrigin, controller.create);
  router.get("/sessions/:sessionId/invitations", controller.list);
  router.delete("/sessions/:sessionId/invitations/:invitationId", requireOrigin, controller.cancel);
  router.get("/sessions/:sessionId/members", controller.listMembers);
  router.delete("/sessions/:sessionId/members/:identityId", requireOrigin, controller.removeMember);
  router.post("/invitations/accept", requireOrigin, controller.accept);
  return router;
};
