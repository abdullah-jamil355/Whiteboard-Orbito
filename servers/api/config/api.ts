import type { ApiConfig, ValidatedApiEnvironment } from "../types/index.js";

export const createApiConfig = (environment: ValidatedApiEnvironment): ApiConfig => Object.freeze({
  environment: environment.NODE_ENV,
  host: environment.API_HOST,
  port: environment.API_PORT,
  webOrigin: environment.WEB_ORIGIN,
  logLevel: environment.LOG_LEVEL,
  ...(environment.MONGODB_URI ? { mongodbUri: environment.MONGODB_URI } : {}),
  ...(environment.REALTIME_HOST && environment.REALTIME_PORT
    ? { realtimeHost: environment.REALTIME_HOST, realtimePort: environment.REALTIME_PORT }
    : environment.REALTIME_HOST
      ? { realtimeHost: environment.REALTIME_HOST }
      : environment.NODE_ENV === "development" ? { realtimeHost: "127.0.0.1", realtimePort: 4001 } : {}),
  ...(environment.IDENTITY_RATE_LIMIT_KEY ? { identityRateLimitKey: environment.IDENTITY_RATE_LIMIT_KEY } : {}),
  ...(environment.API_TRUST_PROXY_HOPS !== undefined ? { apiTrustProxyHops: environment.API_TRUST_PROXY_HOPS } : {}),
  ...(environment.GMAIL_USER ? { gmailUser: environment.GMAIL_USER } : {}),
  ...(environment.GMAIL_APP_PASSWORD ? { gmailAppPassword: environment.GMAIL_APP_PASSWORD } : {}),
  ...(environment.GOOGLE_OAUTH_CLIENT_ID && environment.GOOGLE_OAUTH_CLIENT_SECRET && environment.GOOGLE_OAUTH_REDIRECT_URI && environment.GOOGLE_TOKEN_ENCRYPTION_KEY ? {
    googleOAuthClientId: environment.GOOGLE_OAUTH_CLIENT_ID,
    googleOAuthClientSecret: environment.GOOGLE_OAUTH_CLIENT_SECRET,
    googleOAuthRedirectUri: environment.GOOGLE_OAUTH_REDIRECT_URI,
    googleTokenEncryptionKey: environment.GOOGLE_TOKEN_ENCRYPTION_KEY
  } : {})
});
