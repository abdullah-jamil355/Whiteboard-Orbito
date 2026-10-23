import type { Request, Response } from "express";
import { z } from "zod";
import { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } from "../../constants/index.js";
import type { IdentityService } from "./identity.service.js";
import { IdentityServiceFailure } from "./identity.contracts.js";
import type { DevMailbox } from "./identity.dev-mailbox.js";

const sessionCookieName = "wb_session";
const cookieLifetimeSeconds = 7 * 24 * 60 * 60;
const magicLinkRequestSchema = z.object({ email: z.email().max(254) }).strict();
const magicLinkConsumeSchema = z.object({ token: z.string().min(32).max(256) }).strict();
const devMailboxRequestSchema = z.object({ email: z.email().max(254) }).strict();
const googleCallbackSchema = z.object({ state: z.string().min(32).max(256), code: z.string().min(1).max(4096) });

type ControllerConfig = Readonly<{ webOrigin: string; environment: string }>;
type ControllerDependencies = Readonly<{
  service: IdentityService | null;
  mailbox: DevMailbox;
  config: ControllerConfig;
}>;

export const readIdentitySessionToken = (request: Request): string | undefined => {
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;
  const value = cookieHeader.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(`${sessionCookieName}=`))?.slice(sessionCookieName.length + 1);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
};

const setSessionCookie = (response: Response, token: string, config: ControllerConfig): void => {
  const secure = config.environment === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${String(cookieLifetimeSeconds)}${secure}`);
};

const clearSessionCookie = (response: Response, config: ControllerConfig): void => {
  const secure = config.environment === "production" ? "; Secure" : "";
  response.setHeader("Set-Cookie", `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
};

const failureResponse = (response: Response, error: unknown): void => {
  if (!(error instanceof IdentityServiceFailure)) throw error;
  if (error.retryAfterSeconds !== undefined) {
    response.setHeader("Retry-After", String(error.retryAfterSeconds));
  }
  const mapped = {
    rate_limited: { status: HTTP_STATUS.tooManyRequests, code: ERROR_CODES.rateLimited, message: ERROR_MESSAGES.rateLimited },
    invalid_or_expired_link: { status: HTTP_STATUS.badRequest, code: ERROR_CODES.invalidMagicLink, message: ERROR_MESSAGES.invalidMagicLink },
    google_account_mismatch: { status: HTTP_STATUS.badRequest, code: ERROR_CODES.validation, message: "Connect the Gmail address used to sign in to Whiteboard." },
    storage_unavailable: { status: HTTP_STATUS.serviceUnavailable, code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable },
    delivery_unavailable: { status: HTTP_STATUS.serviceUnavailable, code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable }
  }[error.code];
  response.status(mapped.status).json({ error: { code: mapped.code, message: mapped.message } });
};

