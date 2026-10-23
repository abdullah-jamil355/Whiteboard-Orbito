import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createLogger } from "@workspace/logging";
import { createApp, createServer, createShutdown } from "./bootstrap/index.js";
import { createApiConfig, readApiEnvironment } from "./config/index.js";
import { apiRuntime } from "./constants/index.js";
import { ensureIdentityIndexes } from "./features/identity/index.js";
import { ensureSessionIndexes } from "./features/sessions/index.js";
import { ensureInvitationIndexes } from "./features/invitations/index.js";
import { createMongoDbIntegration } from "./integrations/index.js";
import { createIdentityRepository, createIdentityService, unavailableIdentityMailer } from "./features/identity/index.js";
import { createSessionRepository } from "./features/sessions/index.js";
import { createInvitationRepository } from "./features/invitations/index.js";
import { createRealtimeServer } from "./features/realtime/index.js";

const config = createApiConfig(readApiEnvironment());
const logger = createLogger({
  service: apiRuntime.serviceName,
  level: config.logLevel,
  format: config.environment === "production" ? "json" : "pretty"
});
const database = createMongoDbIntegration({
  logger,
  ...(config.mongodbUri ? { uri: config.mongodbUri } : {})
});
const realtime = config.mongodbUri && config.realtimeHost && config.realtimePort
  ? createRealtimeServer({
    config,
    logger,
    identity: createIdentityService({ repository: createIdentityRepository(), mailer: unavailableIdentityMailer, webOrigin: config.webOrigin, rateLimitKey: config.identityRateLimitKey ?? randomBytes(32).toString("hex") }),
    sessions: createSessionRepository(),
    invitations: createInvitationRepository()
  })
  : null;
const app = createApp({ config, logger, ...(realtime ? {
  closeSessionConnections: realtime.closeSessionConnections,
  closeMemberConnections: realtime.closeMemberConnections,
  isMemberConnected: realtime.isMemberConnected
} : {}) });
const server = createServer({ app, config, logger });
const shutdown = createShutdown({ database, logger, server });
await database.connect();
if (config.mongodbUri) {
  await ensureIdentityIndexes();
  await ensureSessionIndexes();
  await ensureInvitationIndexes();
}
await server.start();
if (realtime) await realtime.start();

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    void shutdown(signal, realtime)
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        logger.error("API shutdown failed.", { error: error instanceof Error ? error.message : String(error) });
        process.exit(1);
      });
  });
}
