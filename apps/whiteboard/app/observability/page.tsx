"use client";

import { useEffect, useState, useCallback, type ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import {
  fetchObservabilityStats,
  getPrometheusMetricsUrl,
  ObservabilityEndpointsTable,
  ObservabilityHeader,
  ObservabilityKpiGrid,
  ObservabilitySystemTelemetry,
  ObservabilityTracesTable,
  SpaceCosmosBackground,
  type ObservabilitySummary
} from "../../features/observability";

export default function ObservabilityDashboardPage(): ReactElement {
  const [data, setData] = useState<ObservabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Sparkline history rolling windows
  const [throughputHistory, setThroughputHistory] = useState<readonly number[]>([4, 8, 6, 12, 9, 16, 14, 20]);
  const [latencyHistory, setLatencyHistory] = useState<readonly number[]>([45, 62, 55, 48, 70, 64, 52, 58]);

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await fetchObservabilityStats();
      setData(stats);
      setError(null);
      setLastRefreshed(new Date());

      setThroughputHistory((prev) => [...prev.slice(-12), stats.requestsPerMinute]);
      setLatencyHistory((prev) => [...prev.slice(-12), stats.averageLatencyMs]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load observability data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(() => loadStats());
  }, [loadStats]);

  useEffect(() => {
    if (!isAutoRefresh) return;
    const interval = setInterval(() => {
      void loadStats();
    }, 3000);
    return () => clearInterval(interval);
  }, [isAutoRefresh, loadStats]);

  const prometheusUrl = getPrometheusMetricsUrl();

  return (
    <div className="relative min-h-screen text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      <SpaceCosmosBackground />

      {/* Subtle celestial grid pattern overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 z-10">
        <ObservabilityHeader
          isAutoRefresh={isAutoRefresh}
          loading={loading}
          onRefresh={() => void loadStats()}
          onToggleAutoRefresh={() => setIsAutoRefresh(!isAutoRefresh)}
          prometheusUrl={prometheusUrl}
        />

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 backdrop-blur-md shadow-lg shadow-rose-950/30">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        <ObservabilityKpiGrid
          data={data}
          latencyHistory={latencyHistory}
          throughputHistory={throughputHistory}
        />

        {data && (
          <ObservabilitySystemTelemetry
            lastRefreshed={lastRefreshed}
            system={data.system}
          />
        )}

        <ObservabilityEndpointsTable
          endpoints={data ? data.endpoints : []}
        />

        <ObservabilityTracesTable
          traces={data ? data.recentTraces : []}
        />

        <footer className="text-center text-xs text-slate-500 pt-6 pb-2">
          Orbito High-Performance Observability Suite • Distributed Tracing • Prometheus OpenMetrics v1.0
        </footer>
      </main>
    </div>
  );
}
