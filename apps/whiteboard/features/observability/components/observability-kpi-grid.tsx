"use client";

import type { ReactElement } from "react";
import { CheckCircle2, Clock, Layers, ShieldCheck, Sparkles, Zap } from "lucide-react";
import { AnimatedCounter, Sparkline } from "@workspace/ui";
import type { ObservabilitySummary } from "../observability.api";

export type ObservabilityKpiGridProps = Readonly<{
  data: ObservabilitySummary | null;
  latencyHistory: readonly number[];
  throughputHistory: readonly number[];
}>;

export const ObservabilityKpiGrid = ({
  data,
  latencyHistory,
  throughputHistory
}: ObservabilityKpiGridProps): ReactElement => {
  return (
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
        <div className="mt-3 pt-2 border-t border-white/5">
          <Sparkline color="#06b6d4" data={latencyHistory} fillId="sparkLatency" />
        </div>
      </div>

      {/* 3. Error Rate */}
      <div className="group relative rounded-2xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl p-5 shadow-xl transition-all duration-300 hover:border-emerald-500/40 hover:-translate-y-1 hover:shadow-[0_15px_30px_-10px_rgba(160,185,129,0.2)]">
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
        <div className="mt-3 pt-2 border-t border-white/5">
          <Sparkline color="#a855f7" data={[1, 1, 2, 1, 2, 3]} fillId="sparkCollab" />
        </div>
      </div>
    </section>
  );
};
