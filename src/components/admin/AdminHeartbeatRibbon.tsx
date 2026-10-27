import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Activity, AlertTriangle, ArrowRight, Bell, CheckCircle2, 
  Clock, DollarSign, RefreshCw, ShieldCheck, ShoppingCart, 
  Wallet, Zap 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

interface HeartbeatRibbonProps {
  onSelectTab: (tab: string) => void;
}

export function AdminHeartbeatRibbon({ onSelectTab }: HeartbeatRibbonProps) {
  // Query pending orders & withdrawals telemetry
  const { data: telemetry, refetch } = useQuery({
    queryKey: ["admin-heartbeat-telemetry"],
    queryFn: async () => {
      const [pendingOrdersRes, pendingWithdrawalsRes, settingsRes] = await Promise.all([
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .in("status", ["processing", "pending"]),
        supabase
          .from("withdrawals")
          .select("id", { count: "exact", head: true })
          .eq("status", "pending"),
        supabase
          .from("app_settings")
          .select("value")
          .eq("key", "data_providers")
          .maybeSingle(),
      ]);

      const config = (settingsRes.data?.value as any) ?? {};
      const active = config.active_data || config.active || "datahub";

      return {
        pendingOrders: pendingOrdersRes.count ?? 0,
        pendingWithdrawals: pendingWithdrawalsRes.count ?? 0,
        activeProvider: active,
      };
    },
    refetchInterval: 30000,
  });

  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-r from-card via-card/90 to-primary/5 p-4 shadow-soft backdrop-blur-xl">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        
        {/* Left: System Status & Live Pulse */}
        <div className="flex items-center gap-3">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary">
            <Zap className="h-5 w-5 fill-primary text-primary" />
            <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                OneGig Command Core
              </span>
              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-bold text-emerald-400">
                All Systems Operational
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
              <span>Primary Gateway: <strong className="text-foreground capitalize">{telemetry?.activeProvider === "datahub" ? "DataHub GH" : "SwiftData Reseller"}</strong></span>
              <span className="opacity-30">•</span>
              <span className="flex items-center gap-1 text-emerald-400">
                <ShieldCheck className="h-3 w-3" /> Auto-Failover Enabled
              </span>
            </p>
          </div>
        </div>

        {/* Right: Operational Telemetry & 1-Click Jump Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Pending Orders Pill */}
          <button
            type="button"
            onClick={() => onSelectTab("orders")}
            className={cn(
              "group flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm",
              (telemetry?.pendingOrders ?? 0) > 0
                ? "border-amber-500/30 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>
              <strong>{telemetry?.pendingOrders ?? 0}</strong> Pending Orders
            </span>
            {(telemetry?.pendingOrders ?? 0) > 0 && (
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            )}
            <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Pending Withdrawals Pill */}
          <button
            type="button"
            onClick={() => onSelectTab("withdrawals")}
            className={cn(
              "group flex items-center gap-2 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-all hover:scale-105 active:scale-95 shadow-sm",
              (telemetry?.pendingWithdrawals ?? 0) > 0
                ? "border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                : "border-border/60 bg-background/80 text-muted-foreground hover:text-foreground"
            )}
          >
            <Wallet className="h-3.5 w-3.5" />
            <span>
              <strong>{telemetry?.pendingWithdrawals ?? 0}</strong> Payouts Due
            </span>
            {(telemetry?.pendingWithdrawals ?? 0) > 0 && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            )}
            <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Low Balance Guard Pill */}
          <button
            type="button"
            onClick={() => onSelectTab("integrations")}
            className="group flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:scale-105 active:scale-95 shadow-sm"
          >
            <Bell className="h-3.5 w-3.5" />
            <span>24/7 SMS Guard</span>
            <ArrowRight className="h-3 w-3 opacity-40 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Refresh Action */}
          <button
            type="button"
            onClick={() => refetch()}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-background/60 text-muted-foreground transition-all hover:bg-accent hover:text-foreground active:scale-95"
            title="Refresh Heartbeat"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

      </div>
    </div>
  );
}
