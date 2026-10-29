import express, { type Express } from "express";
import { randomBytes } from "node:crypto";
import { createHttpLogger, createMetricsRegistry, createTraceMiddleware, type Logger } from "@workspace/logging";
import type { ApiConfig } from "../types/index.js";
import { createBrevoHttpEmailSender, createGmailSmtpEmailSender } from "../integrations/index.js";
import { apiRuntime } from "../constants/index.js";
import { createHealthRoutes } from "../features/health/index.js";
import { createMonitoringRoutes } from "../features/monitoring/index.js";
import {
  createDevMailbox,
  createIdentityRepository,
  createIdentityMailer,
  createIdentityRoutes,
  createIdentityService,
  unavailableIdentityMailer,
  unavailableInvitationMailer
} from "../features/identity/index.js";
import { createSessionRepository, createSessionRoutes, createSessionService } from "../features/sessions/index.js";
import { createInvitationMailer, createInvitationRepository, createInvitationRoutes, createInvitationService } from "../features/invitations/index.js";
import { createApiRateLimitMiddleware, createCorsMiddleware, createErrorHandler, createNotFoundHandler } from "../middleware/index.js";

type AppDependencies = Readonly<{
  config: ApiConfig;
  logger: Logger;
  closeSessionConnections?: (sessionId: string) => void;
  closeMemberConnections?: (sessionId: string, identityId: string) => void;
  isMemberConnected?: (sessionId: string, identityId: string) => boolean;
}>;

export const createApp = ({ config, logger, closeSessionConnections, closeMemberConnections, isMemberConnected }: AppDependencies): Express => {
  const app = express();
  app.disable("x-powered-by");
  if (config.apiTrustProxyHops !== undefined) app.set("trust proxy", config.apiTrustProxyHops);
  const metrics = createMetricsRegistry();
  app.use((req, res, next) => {
    createTraceMiddleware(metrics)(req, res, next);
  });
  app.use(createHttpLogger({
    logger,
    format: config.environment === "production" ? "combined" : "dev"
  }));
  app.use(createCorsMiddleware({ origin: config.webOrigin }));
  const mailbox = createDevMailbox();
  const emailSender = config.brevoApiKey && config.brevoSenderEmail
    ? createBrevoHttpEmailSender({ apiKey: config.brevoApiKey, senderEmail: config.brevoSenderEmail })
    : config.gmailUser && config.gmailAppPassword
      ? createGmailSmtpEmailSender({ username: config.gmailUser, appPassword: config.gmailAppPassword })
      : null;
  const mailer = emailSender
    ? createIdentityMailer(emailSender)
    : config.environment === "development" ? mailbox.mailer : unavailableIdentityMailer;
  const identityService = config.mongodbUri
    ? createIdentityService({
      repository: createIdentityRepository(),
      mailer,
      webOrigin: config.webOrigin,
      rateLimitKey: config.identityRateLimitKey ?? randomBytes(32).toString("hex"),
      ...(config.googleOAuthClientId && config.googleOAuthClientSecret && config.googleOAuthRedirectUri && config.googleTokenEncryptionKey ? {
        googleOAuth: { clientId: config.googleOAuthClientId, clientSecret: config.googleOAuthClientSecret, redirectUri: config.googleOAuthRedirectUri },
        googleTokenEncryptionKey: config.googleTokenEncryptionKey
      } : {})
    })
    : null;
  const invitationMailer = emailSender
    ? createInvitationMailer(async (_ownerIdentityId, email) => {
      await emailSender(email);
    })
    : identityService && config.googleOAuthClientId
      ? createInvitationMailer(async (ownerIdentityId, email) => {
        try {
          await identityService.sendAsGoogleMail(ownerIdentityId, email);
        } catch (error) {
          if (config.environment === "development") {
            const urlMatch = email.html.match(/href="([^"]+)"/);
            const foundUrl = urlMatch?.[1];
            await mailbox.invitationMailer.sendInvitation({
              ownerIdentityId,
              recipient: email.recipient,
              invitationUrl: typeof foundUrl === "string" ? foundUrl : "",
              sessionTitle: email.subject.replace("You're invited to ", ""),
              expiresAt: new Date(Date.now() + 10 * 60 * 1000)
            });
            return;
          }
          throw error;
        }
      })
      : config.environment === "development"
        ? mailbox.invitationMailer
        : unavailableInvitationMailer;
  if (identityService) app.use(createApiRateLimitMiddleware({ reserve: identityService.reserveHttpRequestRateLimit }));
  app.use(express.json({ limit: apiRuntime.jsonBodyLimit }));
  const invitationRepository = config.mongodbUri ? createInvitationRepository() : null;
  const sessionRepository = config.mongodbUri ? createSessionRepository() : null;
  const onSessionCleanupFailure = (sessionId: string, stage: string): void => {
    logger.error("Ended session cleanup failed; owner can retry the end request.", { sessionId, stage });
  };
  const sessionService = sessionRepository ? createSessionService({
    repository: sessionRepository,
    ...(closeSessionConnections ? { closeSessionConnections } : {}),
    ...(invitationRepository ? { deleteSessionInvitations: invitationRepository.deleteSessionInvitations } : {}),
    onCleanupFailure: onSessionCleanupFailure
  }) : null;
  const invitations = sessionRepository && sessionService && invitationRepository
    ? createInvitationService({
      invitations: invitationRepository,
      sessions: sessionService,
      sessionRepository,
      mailer: invitationMailer,
      reserveRateLimit: async (identityId, ipAddress) =>
        identityService ? identityService.reserveInvitationRateLimit({ identityId, ipAddress }) : false,
      webOrigin: config.webOrigin,
      ...(closeMemberConnections ? { closeMemberConnections } : {}),
      ...(isMemberConnected ? { isMemberConnected } : {})
    })
    : null;
  const memberAwareSessionService = invitationRepository && sessionRepository
    ? createSessionService({
      repository: sessionRepository,
      hasMembership: invitationRepository.hasMembership,
      ...(closeSessionConnections ? { closeSessionConnections } : {}),
      deleteSessionInvitations: invitationRepository.deleteSessionInvitations,
      onCleanupFailure: onSessionCleanupFailure
    })
    : sessionService;
  const featureRouters = [
    createHealthRoutes({
      environment: config.environment,
      serviceName: apiRuntime.serviceName
    }),
    createMonitoringRoutes({ metrics }),
    createIdentityRoutes({
      service: identityService,
      mailbox,
      webOrigin: config.webOrigin,
      environment: config.environment,
      host: config.host
    }),
    createSessionRoutes({ identity: identityService, sessions: memberAwareSessionService, webOrigin: config.webOrigin }),
    createInvitationRoutes({ identity: identityService, invitations, webOrigin: config.webOrigin })
  ];
  for (const featureRouter of featureRouters) app.use(featureRouter);
  app.use(createNotFoundHandler());
  app.use(createErrorHandler({ logger }));
  return app;
};
