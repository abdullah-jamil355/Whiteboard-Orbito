import { z } from "zod";
import type { ValidatedApiEnvironment } from "../types/index.js";

export const apiEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]),
  API_HOST: z.string().min(1),
  API_PORT: z.coerce.number().int().min(1).max(65_535),
  WEB_ORIGIN: z.string().transform((val) => val.replace(/\/+$/, "")).pipe(z.url()),
  MONGODB_URI: z.string().min(1).optional(),
  REALTIME_HOST: z.string().min(1).optional(),
  REALTIME_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
  IDENTITY_RATE_LIMIT_KEY: z.string().regex(/^[\da-f]{64}$/i).optional(),
  API_TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).optional(),
  GMAIL_USER: z.email().optional(),
  GMAIL_APP_PASSWORD: z.string().min(1).transform((value) => value.replace(/\s/g, "")).pipe(z.string().regex(/^[A-Za-z0-9]{16}$/)).optional(),
  BREVO_API_KEY: z.string().min(1).optional(),
  BREVO_SENDER_EMAIL: z.email().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().min(1).optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().min(1).optional(),
  GOOGLE_OAUTH_REDIRECT_URI: z.url().optional(),
  GOOGLE_TOKEN_ENCRYPTION_KEY: z.string().regex(/^[\da-f]{64}$/i).optional(),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
}).superRefine((environment, context) => {
  if ((environment.GMAIL_USER === undefined) !== (environment.GMAIL_APP_PASSWORD === undefined)) {
    context.addIssue({ code: "custom", path: ["GMAIL_APP_PASSWORD"], message: "GMAIL_USER and GMAIL_APP_PASSWORD must be configured together." });
  }
  if ((environment.BREVO_API_KEY === undefined) !== (environment.BREVO_SENDER_EMAIL === undefined)) {
    context.addIssue({ code: "custom", path: ["BREVO_SENDER_EMAIL"], message: "BREVO_API_KEY and BREVO_SENDER_EMAIL must be configured together." });
  }
  const googleOAuthValues = [environment.GOOGLE_OAUTH_CLIENT_ID, environment.GOOGLE_OAUTH_CLIENT_SECRET, environment.GOOGLE_OAUTH_REDIRECT_URI, environment.GOOGLE_TOKEN_ENCRYPTION_KEY];
  if (googleOAuthValues.some((value) => value !== undefined) && googleOAuthValues.some((value) => value === undefined)) {
    context.addIssue({ code: "custom", path: ["GOOGLE_OAUTH_CLIENT_ID"], message: "Google OAuth client ID, secret, redirect URI, and token encryption key must be configured together." });
  }
  if ((environment.REALTIME_HOST === undefined) !== (environment.REALTIME_PORT === undefined)) {
    context.addIssue({ code: "custom", path: ["REALTIME_PORT"], message: "REALTIME_HOST and REALTIME_PORT must be configured together." });
  }
  if (environment.NODE_ENV === "production" && !environment.IDENTITY_RATE_LIMIT_KEY) {
    context.addIssue({
      code: "custom",
      path: ["IDENTITY_RATE_LIMIT_KEY"],
      message: "IDENTITY_RATE_LIMIT_KEY is required in production."
    });
  }
  const origin = new URL(environment.WEB_ORIGIN);
  if (origin.origin !== environment.WEB_ORIGIN) {
    context.addIssue({
      code: "custom",
      path: ["WEB_ORIGIN"],
      message: "WEB_ORIGIN must contain only the scheme, host, and optional port."
    });
  }
  if (environment.NODE_ENV === "production" && origin.protocol !== "https:") {
    context.addIssue({
      code: "custom",
      path: ["WEB_ORIGIN"],
      message: "WEB_ORIGIN must use HTTPS in production."
    });
  }
  if (environment.NODE_ENV === "production" && !environment.MONGODB_URI) {
    context.addIssue({
      code: "custom",
      path: ["MONGODB_URI"],
      message: "MONGODB_URI is required in production for identity persistence."
    });
  }
}) satisfies z.ZodType<ValidatedApiEnvironment>;

export const validateApiEnvironment = (input: unknown): ValidatedApiEnvironment =>
  Object.freeze(apiEnvironmentSchema.parse(input));
