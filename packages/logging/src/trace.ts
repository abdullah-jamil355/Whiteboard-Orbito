import { randomBytes } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { MetricsRegistry } from "./metrics.js";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m"
};

const getStatusColor = (status: number): string => {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.reset;
};

type GenericRequest = IncomingMessage & {
  originalUrl?: string | undefined;
  baseUrl?: string | undefined;
  route?: { path?: unknown } | undefined;
  traceId?: string | undefined;
  ip?: string | undefined;
};

const normalizeRoutePath = (req: GenericRequest): string => {
  const routeObj = req.route;
  if (routeObj && typeof routeObj.path === "string") {
    const base = req.baseUrl || "";
    return `${base}${routeObj.path}`;
  }
  const rawPath = req.originalUrl || req.url || "/";
  return rawPath.split("?")[0] || "/";
};

export type MiddlewareFunction = (
  req: GenericRequest,
  res: ServerResponse,
  next: (error?: unknown) => void
) => void;

export const createTraceMiddleware = (metrics: MetricsRegistry): MiddlewareFunction => {
  return (req: GenericRequest, res: ServerResponse, next: (error?: unknown) => void): void => {
    const incomingTrace = req.headers["x-request-id"] || req.headers["x-trace-id"];
    const traceId = typeof incomingTrace === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(incomingTrace)
      ? incomingTrace
      : `trc_${randomBytes(4).toString("hex")}`;

    res.setHeader("x-trace-id", traceId);
    req.traceId = traceId;

    const startTime = process.hrtime.bigint();

    res.on("finish", () => {
      const durationNs = process.hrtime.bigint() - startTime;
      const durationMs = Number(durationNs) / 1_000_000;
      const roundedMs = Math.round(durationMs * 10) / 10;
      const route = normalizeRoutePath(req);
      const statusCode = res.statusCode;
      const ip = (req.ip || req.socket.remoteAddress || "127.0.0.1").replace(/^.*:/, "");

      if (route !== "/metrics" && route !== "/observability/stats") {
        metrics.recordRequest({
          traceId,
          method: req.method || "GET",
          route,
          statusCode,
          durationMs,
          ip
        });
      }

      const statusColor = getStatusColor(statusCode);
      const level = statusCode >= 500 ? `${colors.red}ERROR${colors.reset}` : statusCode >= 400 ? `${colors.yellow}WARN ${colors.reset}` : `${colors.green}INFO ${colors.reset}`;
      const timeStr = new Date().toISOString().substring(11, 19);

      console.log(
        `${colors.dim}[${timeStr}]${colors.reset} ${level} ${colors.magenta}[${traceId}]${colors.reset} ${colors.cyan}${req.method || "GET"}${colors.reset} ${route} ${statusColor}${String(statusCode)}${colors.reset} ${colors.dim}${String(roundedMs)}ms${colors.reset} (${ip})`
      );
    });

    next();
  };
};
