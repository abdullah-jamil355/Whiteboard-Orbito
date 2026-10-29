"use client";

import type { ReactElement } from "react";
import { Badge } from "@workspace/ui/primitives/badge";
import type { ObservabilitySummary } from "../observability.api";
import { getMethodBadgeClass } from "../observability.utils";

export type ObservabilityEndpointsTableProps = Readonly<{
  endpoints: ObservabilitySummary["endpoints"];
}>;

export const ObservabilityEndpointsTable = ({
  endpoints
}: ObservabilityEndpointsTableProps): ReactElement => {
  return (
    <section className="rounded-3xl border border-white/[0.08] bg-[#0E1526]/70 backdrop-blur-xl shadow-2xl overflow-hidden">
      <div className="p-6 border-b border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">API Endpoint Performance & Load</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Breakdown of traffic load, execution speeds, and reliability by API route
          </p>
        </div>
        <Badge className="bg-cyan-500/10 text-cyan-300 border-cyan-500/30" variant="outline">
          {`${String(endpoints.length)} Endpoints Tracked`}
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
            {endpoints.length > 0 ? (
              endpoints.map((ep) => (
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
  );
};
