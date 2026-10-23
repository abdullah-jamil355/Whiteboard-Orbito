export const ERROR_MESSAGES = Object.freeze({
  internal: "An unexpected error occurred.",
  routeNotFound: "Route was not found.",
  validation: "Request validation failed.",
  authenticationRequired: "A valid Whiteboard sign-in is required.",
  invalidMagicLink: "This sign-in link is invalid, expired, or already used.",
  rateLimited: "Too many sign-in requests. Try again later.",
  serviceUnavailable: "Whiteboard identity service is temporarily unavailable.",
  sessionNotFound: "The session was not found or is not available to this account.",
  boardTooLarge: "This board is too large for live persistence. Remove content or simplify large strokes, then retry."
} as const);
