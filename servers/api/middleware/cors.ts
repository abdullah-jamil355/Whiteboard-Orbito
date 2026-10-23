import type { RequestHandler } from "express";
import { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } from "../constants/index.js";

export const createCorsMiddleware = ({ origin }: { origin: string }): RequestHandler =>
  (request, response, next) => {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Credentials", "true");
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
  if (request.get("origin") !== expectedOrigin) {
    response.status(HTTP_STATUS.unauthorized).json({
      error: { code: ERROR_CODES.authenticationRequired, message: ERROR_MESSAGES.authenticationRequired }
    });
    return;
  }
  next();
};
