import React from "react";

export default function ApiStatusBadge({ status, source, lastUpdated }: { status: string; source?: string | null; lastUpdated?: number | null }) {
  const color = status === "ok" ? "bg-green-500" : status === "loading" ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className={`h-2 w-2 rounded-full ${color}`} />
      <div className="text-xs">
        <div className="font-medium">{status === "ok" ? "Live" : status === "loading" ? "Loading" : "Offline"}</div>
        <div className="text-muted-foreground text-[11px]">{source ? `source: ${source}` : "source: unknown"}</div>
      </div>
      {lastUpdated && <div className="text-muted-foreground text-[11px]">{new Date(lastUpdated).toLocaleTimeString()}</div>}
    </div>
  );
}
