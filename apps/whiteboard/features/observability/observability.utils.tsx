import type { ReactElement } from "react";

export const formatUptime = (seconds: number): string => {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${String(d)}d ${String(h)}h ${String(m)}m`;
  if (h > 0) return `${String(h)}h ${String(m)}m ${String(s)}s`;
  if (m > 0) return `${String(m)}m ${String(s)}s`;
  return `${String(s)}s`;
};

export const getMethodBadgeClass = (method: string): string => {
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

export const getStatusBadge = (statusCode: number): ReactElement => {
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
