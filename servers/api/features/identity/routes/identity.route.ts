import { Router } from "express";
import { createIdentityController } from "../identity.controller.js";
import type { DevMailbox } from "../identity.dev-mailbox.js";
import type { IdentityService } from "../identity.service.js";
import { createOriginGuard } from "../../../middleware/index.js";

type IdentityRouteDependencies = Readonly<{
  service: IdentityService | null;
  mailbox: DevMailbox;
  webOrigin: string;
  environment: string;
  host: string;
}>;

const isLoopbackHost = (host: string): boolean =>
  host === "127.0.0.1" || host === "localhost" || host === "::1";

export const createIdentityRoutes = (dependencies: IdentityRouteDependencies): Router => {
  const router = Router();
  const { webOrigin, environment, host, mailbox } = dependencies;
  const controller = createIdentityController({
    service: dependencies.service,
    mailbox,
    config: { webOrigin, environment }
  });
  const requireOrigin = createOriginGuard(webOrigin);

  router.post("/auth/magic-links", requireOrigin, controller.requestMagicLink);
  router.post("/auth/magic-links/consume", requireOrigin, controller.consumeMagicLink);
  router.post("/auth/register", requireOrigin, controller.registerWithPassword);
  router.post("/auth/login", requireOrigin, controller.loginWithPassword);
  router.get("/auth/session", controller.getCurrentIdentity);
  router.delete("/auth/session", requireOrigin, controller.revokeCurrentSession);
  router.post("/auth/google-mail/connect", requireOrigin, controller.startGoogleMailConnect);
  router.get("/auth/google-mail/callback", controller.finishGoogleMailConnect);
  router.get("/auth/google-mail/status", controller.getGoogleMailStatus);
  router.delete("/auth/google-mail/connection", requireOrigin, controller.disconnectGoogleMail);

  if (environment === "development" && isLoopbackHost(host)) {
    router.post("/__dev/mailbox", requireOrigin, controller.readDevMailbox);
  }
  return router;
};
