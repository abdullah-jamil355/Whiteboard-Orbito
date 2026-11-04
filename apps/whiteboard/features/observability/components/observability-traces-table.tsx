"use client";

import { useMemo, useState, type ReactElement } from "react";
import { ArrowUpRight, Check, Search } from "lucide-react";
import { Badge } from "@workspace/ui/primitives/badge";
import { fetchObservabilityTrace, type ObservabilitySummary, type ObservabilityTrace } from "../observability.api";
import { getMethodBadgeClass, getStatusBadge } from "../observability.utils";

export type ObservabilityTracesTableProps = Readonly<{
  traces: ObservabilitySummary["recentTraces"];
}>;

type TraceFilterType = "all" | "errors" | "slow" | "success";

const FILTER_TABS: readonly { id: TraceFilterType; label: string }[] = [
  { id: "all", label: "All" },
  { id: "success", label: "Success (2xx)" },
  { id: "errors", label: "Errors" },
  { id: "slow", label: "Slow (>250ms)" }
];

export const ObservabilityTracesTable = ({
  traces
}: ObservabilityTracesTableProps): ReactElement => {
  const [traceSearch, setTraceSearch] = useState("");
  const [traceFilter, setTraceFilter] = useState<TraceFilterType>("all");
  const [copiedTrace, setCopiedTrace] = useState<string | null>(null);
  const [selectedTrace, setSelectedTrace] = useState<ObservabilityTrace | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);

  const lookupTrace = async (): Promise<void> => {
    const traceId = traceSearch.trim();
    if (!traceId) {
      setSelectedTrace(null);
      setLookupError("Enter a trace ID to inspect the request.");
      return;
    }
    setLookupBusy(true);
    setLookupError(null);
    try {
      setSelectedTrace(await fetchObservabilityTrace(traceId));
    } catch (error) {
      setSelectedTrace(null);
      setLookupError(error instanceof Error ? error.message : "Could not load this trace.");
    } finally {
      setLookupBusy(false);
    }
  };

  const copyTraceId = (id: string): void => {
    void navigator.clipboard.writeText(id);
    setCopiedTrace(id);
    setTimeout(() => setCopiedTrace(null), 2000);
  };

  const filteredTraces = useMemo(() => {
    return traces.filter((trace) => {
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
  }, [traces, traceSearch, traceFilter]);

  return (
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
            {filteredTraces.length} of {String(traces.length)} Traces
          </Badge>
        </div>

        {/* Search and Filter Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              className="w-full h-9 pl-9 pr-4 rounded-xl bg-white/[0.04] border border-white/10 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/30 transition-all"
              onChange={(e) => setTraceSearch(e.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter") void lookupTrace(); }}
              placeholder="Paste a Trace ID to inspect the request..."
              type="text"
              value={traceSearch}
            />
          </div>

          <button
            className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 text-xs font-semibold text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:cursor-wait disabled:opacity-60"
            disabled={lookupBusy}
            onClick={() => void lookupTrace()}
            type="button"
          ><Search className="h-3.5 w-3.5" />{lookupBusy ? "Searching…" : "Inspect trace"}</button>

          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-white/[0.03] border border-white/[0.08]">
            {FILTER_TABS.map((tab) => (
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
        {lookupError && <p aria-live="polite" className="text-xs text-rose-300">{lookupError}</p>}
        {selectedTrace && (
          <section aria-label="Trace details" className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[0.04] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Request trace details</h3>
                <p className="mt-1 break-all font-mono text-[11px] text-cyan-200">{selectedTrace.traceId}</p>
              </div>
              {getStatusBadge(selectedTrace.statusCode)}
            </div>
            <dl className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              <div><dt className="text-slate-500">Timestamp</dt><dd className="mt-1 text-slate-200">{new Date(selectedTrace.timestamp).toLocaleString()}</dd></div>
              <div><dt className="text-slate-500">Request</dt><dd className="mt-1 font-mono text-slate-200">{selectedTrace.method} {selectedTrace.route}</dd></div>
              <div><dt className="text-slate-500">Duration</dt><dd className="mt-1 text-slate-200">{selectedTrace.durationMs} ms</dd></div>
              <div><dt className="text-slate-500">Client IP</dt><dd className="mt-1 font-mono text-slate-200">{selectedTrace.ip}</dd></div>
              <div><dt className="text-slate-500">Error code</dt><dd className="mt-1 font-mono text-rose-200">{selectedTrace.errorCode ?? "—"}</dd></div>
              <div><dt className="text-slate-500">Error type</dt><dd className="mt-1 text-slate-200">{selectedTrace.errorType ?? "—"}</dd></div>
              <div className="sm:col-span-2 lg:col-span-3"><dt className="text-slate-500">Why the request failed</dt><dd className="mt-1 break-words text-slate-200">{selectedTrace.error ?? "This request completed without a recorded error."}</dd></div>
            </dl>
            {selectedTrace.errorDetails !== undefined && (
              <div className="mt-3 border-t border-white/[0.08] pt-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Safe error details</h4>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/20 p-3 font-mono text-[11px] text-slate-300">{JSON.stringify(selectedTrace.errorDetails, null, 2)}</pre>
              </div>
            )}
          </section>
        )}
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
  );
};
