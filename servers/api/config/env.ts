import {
  validateApiEnvironment
} from "../validation/env.validation.js";
import type { ApiEnvironmentSource, ValidatedApiEnvironment } from "../types/index.js";

export const readApiEnvironment = (
  source: ApiEnvironmentSource = process.env
): ValidatedApiEnvironment => validateApiEnvironment({
  NODE_ENV: source.NODE_ENV,
  API_HOST: source.API_HOST,
  API_PORT: source.API_PORT,
  WEB_ORIGIN: source.WEB_ORIGIN,
  MONGODB_URI: source.MONGODB_URI,
  REALTIME_HOST: source.REALTIME_HOST,
  REALTIME_PORT: source.REALTIME_PORT,
  IDENTITY_RATE_LIMIT_KEY: source.IDENTITY_RATE_LIMIT_KEY,
  API_TRUST_PROXY_HOPS: source.API_TRUST_PROXY_HOPS,
  GMAIL_USER: source.GMAIL_USER,
  GMAIL_APP_PASSWORD: source.GMAIL_APP_PASSWORD,
  BREVO_API_KEY: source.BREVO_API_KEY,
  BREVO_SENDER_EMAIL: source.BREVO_SENDER_EMAIL,
  GOOGLE_OAUTH_CLIENT_ID: source.GOOGLE_OAUTH_CLIENT_ID,
  GOOGLE_OAUTH_CLIENT_SECRET: source.GOOGLE_OAUTH_CLIENT_SECRET,
  GOOGLE_OAUTH_REDIRECT_URI: source.GOOGLE_OAUTH_REDIRECT_URI,
  GOOGLE_TOKEN_ENCRYPTION_KEY: source.GOOGLE_TOKEN_ENCRYPTION_KEY,
  LOG_LEVEL: source.LOG_LEVEL
});
