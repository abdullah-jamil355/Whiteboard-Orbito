import type { LogLevel } from "@workspace/logging";
import type { ApiEnvironment } from "@workspace/types";

export type ApiEnvironmentSource = Readonly<Record<string, string | undefined>>;

export type ValidatedApiEnvironment = Readonly<{
  NODE_ENV: ApiEnvironment;
  API_HOST: string;
  API_PORT: number;
  WEB_ORIGIN: string;
  MONGODB_URI?: string | undefined;
  REALTIME_HOST?: string | undefined;
  REALTIME_PORT?: number | undefined;
  IDENTITY_RATE_LIMIT_KEY?: string | undefined;
  API_TRUST_PROXY_HOPS?: number | undefined;
  GMAIL_USER?: string | undefined;
  GMAIL_APP_PASSWORD?: string | undefined;
  GOOGLE_OAUTH_CLIENT_ID?: string | undefined;
  GOOGLE_OAUTH_CLIENT_SECRET?: string | undefined;
  GOOGLE_OAUTH_REDIRECT_URI?: string | undefined;
  GOOGLE_TOKEN_ENCRYPTION_KEY?: string | undefined;
  LOG_LEVEL: LogLevel;
}>;
