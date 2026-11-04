import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import type { Logger } from "@workspace/logging";
import type { MetricsRegistry, TraceFailure } from "@workspace/logging";
import type { ApiErrorResponse } from "@workspace/types";
import { ERROR_CODES, ERROR_MESSAGES, HTTP_STATUS } from "../constants/index.js";
import { createApplicationError, isApplicationError } from "../errors/index.js";

export const createNotFoundHandler = (): RequestHandler => (request, _response, next) => {
  next(createApplicationError({
    code: ERROR_CODES.routeNotFound,
    message: ERROR_MESSAGES.routeNotFound,
    status: HTTP_STATUS.notFound,
    details: { method: request.method, path: request.path }
  }));
};

export const createErrorHandler = ({ logger, metrics }: { logger: Logger; metrics: MetricsRegistry }): ErrorRequestHandler =>
  (error: unknown, _request, response, _next) => {
    const traceId = response.getHeader("x-trace-id");
    const recordFailure = (failure: TraceFailure): void => {
      if (typeof traceId === "string") metrics.recordTraceFailure(traceId, failure);
    };
    if (error instanceof ZodError) {
      recordFailure({
        code: ERROR_CODES.validation,
        type: "ValidationError",
        message: ERROR_MESSAGES.validation,
        details: error.issues.map((issue) => ({ path: issue.path, code: issue.code, message: issue.message }))
      });
      const body: ApiErrorResponse = {
        error: { code: ERROR_CODES.validation, message: ERROR_MESSAGES.validation, details: error.issues }
      };
      response.status(HTTP_STATUS.badRequest).json(body);
      return;
    }
    if (isApplicationError(error)) {
      recordFailure({
        code: error.code,
        type: "ApplicationError",
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details })
      });
      const body: ApiErrorResponse = {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {})
        }
      };
      response.status(error.status).json(body);
      return;
    }
    recordFailure({
      code: ERROR_CODES.internal,
      type: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : String(error)
    });
    logger.error("Unhandled API error.", {
      error: error instanceof Error ? error.message : String(error),
      ...(typeof traceId === "string" ? { traceId } : {})
    });
    const body: ApiErrorResponse = {
      error: { code: ERROR_CODES.internal, message: ERROR_MESSAGES.internal }
    };
    response.status(HTTP_STATUS.internalServerError).json(body);
  };
