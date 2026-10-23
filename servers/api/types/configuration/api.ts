import type { LogLevel } from "@workspace/logging";
import type { ApiEnvironment } from "@workspace/types";

export type ApiConfig = Readonly<{
  environment: ApiEnvironment;
  host: string;
  port: number;
  webOrigin: string;
  mongodbUri?: string;
  realtimeHost?: string;
  realtimePort?: number;
  identityRateLimitKey?: string;
  apiTrustProxyHops?: number;
  gmailUser?: string;
  gmailAppPassword?: string;
  googleOAuthClientId?: string;
  googleOAuthClientSecret?: string;
  googleOAuthRedirectUri?: string;
  googleTokenEncryptionKey?: string;
  logLevel: LogLevel;
}>;
