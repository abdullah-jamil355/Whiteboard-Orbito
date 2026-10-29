import client from "prom-client";

export type TraceRecord = Readonly<{
  traceId: string;
  timestamp: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  error?: string;
  details?: Readonly<Record<string, unknown>>;
}>;

export type RouteMetric = Readonly<{
  method: string;
  route: string;
  hits: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  successRatePercent: number;
  lastCalledAt: string;
}>;

export type SystemHealthKpi = Readonly<{
  heapUsedMb: number;
  heapTotalMb: number;
  rssMb: number;
  usagePercent: number;
  uptimeSeconds: number;
  nodeVersion: string;
}>;

export type ObservabilitySummary = Readonly<{
  totalRequests: number;
  requestsPerMinute: number;
  averageLatencyMs: number;
  errorRatePercent: number;
  activeSessions: number;
  activeConnections: number;
  system: SystemHealthKpi;
  endpoints: readonly RouteMetric[];
  recentTraces: readonly TraceRecord[];
}>;

export type RecordRequestParams = Readonly<{
  traceId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  error?: string;
  details?: Readonly<Record<string, unknown>>;
}>;

export type MetricsRegistry = Readonly<{
  recordRequest: (params: RecordRequestParams) => void;
  getSummary: () => ObservabilitySummary;
  getPrometheusMetrics: () => Promise<string>;
  getPrometheusContentType: () => string;
}>;

type MetricsOptions = Readonly<{
  getActiveSessionsCount?: () => number;
  getActiveConnectionsCount?: () => number;
  maxRecentTraces?: number;
}>;

export const createMetricsRegistry = ({
  getActiveSessionsCount = () => 0,
  getActiveConnectionsCount = () => 0,
  maxRecentTraces = 100
}: MetricsOptions = {}): MetricsRegistry => {
  const register = new client.Registry();
  register.setDefaultLabels({ app: "orbito-api" });
  client.collectDefaultMetrics({ register });

  const httpRequestsTotal = new client.Counter({
    name: "http_requests_total",
    help: "Total number of HTTP requests processed by Orbito API",
    labelNames: ["method", "route", "status"],
    registers: [register]
  });

  const httpRequestDuration = new client.Histogram({
    name: "http_request_duration_seconds",
    help: "HTTP request latency in seconds",
    labelNames: ["method", "route", "status"],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [register]
  });

  new client.Gauge({
    name: "active_whiteboard_sessions",
    help: "Number of currently active Whiteboard sessions",
    registers: [register],
    collect() {
      this.set(getActiveSessionsCount());
    }
  });

  new client.Gauge({
    name: "active_realtime_connections",
    help: "Number of active realtime WebSocket peer connections",
    registers: [register],
    collect() {
      this.set(getActiveConnectionsCount());
    }
  });

  const recentTraces: TraceRecord[] = [];
  const routeStatsMap = new Map<string, {
    method: string;
    route: string;
    hits: number;
    totalDurationMs: number;
    minDurationMs: number;
    maxDurationMs: number;
    successHits: number;
    lastCalledAt: Date;
  }>();

  const startTime = Date.now();
  let totalRequestsCount = 0;
  let totalErrorsCount = 0;
  let cumulativeDurationMs = 0;

  const recordRequest = (params: RecordRequestParams): void => {
    totalRequestsCount += 1;
    cumulativeDurationMs += params.durationMs;

    const isError = params.statusCode >= 400;
    if (isError) totalErrorsCount += 1;

    const statusCategory = String(params.statusCode);
    httpRequestsTotal.inc({ method: params.method, route: params.route, status: statusCategory });
    httpRequestDuration.observe({ method: params.method, route: params.route, status: statusCategory }, params.durationMs / 1000);

    const record: TraceRecord = Object.freeze({
      traceId: params.traceId,
      timestamp: new Date().toISOString(),
      method: params.method,
      route: params.route,
      statusCode: params.statusCode,
      durationMs: Math.round(params.durationMs * 10) / 10,
      ip: params.ip,
      ...(params.error ? { error: params.error } : {}),
      ...(params.details ? { details: params.details } : {})
    });

    recentTraces.unshift(record);
    if (recentTraces.length > maxRecentTraces) {
      recentTraces.pop();
    }

    const key = `${params.method}:${params.route}`;
    const existing = routeStatsMap.get(key);
    if (existing) {
      existing.hits += 1;
      existing.totalDurationMs += params.durationMs;
      existing.minDurationMs = Math.min(existing.minDurationMs, params.durationMs);
      existing.maxDurationMs = Math.max(existing.maxDurationMs, params.durationMs);
      if (!isError) existing.successHits += 1;
      existing.lastCalledAt = new Date();
    } else {
      routeStatsMap.set(key, {
        method: params.method,
        route: params.route,
        hits: 1,
        totalDurationMs: params.durationMs,
        minDurationMs: params.durationMs,
        maxDurationMs: params.durationMs,
        successHits: isError ? 0 : 1,
        lastCalledAt: new Date()
      });
    }
  };

  const getSystemHealth = (): SystemHealthKpi => {
    const mem = process.memoryUsage();
    const heapUsedMb = Math.round((mem.heapUsed / (1024 * 1024)) * 10) / 10;
    const heapTotalMb = Math.round((mem.heapTotal / (1024 * 1024)) * 10) / 10;
    const rssMb = Math.round((mem.rss / (1024 * 1024)) * 10) / 10;
    const usagePercent = heapTotalMb > 0 ? Math.round((heapUsedMb / heapTotalMb) * 100) : 0;

    return Object.freeze({
      heapUsedMb,
      heapTotalMb,
      rssMb,
      usagePercent,
      uptimeSeconds: Math.floor(process.uptime()),
      nodeVersion: process.version
    });
  };

  const getSummary = (): ObservabilitySummary => {
    const elapsedMinutes = Math.max(0.1, (Date.now() - startTime) / 60_000);
    const requestsPerMinute = Math.round((totalRequestsCount / elapsedMinutes) * 10) / 10;
    const averageLatencyMs = totalRequestsCount > 0 ? Math.round((cumulativeDurationMs / totalRequestsCount) * 10) / 10 : 0;
    const errorRatePercent = totalRequestsCount > 0 ? Math.round((totalErrorsCount / totalRequestsCount) * 1000) / 10 : 0;

    const endpoints: RouteMetric[] = Array.from(routeStatsMap.values())
      .map((item) => Object.freeze({
        method: item.method,
        route: item.route,
        hits: item.hits,
        avgDurationMs: Math.round((item.totalDurationMs / item.hits) * 10) / 10,
        minDurationMs: Math.round(item.minDurationMs * 10) / 10,
        maxDurationMs: Math.round(item.maxDurationMs * 10) / 10,
        successRatePercent: Math.round((item.successHits / item.hits) * 100),
        lastCalledAt: item.lastCalledAt.toISOString()
      }))
      .sort((a, b) => b.hits - a.hits);

    return Object.freeze({
      totalRequests: totalRequestsCount,
      requestsPerMinute,
      averageLatencyMs,
      errorRatePercent,
      activeSessions: getActiveSessionsCount(),
      activeConnections: getActiveConnectionsCount(),
      system: getSystemHealth(),
      endpoints,
      recentTraces: [...recentTraces]
    });
  };

  return Object.freeze({
    recordRequest,
    getSummary,
    getPrometheusMetrics: () => register.metrics(),
    getPrometheusContentType: () => register.contentType
  });
};
