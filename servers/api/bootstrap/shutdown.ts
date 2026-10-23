import type { Logger } from "@workspace/logging";
import type { MongoDbIntegration } from "../integrations/index.js";
import type { ApiServer } from "./create-server.js";
import type { RealtimeServer } from "../features/realtime/index.js";

type ShutdownDependencies = Readonly<{
  database: Pick<MongoDbIntegration, "disconnect">;
  logger: Logger;
  server: Pick<ApiServer, "stop">;
}>;

export const createShutdown = ({ database, logger, server }: ShutdownDependencies) =>
  async (signal: NodeJS.Signals, realtime?: Pick<RealtimeServer, "stop"> | null): Promise<void> => {
    logger.info("API shutdown requested.", { signal });
    if (realtime) await realtime.stop();
    await server.stop();
    await database.disconnect();
  };
