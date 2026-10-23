export const HTTP_STATUS = Object.freeze({
  ok: 200,
  created: 201,
  accepted: 202,
  noContent: 204,
  badRequest: 400,
  payloadTooLarge: 413,
  conflict: 409,
  unauthorized: 401,
  tooManyRequests: 429,
  serviceUnavailable: 503,
  notFound: 404,
  internalServerError: 500
} as const);
