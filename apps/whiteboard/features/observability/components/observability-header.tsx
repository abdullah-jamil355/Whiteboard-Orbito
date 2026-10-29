"use client";

import type { ReactElement } from "react";
import Link from "next/link";
import { Activity, ExternalLink, Pause, Play, RefreshCw } from "lucide-react";
import { Button } from "@workspace/ui/primitives/button";

export type ObservabilityHeaderProps = Readonly<{
  isAutoRefresh: boolean;
  loading: boolean;
  prometheusUrl: string;
  onRefresh: () => void;
  onToggleAutoRefresh: () => void;
}>;

export const ObservabilityHeader = ({
  isAutoRefresh,
  loading,
  prometheusUrl,
  onRefresh,
  onToggleAutoRefresh
}: ObservabilityHeaderProps): ReactElement => {
  return (
    <header className="relative rounded-3xl border border-white/[0.08] bg-[#0E1526]/75 backdrop-blur-2xl p-6 sm:p-8 shadow-2xl shadow-black/40 overflow-hidden">
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

        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            className={`transition-all duration-200 border ${
              isAutoRefresh
                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 hover:bg-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.2)]"
                : "bg-slate-800/80 text-slate-300 border-white/10 hover:bg-slate-800"
            }`}
            onClick={onToggleAutoRefresh}
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
            onClick={onRefresh}
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
  );
};
