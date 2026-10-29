export type ObservabilityTrace = Readonly<{
  traceId: string;
  timestamp: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  ip: string;
  error?: string;
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
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
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

export const getPrometheusMetricsUrl = (): string => {
  return `${getApiBaseUrl()}/metrics`;
};
