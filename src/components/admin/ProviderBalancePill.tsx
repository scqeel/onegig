import { useState, useEffect } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, ShieldCheck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ProviderBalanceState {
  datahubBalance: number | null;
  swiftdataBalance: number | null;
  activeProvider: string;
  loading: boolean;
  error: string | null;
}

export function ProviderBalancePill() {
  const [state, setState] = useState<ProviderBalanceState>({
    datahubBalance: null,
    swiftdataBalance: null,
    activeProvider: "datahub",
    loading: true,
    error: null,
  });

  const fetchBalances = async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // 1. Fetch current provider config
      const { data: configData } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "data_providers")
        .maybeSingle();

      const config = (configData?.value as any) ?? {};
      const active = config.active_data || config.active || "datahub";
      const dhConfig = config.providers?.datahub;
      const swiftConfig = config.providers?.swiftdata;

      let dhBal: number | null = null;
      let swiftBal: number | null = null;

      // 2. Query DataHub balance if configured
      if (dhConfig?.api_key && dhConfig?.base_url) {
        try {
          const res = await fetch(`${dhConfig.base_url.replace(/\/$/, "")}/balance`, {
            headers: {
              "Authorization": `Bearer ${dhConfig.api_key}`,
              "X-API-Key": dhConfig.api_key,
              "Content-Type": "application/json",
            },
          });
          const json = await res.json();
          if (json?.success) {
            dhBal = Number(json.data?.balance ?? json.balance ?? 0);
          }
        } catch (e) {
          console.warn("DataHub balance check failed:", e);
        }
      }

      // 3. Query SwiftData Reseller balance if configured
      if (swiftConfig?.api_key && swiftConfig?.base_url) {
        try {
          const res = await fetch(`${swiftConfig.base_url.replace(/\/$/, "")}/balance`, {
            headers: {
              "Authorization": `Bearer ${swiftConfig.api_key}`,
              "X-API-Key": swiftConfig.api_key,
              "Content-Type": "application/json",
            },
          });
          const json = await res.json();
          if (json?.success) {
            swiftBal = Number(json.balance ?? 0);
          }
        } catch (e) {
          console.warn("SwiftData balance check failed:", e);
        }
      }

      setState({
        datahubBalance: dhBal,
        swiftdataBalance: swiftBal,
        activeProvider: active,
        loading: false,
        error: null,
      });
    } catch (err: any) {
      console.error("Provider balance fetch error:", err);
      setState((prev) => ({ ...prev, loading: false, error: err.message }));
    }
  };

  useEffect(() => {
    fetchBalances();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchBalances, 60000);
    return () => clearInterval(interval);
  }, []);

  const isDataHubLow = state.datahubBalance !== null && state.datahubBalance < 100;
  const isSwiftDataLow = state.swiftdataBalance !== null && state.swiftdataBalance < 100;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* DataHub Balance Pill */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all",
          isDataHubLow
            ? "border-destructive/40 bg-destructive/10 text-destructive"
            : "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
          state.activeProvider === "datahub" && "ring-1 ring-primary/40"
        )}
      >
        <span
          className={cn(
            "relative flex h-2 w-2 rounded-full",
            isDataHubLow ? "bg-destructive animate-ping" : "bg-emerald-500"
          )}
        />
        <span className="font-semibold text-foreground/80">DataHub:</span>
        <span>
          {state.loading && state.datahubBalance === null
            ? "Loading..."
            : state.datahubBalance !== null
            ? formatGHS(state.datahubBalance)
            : "Offline"}
        </span>
        {state.activeProvider === "datahub" && (
          <span className="ml-1 rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            ACTIVE
          </span>
        )}
      </div>

      {/* SwiftData Balance Pill */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium shadow-sm transition-all",
          isSwiftDataLow
            ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
            : "border-sky-500/20 bg-sky-500/10 text-sky-700 dark:text-sky-400",
          state.activeProvider === "swiftdata" && "ring-1 ring-primary/40"
        )}
      >
        <span
          className={cn(
            "relative flex h-2 w-2 rounded-full",
            isSwiftDataLow ? "bg-amber-500 animate-ping" : "bg-sky-500"
          )}
        />
        <span className="font-semibold text-foreground/80">SwiftData:</span>
        <span>
          {state.loading && state.swiftdataBalance === null
            ? "Loading..."
            : state.swiftdataBalance !== null
            ? formatGHS(state.swiftdataBalance)
            : "Offline"}
        </span>
        {state.activeProvider === "swiftdata" && (
          <span className="ml-1 rounded-md bg-primary/20 px-1.5 py-0.5 text-[10px] font-bold text-primary">
            ACTIVE
          </span>
        )}
      </div>

      {/* Refresh Trigger */}
      <button
        type="button"
        onClick={fetchBalances}
        disabled={state.loading}
        title="Refresh Provider Balances"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/50 bg-card/60 text-muted-foreground transition-all hover:bg-accent hover:text-foreground disabled:opacity-50"
      >
        <RefreshCw className={cn("h-3.5 w-3.5", state.loading && "animate-spin text-primary")} />
      </button>
    </div>
  );
}
