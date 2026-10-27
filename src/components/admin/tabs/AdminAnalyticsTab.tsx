import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowDownRight, ArrowUpRight, BarChart3, CheckCircle2, 
  DollarSign, Download, Percent, RefreshCw, ShoppingCart, 
  TrendingUp, Users, Wallet, Zap 
} from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, 
  CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, 
  PieChart, Pie, Cell 
} from "recharts";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

const CARRIER_COLORS: Record<string, string> = {
  MTN: "#eab308",      // Yellow-500
  Telecel: "#f43f5e",  // Rose-500
  AirtelTigo: "#0284c7", // Sky-600
  Other: "#a855f7",    // Purple-500
};

export function AdminAnalyticsTab() {
  const [timeframe, setTimeframe] = useState<"7d" | "30d" | "all">("30d");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-analytics-metrics", timeframe],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select(`
          id, sell_price, cost_price, agent_profit, parent_agent_profit, 
          status, payment_status, created_at,
          bundle:bundles(size_label),
          network:networks(name)
        `)
        .order("created_at", { ascending: true });

      const now = new Date();
      if (timeframe === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte("created_at", d.toISOString());
      } else if (timeframe === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte("created_at", d.toISOString());
      }

      const { data: rawOrders, error } = await query;
      if (error) throw error;

      const orders = rawOrders || [];
      const paidOrders = orders.filter((o: any) => o.payment_status === "paid" || o.status === "delivered");

      // Aggregate overall financials
      let grossRevenue = 0;
      let totalCost = 0;
      let totalAgentProfits = 0;
      let totalParentProfits = 0;

      // Carrier breakdown map
      const carrierMap: Record<string, { gmv: number; count: number }> = {
        MTN: { gmv: 0, count: 0 },
        Telecel: { gmv: 0, count: 0 },
        AirtelTigo: { gmv: 0, count: 0 },
      };

      // Daily trend map
      const dailyMap: Record<string, { date: string; revenue: number; profit: number; orders: number }> = {};

      for (const ord of paidOrders) {
        const sellPrice = Number(ord.sell_price || 0);
        const costPrice = Number(ord.cost_price || 0);
        const agentProfit = Number(ord.agent_profit || 0);
        const parentProfit = Number(ord.parent_agent_profit || 0);

        grossRevenue += sellPrice;
        totalCost += costPrice;
        totalAgentProfits += agentProfit;
        totalParentProfits += parentProfit;

        // Carrier mapping
        const netName = String(ord.network?.name || "");
        let carrierKey = "Other";
        if (netName.toLowerCase().includes("mtn")) carrierKey = "MTN";
        else if (netName.toLowerCase().includes("telecel") || netName.toLowerCase().includes("vodafone")) carrierKey = "Telecel";
        else if (netName.toLowerCase().includes("airtel") || netName.toLowerCase().includes("at")) carrierKey = "AirtelTigo";

        if (!carrierMap[carrierKey]) carrierMap[carrierKey] = { gmv: 0, count: 0 };
        carrierMap[carrierKey].gmv += sellPrice;
        carrierMap[carrierKey].count += 1;

        // Date trend mapping (YYYY-MM-DD)
        const dateStr = new Date(ord.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (!dailyMap[dateStr]) {
          dailyMap[dateStr] = { date: dateStr, revenue: 0, profit: 0, orders: 0 };
        }
        dailyMap[dateStr].revenue += sellPrice;
        // Platform Net Profit = Revenue - Provider Cost - Agent Profit - Parent Override
        const orderNetProfit = sellPrice - costPrice - agentProfit - parentProfit;
        dailyMap[dateStr].profit += Math.max(0, orderNetProfit);
        dailyMap[dateStr].orders += 1;
      }

      const netPlatformProfit = grossRevenue - totalCost - totalAgentProfits - totalParentProfits;
      const profitMarginPct = grossRevenue > 0 ? (netPlatformProfit / grossRevenue) * 100 : 0;

      const dailyTrend = Object.values(dailyMap);
      const carrierDistribution = Object.entries(carrierMap).map(([name, val]) => ({
        name,
        value: val.gmv,
        orders: val.count,
        color: CARRIER_COLORS[name] || "#94a3b8",
      }));

      return {
        grossRevenue,
        totalCost,
        totalAgentProfits,
        totalParentProfits,
        netPlatformProfit,
        profitMarginPct,
        orderCount: paidOrders.length,
        dailyTrend,
        carrierDistribution,
      };
    },
  });

  const exportFinancialCSV = () => {
    if (!data) return;
    const rows = [
      ["Metric", "Value (GHS)"],
      ["Gross Revenue", data.grossRevenue.toFixed(2)],
      ["Wholesale Provider COGS", data.totalCost.toFixed(2)],
      ["Agent Direct Commissions", data.totalAgentProfits.toFixed(2)],
      ["Sub-Agent Override Commissions", data.totalParentProfits.toFixed(2)],
      ["Net Platform Profit", data.netPlatformProfit.toFixed(2)],
      ["Net Margin Percentage", `${data.profitMarginPct.toFixed(1)}%`],
      ["Paid Order Volume", String(data.orderCount)],
    ];

    const csvContent = "data:text/csv;charset=utf-8," + rows.map((e) => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `onegig-financial-statement-${timeframe}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Header with Timeframe Toggles & CSV Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-border/40 bg-card p-6 shadow-soft">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-bold tracking-tight text-foreground">Profit & Financial Analytics</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Real-time reconciliation of Gross Revenue, Provider COGS, Agent Commissions, and Net Platform Profit.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-border bg-secondary/40 p-1">
            {(["7d", "30d", "all"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTimeframe(t)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                  timeframe === t
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "7d" ? "Last 7 Days" : t === "30d" ? "Last 30 Days" : "All Time"}
              </button>
            ))}
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={exportFinancialCSV}
            className="rounded-xl h-9 gap-2 border-border/60 text-xs font-bold"
          >
            <Download className="h-3.5 w-3.5" />
            Export Statement
          </Button>

          <Button
            size="icon"
            variant="ghost"
            onClick={() => refetch()}
            className="rounded-xl h-9 w-9"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Financial KPI Grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-4">
        {/* Gross Revenue */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Gross Revenue (GMV)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <DollarSign className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {formatGHS(data?.grossRevenue ?? 0)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
            {data?.orderCount ?? 0} fulfilled orders
          </p>
        </div>

        {/* Wholesale Provider Cost (COGS) */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Provider Cost (COGS)</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
              <ShoppingCart className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-amber-500 tabular-nums">
            {formatGHS(data?.totalCost ?? 0)}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
            DataHub & SwiftData base fulfillment
          </p>
        </div>

        {/* Agent Commissions Paid */}
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Agent Payouts & Overrides</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-indigo-400 tabular-nums">
            {formatGHS((data?.totalAgentProfits ?? 0) + (data?.totalParentProfits ?? 0))}
          </p>
          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
            Direct & recruiter commissions
          </p>
        </div>

        {/* Net Platform Take-Home Profit */}
        <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500">Net Platform Profit</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-3 text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
            {formatGHS(data?.netPlatformProfit ?? 0)}
          </p>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-emerald-500">
            <Percent className="h-3 w-3" />
            <span>{data?.profitMarginPct?.toFixed(1) ?? "0.0"}% Net Margin</span>
          </div>
        </div>
      </div>

      {/* Charts Section: Daily Trend & Carrier Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Trend Area / Bar Chart */}
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-soft lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <div>
              <h3 className="font-bold text-base text-foreground">Revenue vs Net Profit Trajectory</h3>
              <p className="text-xs text-muted-foreground">Daily trend tracking gross income and retained company profit</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary" /> Gross Revenue
              </span>
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" /> Net Profit
              </span>
            </div>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data?.dailyTrend ?? []}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                <XAxis dataKey="date" fontSize={11} stroke="#888888" tickLine={false} />
                <YAxis fontSize={11} stroke="#888888" tickLine={false} tickFormatter={(v) => `₵${v}`} />
                <RechartsTooltip
                  formatter={(val: any) => formatGHS(Number(val))}
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", fontSize: "12px" }}
                />
                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Gross Revenue" />
                <Bar dataKey="profit" fill="#10b981" radius={[4, 4, 0, 0]} name="Net Profit" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Carrier Market Share Doughnut */}
        <div className="overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-soft space-y-4">
          <div className="border-b border-border/40 pb-3">
            <h3 className="font-bold text-base text-foreground">Carrier GMV Breakdown</h3>
            <p className="text-xs text-muted-foreground">Sales volume distribution by ISP network</p>
          </div>

          <div className="h-52 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data?.carrierDistribution ?? []}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={4}
                >
                  {(data?.carrierDistribution ?? []).map((entry, idx) => (
                    <Cell key={`cell-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  formatter={(val: any) => formatGHS(Number(val))}
                  contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "12px", fontSize: "12px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2 pt-2 border-t border-border/40">
            {(data?.carrierDistribution ?? []).map((c) => (
              <div key={c.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                  <span className="font-semibold text-foreground">{c.name}</span>
                  <span className="text-[10px] text-muted-foreground">({c.orders} orders)</span>
                </div>
                <span className="font-bold text-foreground tabular-nums">{formatGHS(c.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
