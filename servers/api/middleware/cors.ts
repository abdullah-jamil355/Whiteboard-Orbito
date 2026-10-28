import type { RequestHandler } from "express";
import { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } from "../constants/index.js";

const isPrivateOrLoopback = (hostname: string): boolean =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "::1" ||
  hostname.startsWith("192.168.") ||
  hostname.startsWith("10.") ||
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

export const isMatchingOrigin = (requestOrigin: string | undefined | null, expectedOrigin: string): boolean => {
  if (!requestOrigin) return false;
  if (requestOrigin === expectedOrigin) return true;
  try {
    const reqUrl = new URL(requestOrigin);
    const expUrl = new URL(expectedOrigin);
    if (isPrivateOrLoopback(reqUrl.hostname) && isPrivateOrLoopback(expUrl.hostname) && reqUrl.port === expUrl.port) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

export const createCorsMiddleware = ({ origin }: { origin: string }): RequestHandler =>
  (request, response, next) => {
    const requestOrigin = request.get("origin");
    const allowed = isMatchingOrigin(requestOrigin, origin);
    if (!allowed) {
      console.warn(`[CORS BLOCKED] Request from origin '${requestOrigin ?? "unknown"}' not allowed. Expected loopback matching '${origin}'.`);
    }
    response.setHeader("Access-Control-Allow-Origin", allowed ? (requestOrigin ?? origin) : origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
    response.setHeader("Access-Control-Allow-Private-Network", "true");
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    if (request.method === "OPTIONS") {
      response.sendStatus(HTTP_STATUS.noContent);
      return;
    }
    next();
  };

export const createOriginGuard = (expectedOrigin: string): RequestHandler => (request, response, next) => {
  if (!isMatchingOrigin(request.get("origin"), expectedOrigin)) {
    response.status(HTTP_STATUS.unauthorized).json({
      error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired }
    });
    return;
  }
  next();
};
