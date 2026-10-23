export type ApiErrorCode =
  | "internal_error"
  | "route_not_found"
  | "validation_error"
  | "authentication_required"
  | "invalid_magic_link"
  | "rate_limited"
  | "session_not_found"
  | "board_too_large"
  | "service_unavailable";

export type ApiErrorDetails = Readonly<Record<string, unknown>> | readonly unknown[];

export type ApiErrorResponse = Readonly<{
  error: Readonly<{
    code: ApiErrorCode;
    message: string;
    details?: ApiErrorDetails;
  }>;
}>;
