"use client";

import { useEffect, useState, useCallback, useMemo, useRef, type ReactElement } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Cpu,
  Database,
  ExternalLink,
  Layers,
  Pause,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Zap
} from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";
import { Badge } from "@workspace/ui/primitives/badge";
import {
  fetchObservabilityStats,
  getPrometheusMetricsUrl,
  type ObservabilitySummary
} from "../../features/board/api-client";

type SparklineProps = Readonly<{
  data: readonly number[];
  color: string;
  fillId: string;
  height?: number;
}>;

const Sparkline = ({ data, color, fillId, height = 36 }: SparklineProps): ReactElement => {
  const points = data.length > 1 ? data : [0, 5, 2, 8, 4, 10];
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const width = 120;

  const step = width / (points.length - 1 || 1);
  const coords = points.map((val, idx) => {
    const x = idx * step;
    const y = height - ((val - min) / range) * (height - 8) - 4;
    return { x, y };
  });

  const pathD = coords.reduce((acc, curr, idx, arr) => {
    if (idx === 0) return `M ${curr.x} ${curr.y}`;
    const prev = arr[idx - 1]!;
    const cp1x = prev.x + (curr.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (curr.x - prev.x) / 2;
    const cp2y = curr.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
  }, "");

  const areaD = `${pathD} L ${width} ${height} L 0 ${height} Z`;

  return (
    <svg className="overflow-visible w-full h-9" height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={fillId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${fillId})`} />
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  );
};

type AnimatedCounterProps = Readonly<{
  value: number;
  decimals?: number;
  duration?: number;
}>;

const AnimatedCounter = ({ value, decimals = 0, duration = 1400 }: AnimatedCounterProps): ReactElement => {
  const [displayValue, setDisplayValue] = useState(0);
  const startValueRef = useRef(0);

  useEffect(() => {
    let startTimestamp: number | null = null;
    const startValue = startValueRef.current;
    const diff = value - startValue;

    if (diff === 0) return;

    let animationFrameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutExpo easing function
      const ease = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = startValue + diff * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(step);
      } else {
        startValueRef.current = value;
        setDisplayValue(value);
      }
    };

    animationFrameId = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(animationFrameId);
      startValueRef.current = value;
    };
  }, [value, duration]);

  return (
    <>
      {decimals > 0
        ? displayValue.toFixed(decimals)
        : Math.round(displayValue).toLocaleString()}
    </>
  );
};

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
      return "bg-blue-500/15 text-blue-400 border-blue-500/30";
    case "POST":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    case "DELETE":
      return "bg-rose-500/15 text-rose-400 border-rose-500/30";
    case "PATCH":
    case "PUT":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    case "OPTIONS":
      return "bg-slate-700/40 text-slate-400 border-slate-700/50";
    default:
      return "bg-slate-800 text-slate-300 border-slate-700";
  }
};

const getStatusBadge = (statusCode: number): ReactElement => {
  if (statusCode >= 500) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
        {statusCode} Error
      </span>
    );
  }
  if (statusCode >= 400) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        {statusCode} Client
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
      {statusCode} OK
    </span>
  );
};

const SpaceCosmosBackground = (): ReactElement => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener("resize", handleResize);

    // Generate static + drifting twinkling stars
    const starCount = 180;
    const stars = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.8 + 0.7,
      alpha: Math.random() * 0.7 + 0.3,
      alphaChange: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1),
      vx: (Math.random() - 0.5) * 0.12,
      vy: (Math.random() - 0.5) * 0.12,
      isCyan: Math.random() > 0.65
    }));

    type ShootingStar = {
      x: number;
      y: number;
      length: number;
      speed: number;
      angle: number;
      opacity: number;
      fadeSpeed: number;
      active: boolean;
    };

    const shootingStars: ShootingStar[] = [];

    const spawnShootingStar = () => {
      const startX = Math.random() * width * 0.9;
      const startY = Math.random() * (height * 0.45);
      shootingStars.push({
        x: startX,
        y: startY,
        length: Math.random() * 100 + 110,
        speed: Math.random() * 10 + 15,
        angle: (Math.PI / 4) + (Math.random() - 0.5) * 0.25,
        opacity: 1,
        fadeSpeed: 0.012 + Math.random() * 0.008,
        active: true
      });
    };

    // Spawn first shooting star right after 400ms so user sees it instantly
    const initialTimer = setTimeout(() => {
      spawnShootingStar();
    }, 400);

    let lastSpawnTime = performance.now();
    let nextSpawnDelay = 1800 + Math.random() * 2200;

    const render = (time: number) => {
      ctx.clearRect(0, 0, width, height);

      // Deep space base background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, "#050813");
      bgGrad.addColorStop(0.5, "#070c1b");
      bgGrad.addColorStop(1, "#0a1024");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Distant glowing cosmic nebulae
      const nebula1 = ctx.createRadialGradient(width * 0.25, height * 0.2, 20, width * 0.25, height * 0.2, width * 0.5);
      nebula1.addColorStop(0, "rgba(56, 189, 248, 0.10)");
      nebula1.addColorStop(1, "transparent");
      ctx.fillStyle = nebula1;
      ctx.fillRect(0, 0, width, height);

      const nebula2 = ctx.createRadialGradient(width * 0.8, height * 0.7, 20, width * 0.8, height * 0.7, width * 0.45);
      nebula2.addColorStop(0, "rgba(168, 85, 247, 0.09)");
      nebula2.addColorStop(1, "transparent");
      ctx.fillStyle = nebula2;
      ctx.fillRect(0, 0, width, height);

      // Draw and animate twinkling stars
      for (const star of stars) {
        star.alpha += star.alphaChange;
        if (star.alpha <= 0.2 || star.alpha >= 1) {
          star.alphaChange = -star.alphaChange;
        }
        star.x += star.vx;
        star.y += star.vy;
        if (star.x < 0) star.x = width;
        if (star.x > width) star.x = 0;
        if (star.y < 0) star.y = height;
        if (star.y > height) star.y = 0;

        ctx.beginPath();
        ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
        const color = star.isCyan
          ? `rgba(186, 230, 253, ${Math.max(0, Math.min(1, star.alpha))})`
          : `rgba(255, 255, 255, ${Math.max(0, Math.min(1, star.alpha))})`;
        ctx.fillStyle = color;
        if (star.radius > 1.2) {
          ctx.shadowBlur = 6;
          ctx.shadowColor = star.isCyan ? "rgba(56, 189, 248, 0.9)" : "rgba(255, 255, 255, 0.8)";
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // Spawn periodic shooting stars
      if (time - lastSpawnTime > nextSpawnDelay) {
        spawnShootingStar();
        // Occasional cluster of 2 or 3 shooting stars
        if (Math.random() > 0.4) {
          setTimeout(spawnShootingStar, 250 + Math.random() * 250);
        }
        lastSpawnTime = time;
        nextSpawnDelay = 1800 + Math.random() * 2500;
      }

      // Render shooting stars with glowing luminous tail
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i]!;
        if (!s.active) {
          shootingStars.splice(i, 1);
          continue;
        }

        s.x += Math.cos(s.angle) * s.speed;
        s.y += Math.sin(s.angle) * s.speed;
        s.opacity -= s.fadeSpeed;

        if (s.opacity <= 0 || s.x > width || s.y > height) {
          s.active = false;
          continue;
        }

        const tailX = s.x - Math.cos(s.angle) * s.length;
        const tailY = s.y - Math.sin(s.angle) * s.length;

        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255, 255, 255, ${s.opacity})`);
        grad.addColorStop(0.25, `rgba(56, 189, 248, ${s.opacity * 0.95})`);
        grad.addColorStop(0.7, `rgba(99, 102, 241, ${s.opacity * 0.4})`);
        grad.addColorStop(1, "rgba(56, 189, 248, 0)");

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.2;
        ctx.lineCap = "round";
        ctx.shadowBlur = 12;
        ctx.shadowColor = "rgba(56, 189, 248, 0.95)";
        ctx.stroke();

        // Glowing star tip
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
        ctx.shadowBlur = 14;
        ctx.shadowColor = "#ffffff";
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      clearTimeout(initialTimer);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return <canvas className="fixed inset-0 pointer-events-none z-0 w-full h-full" ref={canvasRef} />;
};

export default function ObservabilityDashboardPage(): ReactElement {
  const [data, setData] = useState<ObservabilitySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAutoRefresh, setIsAutoRefresh] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [copiedTrace, setCopiedTrace] = useState<string | null>(null);

  // Sparkline history rolling windows
  const [throughputHistory, setThroughputHistory] = useState<readonly number[]>([4, 8, 6, 12, 9, 16, 14, 20]);
  const [latencyHistory, setLatencyHistory] = useState<readonly number[]>([45, 62, 55, 48, 70, 64, 52, 58]);

  // Trace list filters
  const [traceSearch, setTraceSearch] = useState("");
  const [traceFilter, setTraceFilter] = useState<"all" | "errors" | "success" | "slow">("all");

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

  const copyTraceId = (id: string): void => {
    void navigator.clipboard.writeText(id);
    setCopiedTrace(id);
    setTimeout(() => setCopiedTrace(null), 2000);
  };

  const prometheusUrl = getPrometheusMetricsUrl();

  const filteredTraces = useMemo(() => {
    if (!data) return [];
    return data.recentTraces.filter((trace) => {
      const matchesSearch =
        traceSearch.trim() === "" ||
        trace.traceId.toLowerCase().includes(traceSearch.toLowerCase()) ||
        trace.route.toLowerCase().includes(traceSearch.toLowerCase()) ||
        trace.method.toLowerCase().includes(traceSearch.toLowerCase()) ||
        trace.ip.toLowerCase().includes(traceSearch.toLowerCase());

      if (!matchesSearch) return false;

      if (traceFilter === "errors") return trace.statusCode >= 400;
      if (traceFilter === "success") return trace.statusCode >= 200 && trace.statusCode < 400;
      if (traceFilter === "slow") return trace.durationMs > 250;
      return true;
    });
  }, [data, traceSearch, traceFilter]);

  return (
    <div className="relative min-h-screen text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200 overflow-x-hidden">
      <SpaceCosmosBackground />

      {/* Subtle celestial grid pattern overlay */}
      <div className="fixed inset-0 pointer-events-none z-[1] overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:32px_32px]" />
      </div>

      <main className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 z-10">
        {/* Top Header Card */}
        <header className="relative rounded-3xl border border-white/[0.08] bg-[#0E1526]/75 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/40 overflow-hidden">
          {/* Subtle gradient border accent top */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-80" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="flex items-start sm:items-center gap-4">
              <div className="relative flex-shrink-0 w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 p-[1px] shadow-lg shadow-cyan-500/25">
                <div className="w-full h-full rounded-2xl bg-[#090D18] flex items-center justify-center text-cyan-400">
                  <Activity className="h-6 w-6 animate-pulse" />
                </div>
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                    Orbito Observability & KPIs
                  </h1>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                    </span>
                    Live Telemetry
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">
                  Real-time micro-metrics, Prometheus exporter, active sessions & distributed request tracing
                </p>
              </div>
            </div>

            {/* Action Buttons Bar */}
            <div className="flex items-center flex-wrap gap-2.5">
              <Button
                className={`transition-all duration-200 border ${
                  isAutoRefresh
                    ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                    : "bg-slate-800/80 text-slate-300 border-white/10 hover:bg-slate-800"
                }`}
                onClick={() => setIsAutoRefresh(!isAutoRefresh)}
                size="sm"
                variant="outline"
              >
                {isAutoRefresh ? (
                  <>
                    <Pause className="h-4 w-4 mr-1.5 text-cyan-400" /> Auto-refreshing (3s)
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-1.5" /> Resume Auto-refresh
                  </>
                )}
              </Button>

              <Button
                className="bg-slate-800/80 text-slate-200 border-white/10 hover:bg-slate-700/80 hover:text-white transition-all"
                disabled={loading}
                onClick={() => void loadStats()}
                size="sm"
                variant="outline"
              >
                <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin text-cyan-400" : ""}`} /> Refresh
              </Button>

              <a href={prometheusUrl} rel="noreferrer" target="_blank">
                <Button
                  className="bg-purple-500/15 text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 transition-all shadow-[0_0_15px_rgba(168,85,247,0.15)]"
                  size="sm"
                  variant="outline"
                >
                  <ExternalLink className="h-4 w-4 mr-1.5" /> /metrics (Prometheus)
                </Button>
              </a>

              <Link href="/">
                <Button
                  className="bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-all"
                  size="sm"
                  variant="outline"
                >
                  ← Whiteboard
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 flex items-center gap-3 backdrop-blur-md shadow-lg shadow-rose-950/30">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-400" />
            <span className="text-sm font-medium">{error}</span>
          </div>
        )}

        {/* 4 Interactive Glassmorphic KPI Highlights */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {/* 1. Traffic Throughput */}
          <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl p-5 shadow-xl transition-all duration-300 hover:border-amber-500/40 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(245,158,11,0.2)]">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Traffic Throughput</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {data ? <AnimatedCounter value={data.totalRequests} /> : "—"}
              </span>
              <span className="text-xs text-slate-400 font-medium">total requests</span>
            </div>
            <div className="mt-2 text-xs text-slate-400 flex items-center justify-between">
              <span>Velocity:</span>
              <span className="font-mono font-bold text-amber-300">
                {data ? <AnimatedCounter decimals={1} value={data.requestsPerMinute} /> : "0"} req/min
              </span>
            </div>
            {/* Sparkline chart */}
            <div className="mt-3 pt-2 border-t border-white/5">
              <Sparkline color="#f59e0b" data={throughputHistory} fillId="sparkThroughput" />
            </div>
          </div>

          {/* 2. Latency */}
          <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl p-5 shadow-xl transition-all duration-300 hover:border-cyan-500/40 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(6,182,212,0.2)]">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Average Latency</span>
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 group-hover:scale-110 transition-transform">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {data ? <AnimatedCounter decimals={1} value={data.averageLatencyMs} /> : "—"}
              </span>
              <span className="text-xs text-slate-400 font-medium">ms avg</span>
            </div>
            <div className="mt-2 text-xs flex items-center justify-between">
              <span className="text-slate-400">Performance:</span>
              {data && data.averageLatencyMs < 120 ? (
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> Ultra Fast
                </span>
              ) : (
                <span className="font-mono text-cyan-300">Standard response</span>
              )}
            </div>
            {/* Sparkline chart */}
            <div className="mt-3 pt-2 border-t border-white/5">
              <Sparkline color="#06b6d4" data={latencyHistory} fillId="sparkLatency" />
            </div>
          </div>

          {/* 3. Error Rate */}
          <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl p-5 shadow-xl transition-all duration-300 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(16,185,129,0.2)]">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Error Rate</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <ShieldCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {data ? <AnimatedCounter decimals={1} value={data.errorRatePercent} /> : "—"}%
              </span>
              <span className="text-xs text-slate-400 font-medium">4xx/5xx</span>
            </div>
            <div className="mt-2 text-xs flex items-center justify-between">
              <span className="text-slate-400">System Health:</span>
              {data && data.errorRatePercent === 0 ? (
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" /> 100% Reliability
                </span>
              ) : (
                <span className="font-mono text-amber-300">Under observation</span>
              )}
            </div>
            {/* Sparkline chart */}
            <div className="mt-3 pt-2 border-t border-white/5">
              <Sparkline color="#10b981" data={[0, 0, 0, 0, 0, 0]} fillId="sparkError" />
            </div>
          </div>

          {/* 4. Live Collaboration */}
          <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl p-5 shadow-xl transition-all duration-300 hover:border-purple-500/40 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(168,85,247,0.2)]">
            <div className="flex items-center justify-between pb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Live Collaboration</span>
              <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
                <Layers className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">
                {data ? <AnimatedCounter value={data.activeSessions} /> : "—"}
              </span>
              <span className="text-xs text-slate-400 font-medium">active rooms</span>
            </div>
            <div className="mt-2 text-xs flex items-center justify-between">
              <span className="text-slate-400">WebSocket Peers:</span>
              <span className="font-mono font-bold text-purple-300">
                {data ? <AnimatedCounter value={data.activeConnections} /> : "0"} connected
              </span>
            </div>
            {/* Sparkline chart */}
            <div className="mt-3 pt-2 border-t border-white/5">
              <Sparkline color="#a855f7" data={[1, 1, 2, 1, 2, 3]} fillId="sparkCollab" />
            </div>
          </div>
        </section>

        {/* Node.js Runtime & Memory Telemetry (Hardware KPIs) */}
        {data && (
          <section className="relative rounded-3xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl p-6 sm:p-7 shadow-2xl overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Server className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">Node.js Runtime & Memory Telemetry</h2>
                  <p className="text-xs text-slate-400">V8 Heap allocation, physical resident set & engine state</p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400">
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 font-mono">
                  Node {data.system.nodeVersion}
                </span>
                <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                  Uptime: {formatUptime(data.system.uptimeSeconds)}
                </span>
                <span className="text-slate-500">
                  Updated: {lastRefreshed.toLocaleTimeString()}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6">
              {/* Heap Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5 text-xs font-semibold">
                    <Database className="h-3.5 w-3.5 text-cyan-400" /> V8 HEAP MEMORY
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    <AnimatedCounter value={data.system.heapUsedMb} /> MB / <AnimatedCounter value={data.system.heapTotalMb} /> MB
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/5 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                    style={{ width: `${Math.min(100, data.system.usagePercent)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  <AnimatedCounter value={data.system.usagePercent} />% of allocated V8 heap boundary
                </p>
              </div>

              {/* RSS Progress */}
              <div className="space-y-2">
                <div className="flex justify-between items-baseline text-sm">
                  <span className="text-slate-400 flex items-center gap-1.5 text-xs font-semibold">
                    <Cpu className="h-3.5 w-3.5 text-purple-400" /> RESIDENT SET (RSS)
                  </span>
                  <span className="font-mono text-xs font-bold text-white">
                    <AnimatedCounter value={data.system.rssMb} /> MB
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/5 p-0.5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                    style={{ width: `${Math.min(100, Math.round((data.system.rssMb / 512) * 100))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Total physical RAM utilized by current process
                </p>
              </div>

              {/* Engine State */}
              <div className="flex flex-col justify-center rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Engine Status</span>
                <div className="flex items-center gap-2.5 mt-2">
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                  </span>
                  <span className="text-sm font-bold text-emerald-400">Express 5 + Hocuspocus Normal</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* API Endpoints Performance Table */}
        <section className="rounded-3xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">API Endpoint Performance & Load</h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Breakdown of traffic load, execution speeds, and reliability by API route
              </p>
            </div>
            <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30" variant="outline">
              {data ? `${String(data.endpoints.length)} Endpoints Tracked` : "..."}
            </Badge>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.02] text-slate-400 text-xs font-semibold uppercase tracking-wider border-b border-white/[0.06]">
                <tr>
                  <th className="py-3.5 px-6">Method & Route</th>
                  <th className="py-3.5 px-4 text-right">Hits</th>
                  <th className="py-3.5 px-4 text-right">Avg Latency</th>
                  <th className="py-3.5 px-4 text-right">Min / Max</th>
                  <th className="py-3.5 px-4 text-right">Success Rate</th>
                  <th className="py-3.5 px-6 text-right">Last Invoked</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {data && data.endpoints.length > 0 ? (
                  data.endpoints.map((ep) => (
                    <tr className="hover:bg-white/[0.03] transition-colors" key={`${ep.method}-${ep.route}`}>
                      <td className="py-3.5 px-6 font-mono text-xs flex items-center gap-2.5">
                        <span className={`px-2 py-0.5 rounded-md border text-[11px] font-bold ${getMethodBadgeClass(ep.method)}`}>
                          {ep.method}
                        </span>
                        <span className="text-slate-200 font-medium">{ep.route}</span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                        {ep.hits.toLocaleString()}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono">
                        <span className={ep.avgDurationMs > 300 ? "text-amber-400 font-bold" : "text-slate-300"}>
                          {ep.avgDurationMs} ms
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-xs text-slate-400">
                        {ep.minDurationMs}ms / {ep.maxDurationMs}ms
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                            ep.successRatePercent === 100
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : ep.successRatePercent > 90
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          {ep.successRatePercent}%
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-right text-xs text-slate-400">
                        {new Date(ep.lastCalledAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-10 text-center text-slate-500" colSpan={6}>
                      No endpoint telemetry captured yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Live Traceability & Distributed Request Tracing */}
        <section className="rounded-3xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl shadow-2xl overflow-hidden">
          <div className="p-6 border-b border-white/[0.08] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Live Request Traceability</h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Unique Trace IDs assigned to each HTTP call for instant observability and debugging
                </p>
              </div>
              <Badge className="bg-purple-500/10 text-purple-300 border-purple-500/30" variant="outline">
                {filteredTraces.length} of {data ? String(data.recentTraces.length) : "0"} Traces
              </Badge>
            </div>

            {/* Search and Filter Bar */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="w-full h-9 pl-9 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
                  onChange={(e) => setTraceSearch(e.target.value)}
                  placeholder="Filter by Trace ID, route, or IP..."
                  type="text"
                  value={traceSearch}
                />
              </div>

              {/* Filter Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
                {(
                  [
                    { id: "all", label: "All" },
                    { id: "success", label: "Success (2xx)" },
                    { id: "errors", label: "Errors" },
                    { id: "slow", label: "Slow (>250ms)" }
                  ] as const
                ).map((tab) => (
                  <button
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      traceFilter === tab.id
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
                    }`}
                    key={tab.id}
                    onClick={() => setTraceFilter(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#0A101D] text-slate-400 text-xs font-semibold uppercase tracking-wider sticky top-0 border-b border-white/[0.08] backdrop-blur-md z-10">
                <tr>
                  <th className="py-3 px-6">Trace ID</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Method & Route</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Latency</th>
                  <th className="py-3 px-6 text-right">Client IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {filteredTraces.length > 0 ? (
                  filteredTraces.map((trace) => (
                    <tr className="hover:bg-white/[0.03] transition-colors font-mono text-xs" key={trace.traceId}>
                      <td className="py-3.5 px-6">
                        <button
                          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 group transition-colors"
                          onClick={() => copyTraceId(trace.traceId)}
                          title="Click to copy Trace ID"
                          type="button"
                        >
                          <span className="font-semibold underline-offset-4 group-hover:underline">
                            {trace.traceId}
                          </span>
                          {copiedTrace === trace.traceId ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-sans font-bold">
                              <Check className="h-3 w-3" /> Copied
                            </span>
                          ) : (
                            <ArrowUpRight className="h-3 w-3 opacity-50 group-hover:opacity-100 transition-opacity" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 text-slate-400 font-sans">
                        {new Date(trace.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-3.5 px-4 flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getMethodBadgeClass(trace.method)}`}>
                          {trace.method}
                        </span>
                        <span className="text-slate-200">{trace.route}</span>
                        {trace.error && (
                          <span className="text-rose-400 text-[10px] font-sans">({trace.error})</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-sans">{getStatusBadge(trace.statusCode)}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-300">{trace.durationMs} ms</td>
                      <td className="py-3.5 px-6 text-right text-slate-400">{trace.ip}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="py-12 text-center text-slate-500 font-sans" colSpan={6}>
                      No traces match the active filter or search query.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Modern Footer */}
        <footer className="text-center text-xs text-slate-500 pt-6 pb-2">
          Orbito High-Performance Observability Suite • Distributed Tracing • Prometheus OpenMetrics v1.0
        </footer>
      </main>
    </div>
  );
}
