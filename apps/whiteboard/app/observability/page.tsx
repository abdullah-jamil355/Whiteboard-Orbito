"use client";

import { useEffect, useState, useCallback, type ReactElement } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Server,
  Zap
} from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/primitives/card";
import { Badge } from "@workspace/ui/primitives/badge";
import { Progress } from "@workspace/ui/primitives/progress";
import {
  fetchObservabilityStats,
  getPrometheusMetricsUrl,
  type ObservabilitySummary
} from "../../features/board/api-client";

const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${String(d)}d ${String(h)}h ${String(m)}m`;
  if (h > 0) return `${String(h)}h ${String(m)}m ${String(s)}s`;
  if (m > 0) return `${String(m)}m ${String(s)}s`;
  return `${String(s)}s`;
};

const getMethodBadgeClass = (method: string): string => {
  switch (method.toUpperCase()) {
    case "GET":
      return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    case "POST":
      return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
    case "DELETE":
      return "bg-rose-500/10 text-rose-500 border-rose-500/20";
    case "PATCH":
    case "PUT":
      return "bg-amber-500/10 text-amber-500 border-amber-500/20";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getStatusBadge = (statusCode: number): ReactElement => {
  if (statusCode >= 500) {
    return (
      <Badge className="bg-red-500/10 text-red-500 border-red-500/20" variant="outline">
        {statusCode} Error
      </Badge>
    );
  }
  if (statusCode >= 400) {
    return (
      <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20" variant="outline">
        {statusCode} Client
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20" variant="outline">
      {statusCode} OK
    </Badge>
  );
};

export default function ObservabilityDashboardPage(): ReactElement {
  const [data, setData] = useState<ObservabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [copiedTrace, setCopiedTrace] = useState<string | null>(null);

  const loadStats = useCallback(async (): Promise<void> => {
    try {
      const stats = await fetchObservabilityStats();
      setData(stats);
      setError(null);
      setLastRefreshed(new Date());
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

  const copyTraceId = (id: string): void => {
    void navigator.clipboard.writeText(id);
    setCopiedTrace(id);
    setTimeout(() => setCopiedTrace(null), 2000);
  };

  const prometheusUrl = getPrometheusMetricsUrl();

  return (
    <main className="min-h-screen bg-background text-foreground p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Orbito Observability & KPIs</h1>
              <p className="text-sm text-muted-foreground">
                Real-time API performance, request load, traceability logs & system health
              </p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center flex-wrap gap-2">
          <Button
            onClick={() => setIsAutoRefresh(!isAutoRefresh)}
            size="sm"
            variant={isAutoRefresh ? "default" : "outline"}
          >
            {isAutoRefresh ? (
              <>
                <Pause className="h-4 w-4 mr-1.5" /> Auto-refreshing (3s)
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-1.5" /> Resume Auto-refresh
              </>
            )}
          </Button>

          <Button disabled={loading} onClick={() => void loadStats()} size="sm" variant="outline">
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>

          <a href={prometheusUrl} rel="noreferrer" target="_blank">
            <Button size="sm" variant="secondary">
              <ExternalLink className="h-4 w-4 mr-1.5" /> Raw /metrics (Prometheus)
            </Button>
          </a>

          <Link href="/">
            <Button size="sm" variant="ghost">
              ← Whiteboard
            </Button>
          </Link>
        </div>
      </header>

      {error && (
        <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Highlights Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Throughput */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Traffic Throughput</CardTitle>
            <Zap className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? data.totalRequests.toLocaleString() : "—"}
              <span className="text-xs font-normal text-muted-foreground ml-1">total calls</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Load: <span className="font-semibold text-foreground">{data ? String(data.requestsPerMinute) : "0"}</span> req / min
            </p>
          </CardContent>
        </Card>

        {/* Latency */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Average Latency</CardTitle>
            <Clock className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? `${String(data.averageLatencyMs)} ms` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data && data.averageLatencyMs < 100 ? (
                <span className="text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> High responsiveness
                </span>
              ) : (
                <span>Average execution speed</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Error Rate */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Error Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? `${String(data.errorRatePercent)}%` : "—"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data && data.errorRatePercent === 0 ? (
                <span className="text-emerald-500 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Zero failed requests
                </span>
              ) : (
                <span>4xx & 5xx HTTP exceptions</span>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Live Collaboration State */}
        <Card className="border-border">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Live Collaboration</CardTitle>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data ? String(data.activeSessions) : "—"}
              <span className="text-xs font-normal text-muted-foreground ml-1">active rooms</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {data ? `${String(data.activeConnections)} live WebSocket peers` : "Realtime sync status"}
            </p>
          </CardContent>
        </Card>
      </section>

      {/* System Resource Health (Hardware & Memory) */}
      {data && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" />
              <h2 className="text-base font-semibold">Node.js Runtime & Memory KPIs</h2>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Node: {data.system.nodeVersion}</span>
              <span>Uptime: {formatUptime(data.system.uptimeSeconds)}</span>
              <span>Last update: {lastRefreshed.toLocaleTimeString()}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Database className="h-4 w-4" /> Heap Memory Used
                </span>
                <span className="font-semibold">
                  {data.system.heapUsedMb} MB / {data.system.heapTotalMb} MB
                </span>
              </div>
              <Progress className="h-2" value={data.system.usagePercent} />
              <p className="text-xs text-muted-foreground mt-1">
                {data.system.usagePercent}% of allocated V8 heap capacity
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Cpu className="h-4 w-4" /> Resident Set Size (RSS)
                </span>
                <span className="font-semibold">{data.system.rssMb} MB</span>
              </div>
              <Progress className="h-2" value={Math.min(100, Math.round((data.system.rssMb / 512) * 100))} />
              <p className="text-xs text-muted-foreground mt-1">Total physical RAM consumed by process</p>
            </div>

            <div className="flex flex-col justify-center">
              <div className="text-sm text-muted-foreground">Engine Status</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
                </span>
                <span className="text-sm font-semibold text-emerald-500">Express 5 + Hocuspocus Normal</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* API Endpoints Performance Breakdown */}
      <section className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">API Endpoint Performance & Load</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Breakdown of incoming load, latencies, and success rate grouped by route
            </p>
          </div>
          <Badge variant="outline">{data ? `${String(data.endpoints.length)} Endpoints Tracked` : "..."}</Badge>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <tr>
                <th className="py-3 px-4">Method & Route</th>
                <th className="py-3 px-4 text-right">Total Hits</th>
                <th className="py-3 px-4 text-right">Avg Latency</th>
                <th className="py-3 px-4 text-right">Min / Max</th>
                <th className="py-3 px-4 text-right">Success Rate</th>
                <th className="py-3 px-4 text-right">Last Invoked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data && data.endpoints.length > 0 ? (
                data.endpoints.map((ep) => (
                  <tr className="hover:bg-muted/30 transition-colors" key={`${ep.method}-${ep.route}`}>
                    <td className="py-3 px-4 font-mono text-xs flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getMethodBadgeClass(ep.method)}`}>
                        {ep.method}
                      </span>
                      <span className="text-foreground">{ep.route}</span>
                    </td>
                    <td className="py-3 px-4 text-right font-semibold">{ep.hits.toLocaleString()}</td>
                    <td className="py-3 px-4 text-right font-mono">
                      <span className={ep.avgDurationMs > 300 ? "text-amber-500 font-semibold" : "text-foreground"}>
                        {ep.avgDurationMs} ms
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-muted-foreground">
                      {ep.minDurationMs}ms / {ep.maxDurationMs}ms
                    </td>
                    <td className="py-3 px-4 text-right">
                      <span className={`text-xs font-semibold ${ep.successRatePercent === 100 ? "text-emerald-500" : ep.successRatePercent > 90 ? "text-amber-500" : "text-red-500"}`}>
                        {ep.successRatePercent}%
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right text-xs text-muted-foreground">
                      {new Date(ep.lastCalledAt).toLocaleTimeString()}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-8 text-center text-muted-foreground" colSpan={6}>
                    No API traffic recorded yet. Make some requests on Orbito!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Live Traceability & Error Logs */}
      <section className="rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold">Live Request Traceability (Trace Log)</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unique Trace IDs assigned to each request for instant conflict and error identification
            </p>
          </div>
          <Badge variant="outline">Last {data ? String(data.recentTraces.length) : "0"} Traces</Badge>
        </div>

        <div className="overflow-x-auto max-h-[480px]">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wider sticky top-0 border-b border-border bg-card/95 backdrop-blur">
              <tr>
                <th className="py-3 px-4">Trace ID</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Method & Route</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Latency</th>
                <th className="py-3 px-4 text-right">Client IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data && data.recentTraces.length > 0 ? (
                data.recentTraces.map((trace) => (
                  <tr className="hover:bg-muted/30 transition-colors font-mono text-xs" key={trace.traceId}>
                    <td className="py-3 px-4">
                      <button
                        className="text-primary hover:underline flex items-center gap-1"
                        onClick={() => copyTraceId(trace.traceId)}
                        title="Click to copy Trace ID"
                        type="button"
                      >
                        <span>{trace.traceId}</span>
                        {copiedTrace === trace.traceId ? (
                          <span className="text-[10px] text-emerald-500 font-sans">Copied!</span>
                        ) : (
                          <ArrowUpRight className="h-3 w-3 opacity-60" />
                        )}
                      </button>
                    </td>
                    <td className="py-3 px-4 text-muted-foreground font-sans">
                      {new Date(trace.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-3 px-4 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${getMethodBadgeClass(trace.method)}`}>
                        {trace.method}
                      </span>
                      <span className="text-foreground">{trace.route}</span>
                      {trace.error && (
                        <span className="text-red-500 text-[10px] font-sans">({trace.error})</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-sans">{getStatusBadge(trace.statusCode)}</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{trace.durationMs} ms</td>
                    <td className="py-3 px-4 text-right text-muted-foreground">{trace.ip}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="py-8 text-center text-muted-foreground font-sans" colSpan={6}>
                    No recent request traces captured yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Bottom Footer */}
      <footer className="text-center text-xs text-muted-foreground pt-4 border-t border-border">
        Orbito Monorepo Observability • Standards-compliant Metrics & Distributed Traceability
      </footer>
    </main>
  );
}
