"use client";

import { useEffect, useState, useCallback, type ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import {
  fetchObservabilityStats,
  getObservabilityStreamUrl,
  resetObservabilityStats,
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
  const [streamConnected, setStreamConnected] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Sparkline history rolling windows
  const [throughputHistory, setThroughputHistory] = useState<readonly number[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<readonly number[]>([]);
  const [roomHistory, setRoomHistory] = useState<readonly number[]>([]);

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await fetchObservabilityStats();
      setData(stats);
      setError(null);
      setLastRefreshed(new Date());

      setThroughputHistory((prev) => [...prev.slice(-12), stats.requestsPerMinute]);
      setLatencyHistory((prev) => [...prev.slice(-12), stats.averageLatencyMs]);
      setRoomHistory((prev) => [...prev.slice(-12), stats.activeSessions]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load observability data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleReset = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      await resetObservabilityStats();
      await loadStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset metrics.");
    } finally {
      setLoading(false);
    }
  }, [loadStats]);

  useEffect(() => {
    void Promise.resolve().then(() => loadStats());
  }, [loadStats]);

  useEffect(() => {
    if (!isAutoRefresh) return;
    const source = new EventSource(getObservabilityStreamUrl());
    let fallback: ReturnType<typeof setInterval> | undefined;
    const setStreamData = (event: MessageEvent<string>): void => {
      try {
        const stats = JSON.parse(event.data) as ObservabilitySummary;
        setData(stats);
        setError(null);
        setLoading(false);
        setLastRefreshed(new Date());
        setThroughputHistory((prev) => [...prev.slice(-12), stats.requestsPerMinute]);
        setLatencyHistory((prev) => [...prev.slice(-12), stats.averageLatencyMs]);
        setRoomHistory((prev) => [...prev.slice(-12), stats.activeSessions]);
      } catch {
        setError("Observability stream returned invalid data.");
      }
    };
    source.addEventListener("stats", setStreamData as EventListener);
    source.onopen = () => {
      setStreamConnected(true);
      if (fallback) clearInterval(fallback);
      fallback = undefined;
    };
    source.onerror = () => {
      setStreamConnected(false);
      if (!fallback) fallback = setInterval(() => { void loadStats(); }, 1000);
    };
    return () => {
      setStreamConnected(false);
      source.close();
      if (fallback) clearInterval(fallback);
    };
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
          streamConnected={streamConnected}
          loading={loading}
          onRefresh={() => void loadStats()}
          onReset={() => void handleReset()}
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
          roomHistory={roomHistory}
          throughputHistory={throughputHistory}
        />

        {data && (
          <section aria-labelledby="active-rooms-title" className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 shadow-xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-white" id="active-rooms-title">Current live rooms</h2>
                <p className="mt-1 text-xs text-slate-400">Rooms with at least one connected realtime participant</p>
              </div>
              <span className="rounded-full border border-purple-400/20 bg-purple-400/10 px-2.5 py-1 text-xs font-medium text-purple-200">{data.activeRooms.length} active</span>
            </div>
            {data.activeRooms.length === 0 ? (
              <p className="px-5 py-6 text-sm text-slate-400">No live rooms are connected right now.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {data.activeRooms.map((room) => (
                  <li className="flex items-center justify-between gap-4 px-5 py-3" key={room.sessionId}>
                    <span className="truncate font-mono text-xs text-slate-300" title={room.sessionId}>{room.sessionId}</span>
                    <span className="shrink-0 text-xs text-slate-400">{room.connections} {room.connections === 1 ? "participant" : "participants"}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {data && (
          <ObservabilitySystemTelemetry
            lastRefreshed={lastRefreshed}
            system={data.system}
          />
        )}

        <section className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 shadow-xl backdrop-blur-xl">
          <div className="border-b border-white/[0.08] px-5 py-4">
            <h2 className="text-sm font-semibold text-white">Live user activity</h2>
            <p className="mt-1 text-xs text-slate-400">Accepted board edits, undo/redo, participant connections, and presence updates. Board content and cursor coordinates are not recorded.</p>
          </div>
          {data?.recentRealtimeActivity.length ? (
            <ul className="divide-y divide-white/[0.06]">
              {data.recentRealtimeActivity.slice(0, 20).map((activity, index) => (
                <li className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-xs" key={`${activity.timestamp}-${activity.event}-${index}`}>
                  <span className="font-medium text-slate-200">{activity.event.replaceAll(".", " ")}{activity.count ? ` · ${String(activity.count)} ${activity.count === 1 ? "change" : "changes"}` : ""}</span>
                  <span className="font-mono text-slate-400">{activity.role} · {activity.sessionId}</span>
                  <time className="text-slate-500">{new Date(activity.timestamp).toLocaleTimeString()}</time>
                </li>
              ))}
            </ul>
          ) : <p className="px-5 py-6 text-sm text-slate-400">No realtime user activity has been recorded yet.</p>}
        </section>

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
