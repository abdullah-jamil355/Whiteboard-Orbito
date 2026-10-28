import type { Request, RequestHandler } from "express";
import { ERROR_CODES, HTTP_STATUS } from "../constants/index.js";

type RateLimitReservation = Readonly<{ allowed: boolean; retryAfterSeconds: number }>;
type ApiRateLimitDependencies = Readonly<{
  reserve: (input: Readonly<{ sessionToken?: string; ipAddress: string }>) => Promise<RateLimitReservation>;
}>;

const readSessionToken = (request: Request): string | undefined => {
  const auth = request.headers.authorization;
  if (typeof auth === "string" && auth.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token.length >= 32 && token.length <= 256) return token;
  }
  const cookie = request.headers.cookie;
  const value = cookie?.split(";").map((part) => part.trim())
    .find((part) => part.startsWith("wb_session="))?.slice("wb_session=".length);
  if (!value) return undefined;
  try {
    const token = decodeURIComponent(value);
    return token.length >= 32 && token.length <= 256 ? token : undefined;
  } catch {
    return undefined;
  }
};

export const createApiRateLimitMiddleware = ({ reserve }: ApiRateLimitDependencies): RequestHandler =>
  (request, response, next) => {
    if (request.path === "/health") {
      next();
      return;
    }

    const sessionToken = readSessionToken(request);
    const rateLimitInput = { ...(sessionToken === undefined ? {} : { sessionToken }), ipAddress: request.ip ?? "unknown" };
    void reserve(rateLimitInput).then(({ allowed, retryAfterSeconds }) => {
      if (allowed) {
        next();
        return;
      }
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.setHeader("Cache-Control", "no-store");
      response.status(HTTP_STATUS.tooManyRequests).json({
        error: { code: ERROR_CODES.rateLimited, message: "Too many API requests. Try again after the stated delay." }
      });
    }).catch(() => {
      response.setHeader("Cache-Control", "no-store");
      response.status(HTTP_STATUS.serviceUnavailable).json({
        error: { code: ERROR_CODES.serviceUnavailable, message: "Whiteboard API is temporarily unavailable." }
      });
    });
  };
