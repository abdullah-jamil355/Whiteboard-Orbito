export type ObservabilityTrace = Readonly<{
  traceId: string;
  timestamp: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  error?: string;
  errorCode?: string;
  errorType?: string;
  errorDetails?: unknown;
}>;

export type ObservabilityEndpointStat = Readonly<{
  method: string;
  route: string;
  hits: number;
  avgDurationMs: number;
  minDurationMs: number;
  maxDurationMs: number;
  successRatePercent: number;
  lastCalledAt: string;
}>;

export type ObservabilitySummary = Readonly<{
  totalRequests: number;
  requestsPerMinute: number;
  averageLatencyMs: number;
  errorRatePercent: number;
  activeSessions: number;
  activeConnections: number;
  activeRooms: readonly Readonly<{ sessionId: string; connections: number }>[];
  system: Readonly<{
    heapUsedMb: number;
    heapTotalMb: number;
    rssMb: number;
    usagePercent: number;
    uptimeSeconds: number;
    nodeVersion: string;
  }>;
  endpoints: readonly ObservabilityEndpointStat[];
  recentTraces: readonly ObservabilityTrace[];
}>;

const getApiBaseUrl = (): string => {
  return process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_WHITEBOARD_API_ORIGIN ?? "http://localhost:4000";
};

export const fetchObservabilityStats = async (): Promise<ObservabilitySummary> => {
  const response = await fetch(`${getApiBaseUrl()}/observability/stats`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch observability stats: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<ObservabilitySummary>;
};

export const fetchObservabilityTrace = async (traceId: string): Promise<ObservabilityTrace> => {
  const response = await fetch(`${getApiBaseUrl()}/observability/traces/${encodeURIComponent(traceId)}`, {
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? `Failed to find trace: ${response.status}`);
  }
  const body = await response.json() as { trace: ObservabilityTrace };
  return body.trace;
};

export const resetObservabilityStats = async (): Promise<void> => {
  const response = await fetch(`${getApiBaseUrl()}/observability/reset`, {
    method: "POST",
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`Failed to reset observability stats: ${response.status}`);
  }
};

export const getPrometheusMetricsUrl = (): string => {
  return `${getApiBaseUrl()}/metrics`;
};