export const createIdentityController = ({ service, mailbox, config }: ControllerDependencies) => {
  const unavailable = (response: Response): void => {
    response.status(HTTP_STATUS.serviceUnavailable).json({
      error: { code: ERROR_CODES.serviceUnavailable, message: ERROR_MESSAGES.serviceUnavailable }
    });
  };

  return Object.freeze({
    requestMagicLink: async (request: Request, response: Response): Promise<void> => {
      if (!service) {
        unavailable(response);
        return;
      }
      const parsed = magicLinkRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(HTTP_STATUS.badRequest).json({
          error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation }
        });
        return;
      }
      try {
        await service.requestMagicLink({ email: parsed.data.email, ipAddress: request.ip ?? "unknown" });
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.accepted).json({ message: "If this address can sign in, a link has been sent." });
      } catch (error) {
        failureResponse(response, error);
      }
    },
    consumeMagicLink: async (request: Request, response: Response): Promise<void> => {
      if (!service) {
        unavailable(response);
        return;
      }
      const parsed = magicLinkConsumeSchema.safeParse(request.body);
      if (!parsed.success) {
        response.status(HTTP_STATUS.badRequest).json({
          error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation }
        });
        return;
      }
      try {
        const result = await service.consumeMagicLink(parsed.data.token);
        setSessionCookie(response, result.sessionToken, config);
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ identityId: result.identityId, expiresAt: result.expiresAt.toISOString() });
      } catch (error) {
        failureResponse(response, error);
      }
    },
    getCurrentIdentity: async (request: Request, response: Response): Promise<void> => {
      if (!service) {
        unavailable(response);
        return;
      }
      try {
        const identity = await service.getIdentityForSession(readIdentitySessionToken(request));
        if (!identity) {
          response.status(HTTP_STATUS.unauthorized).json({
            error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired }
          });
          return;
        }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ identity });
      } catch (error) {
        failureResponse(response, error);
      }
    },
    revokeCurrentSession: async (request: Request, response: Response): Promise<void> => {
      if (!service) {
        unavailable(response);
        return;
      }
      try {
        await service.revokeSession(readIdentitySessionToken(request));
        clearSessionCookie(response, config);
        response.sendStatus(HTTP_STATUS.noContent);
      } catch (error) {
        failureResponse(response, error);
      }
    },
    startGoogleMailConnect: async (request: Request, response: Response): Promise<void> => {
      if (!service) { unavailable(response); return; }
      try {
        const identity = await service.getIdentityForSession(readIdentitySessionToken(request));
        if (!identity) { response.status(HTTP_STATUS.unauthorized).json({ error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired } }); return; }
        const authorizationUrl = await service.startGoogleMailConnect(identity.id, identity.email);
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json({ authorizationUrl });
      } catch (error) { failureResponse(response, error); }
    },
    finishGoogleMailConnect: async (request: Request, response: Response): Promise<void> => {
      const completed = new URL("/", config.webOrigin);
      if (!service) { completed.searchParams.set("google-mail", "failed"); response.redirect(completed.toString()); return; }
      try {
        const parsed = googleCallbackSchema.safeParse(request.query);
        if (!parsed.success) throw new IdentityServiceFailure("invalid_or_expired_link");
        const identity = await service.getIdentityForSession(readIdentitySessionToken(request));
        if (!identity) throw new IdentityServiceFailure("invalid_or_expired_link");
        await service.finishGoogleMailConnect(identity.id, parsed.data.state, parsed.data.code);
        completed.searchParams.set("google-mail", "connected");
      } catch (error) {
        completed.searchParams.set("google-mail", error instanceof IdentityServiceFailure && error.code === "google_account_mismatch" ? "account-mismatch" : "failed");
      }
      response.setHeader("Cache-Control", "no-store");
      response.redirect(completed.toString());
    },
    getGoogleMailStatus: async (request: Request, response: Response): Promise<void> => {
      if (!service) { unavailable(response); return; }
      try {
        const identity = await service.getIdentityForSession(readIdentitySessionToken(request));
        if (!identity) { response.status(HTTP_STATUS.unauthorized).json({ error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired } }); return; }
        response.setHeader("Cache-Control", "no-store");
        response.status(HTTP_STATUS.ok).json(await service.getGoogleMailStatus(identity.id));
      } catch (error) { failureResponse(response, error); }
    },
    disconnectGoogleMail: async (request: Request, response: Response): Promise<void> => {
      if (!service) { unavailable(response); return; }
      try {
        const identity = await service.getIdentityForSession(readIdentitySessionToken(request));
        if (!identity) { response.status(HTTP_STATUS.unauthorized).json({ error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired } }); return; }
        await service.disconnectGoogleMail(identity.id);
        response.sendStatus(HTTP_STATUS.noContent);
      } catch (error) { failureResponse(response, error); }
    },
    readDevMailbox: (request: Request, response: Response): void => {
      response.setHeader("Cache-Control", "no-store");
      const input = devMailboxRequestSchema.safeParse(request.body);
      if (!input.success) {
        response.status(HTTP_STATUS.badRequest).json({ error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation } });
        return;
      }
      response.status(HTTP_STATUS.ok).json({ messages: mailbox.listFor(input.data.email) });
    }
  });
};
