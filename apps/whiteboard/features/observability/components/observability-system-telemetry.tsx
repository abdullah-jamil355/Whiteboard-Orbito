"use client";

import type { ReactElement } from "react";
import { Cpu, Database, Server } from "lucide-react";
import { AnimatedCounter } from "@workspace/ui";
import type { ObservabilitySummary } from "../observability.api";
import { formatUptime } from "../observability.utils";

export type ObservabilitySystemTelemetryProps = Readonly<{
  lastRefreshed: Date;
  system: ObservabilitySummary["system"];
}>;

export const ObservabilitySystemTelemetry = ({
  lastRefreshed,
  system
}: ObservabilitySystemTelemetryProps): ReactElement => {
  return (
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
            Node {system.nodeVersion}
          </span>
          <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
            Uptime: {formatUptime(system.uptimeSeconds)}
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
              <AnimatedCounter value={system.heapUsedMb} /> MB / <AnimatedCounter value={system.heapTotalMb} /> MB
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/5 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
              style={{ width: `${Math.min(100, system.usagePercent)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">
            <AnimatedCounter value={system.usagePercent} />% of allocated V8 heap boundary
          </p>
        </div>

        {/* RSS Progress */}
        <div className="space-y-2">
          <div className="flex justify-between items-baseline text-sm">
            <span className="text-slate-400 flex items-center gap-1.5 text-xs font-semibold">
              <Cpu className="h-3.5 w-3.5 text-purple-400" /> RESIDENT SET (RSS)
            </span>
            <span className="font-mono text-xs font-bold text-white">
              <AnimatedCounter value={system.rssMb} /> MB
            </span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-slate-900 overflow-hidden border border-white/5 p-0.5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-500 shadow-[0_0_12px_rgba(168,85,247,0.5)]"
              style={{ width: `${Math.min(100, Math.round((system.rssMb / 512) * 100))}%` }}
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
  );
};
