import type { ApiErrorCode } from "@workspace/types";

export const ERROR_CODES = Object.freeze({
  internal: "internal_error",
  routeNotFound: "route_not_found",
  validation: "validation_error",
  authenticationRequired: "authentication_required",
  invalidMagicLink: "invalid_magic_link",
  rateLimited: "rate_limited",
  serviceUnavailable: "service_unavailable",
  sessionNotFound: "session_not_found",
  boardTooLarge: "board_too_large"
} as const satisfies Readonly<Record<string, ApiErrorCode>>);
