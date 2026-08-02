import React, { useEffect, useState } from "react";
import { Zap, CheckCircle2, RefreshCw } from "lucide-react";

interface MtnStatusWidgetProps {
  variant?: "custom" | "iframe";
  theme?: "dark" | "green" | "blue" | "light";
  className?: string;
  autoRefreshIntervalMs?: number;
}

interface WidgetData {
  success: boolean;
  order?: {
    orderNumber: number;
    placedAt: string;
    deliveredAt: string;
  };
  message?: string;
}

export const MtnStatusWidget: React.FC<MtnStatusWidgetProps> = ({
  variant = "custom",
  theme = "dark",
  className = "",
  autoRefreshIntervalMs = 60000,
}) => {
  const [data, setData] = useState<WidgetData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch("https://user.datahubgh.com/api/widget/last-mtn-delivered?format=json");
      if (!res.ok) throw new Error("Failed to fetch widget data");
      const json: WidgetData = await res.json();
      if (json.success) {
        setData(json);
        setError(false);
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Error fetching MTN status widget:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (variant === "custom") {
      fetchStatus();
      const interval = setInterval(fetchStatus, autoRefreshIntervalMs);
      return () => clearInterval(interval);
    }
  }, [variant, autoRefreshIntervalMs]);

  if (variant === "iframe") {
    return (
      <div className={`w-full overflow-hidden rounded-xl border border-white/10 ${className}`}>
        <iframe
          src={`https://user.datahubgh.com/api/widget/last-mtn-delivered?format=html&theme=${theme}`}
          style={{ width: "100%", height: "60px", border: "none" }}
          scrolling="no"
          title="MTN Delivery Status"
        />
      </div>
    );
  }

  return (
    <div
      className={`relative flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/20 bg-slate-950/80 px-4 py-3 shadow-lg backdrop-blur-md transition-all ${className}`}
    >
      <div className="flex items-center gap-3 overflow-hidden text-xs">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
          <Zap className="h-4 w-4 animate-pulse fill-emerald-400/20" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
        </div>

        <div className="truncate">
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span>Network Live Status</span>
          </div>
          <div className="truncate text-[11px] text-slate-400">
            {loading && !data ? (
              <span className="animate-pulse">Checking latest MTN deliveries...</span>
            ) : error || !data?.message ? (
              <span className="text-slate-400">MTN Orders active & delivering smoothly ⚡</span>
            ) : (
              <span>{data.message}</span>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={fetchStatus}
        disabled={loading}
        title="Refresh live status"
        className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin text-emerald-400" : ""}`} />
      </button>
    </div>
  );
};
