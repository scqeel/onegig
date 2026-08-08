import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Activity, DollarSign, RotateCcw, Shield, ShoppingCart, TrendingUp, UserCog, Users, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-border/40", className)} />;
}

function Metric({
  title,
  value,
  icon,
  variant,
  helper,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  variant: "indigo" | "amber" | "emerald" | "rose";
  helper?: string;
}) {
  const styles = {
    indigo: "border-indigo-500/20 bg-indigo-500/5 text-indigo-500",
    amber: "border-amber-500/20 bg-amber-500/5 text-amber-500",
    emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-500",
    rose: "border-rose-500/20 bg-rose-500/5 text-rose-500",
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/45 bg-card/40 p-5 sm:p-6 backdrop-blur-md shadow-soft hover:shadow-lg transition-all duration-300">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-muted-foreground">{title}</span>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-2xl border shadow-inner", styles[variant])}>
          {icon}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-2xl sm:text-3xl font-black tracking-tight text-foreground tabular-nums">{value}</p>
        {helper && <p className="mt-1 text-[11px] font-semibold text-muted-foreground/80">{helper}</p>}
      </div>
    </div>
  );
}

function ActivityStatusDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    delivered: "bg-emerald-500", paid: "bg-emerald-500", approved: "bg-emerald-500",
    pending: "bg-amber-500", processing: "bg-sky-400",
    failed: "bg-rose-500", rejected: "bg-rose-500",
  };
  const labels: Record<string, string> = {
    delivered: "Delivered", paid: "Paid", approved: "Approved",
    pending: "Pending", processing: "Processing",
    failed: "Failed", rejected: "Rejected",
  };
  return (
    <span className="flex items-center gap-1">
      <span className={cn("h-1.5 w-1.5 rounded-full", colors[status] ?? "bg-muted-foreground")} />
      <span className="text-[10px] font-semibold text-muted-foreground">{labels[status] ?? status}</span>
    </span>
  );
}

export function AdminOverviewTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [profilesRes, agentsRes, ordersRes, recentRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "agent"),
        supabase.from("orders").select("id, sell_price, created_at, status, network:networks(name)"),
        supabase
          .from("orders")
          .select("id, recipient_phone, status, sell_price, created_at, bundle:bundles(size_label), network:networks(name, logo_emoji)")
          .order("created_at", { ascending: false })
          .limit(6),
      ]);

      const totalUsers  = profilesRes.count ?? 0;
      const totalAgents = agentsRes.count ?? 0;
      const orders      = ordersRes.data ?? [];
      const totalOrders = orders.length;
      const revenue     = orders.reduce((s, o: any) => s + Number(o.sell_price ?? 0), 0);

      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const revenue30d = orders
        .filter((o: any) => new Date(o.created_at) >= last30)
        .reduce((s, o: any) => s + Number(o.sell_price ?? 0), 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayOrders  = orders.filter((o: any) => new Date(o.created_at) >= today).length;
      const todayRevenue = orders
        .filter((o: any) => new Date(o.created_at) >= today)
        .reduce((s, o: any) => s + Number(o.sell_price ?? 0), 0);

      const delivered = orders.filter((o: any) => o.status === "delivered").length;
      const failed    = orders.filter((o: any) => o.status === "failed").length;

      // Prepare Chart Data
      const last7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
      });
      const revenueMap = new Map(last7Days.map(date => [date, { date, revenue: 0, sales: 0 }]));
      
      const networkMap = new Map<string, number>();

      orders.forEach((o: any) => {
        if (!o.created_at || o.status === "failed") return;
        const d = new Date(o.created_at).toISOString().split("T")[0];
        if (revenueMap.has(d)) {
          const current = revenueMap.get(d)!;
          current.revenue += Number(o.sell_price ?? 0);
          current.sales += 1;
        }
        
        if (o.network?.name) {
          const name = o.network.name;
          networkMap.set(name, (networkMap.get(name) ?? 0) + 1);
        }
      });

      const chartData = Array.from(revenueMap.values()).map(d => ({
        name: new Date(d.date).toLocaleDateString("en-US", { weekday: 'short' }),
        revenue: d.revenue,
        sales: d.sales
      }));

      const networkColors = ["#10b981", "#8b5cf6", "#f59e0b", "#f43f5e", "#0ea5e9"];
      const networkChartData = Array.from(networkMap.entries())
        .map(([name, count], i) => ({ name, count, fill: networkColors[i % networkColors.length] }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalUsers, totalAgents, totalOrders, revenue, revenue30d,
        todayOrders, todayRevenue, delivered, failed,
        recentOrders: recentRes.data ?? [],
        chartData,
        networkChartData,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-36 w-full" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-72 lg:col-span-2" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  const successRate = data && data.totalOrders > 0
    ? Math.round((data.delivered / data.totalOrders) * 100)
    : 0;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-gradient-to-br from-card/60 via-card/30 to-transparent p-6 sm:p-8 backdrop-blur-md shadow-soft">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between z-10">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3.5 py-1">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Admin Console</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">Platform Overview</h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Real-time metrics across the OneGig ecosystem.</p>
          </div>
          <div className="flex flex-col gap-4 sm:items-end">
            <div className="flex items-center gap-3">
              <Link to="/admin/refunds">
                <Button size="sm" className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-full shadow-lg shadow-purple-500/20">
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Refund Control Center
                </Button>
              </Link>
              <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">All Systems Operational</span>
              </div>
            </div>
            <div className="flex gap-6 sm:gap-8">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's Orders</p>
                <p className="text-lg sm:text-xl font-black text-foreground tabular-nums">{data?.todayOrders ?? 0}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's Revenue</p>
                <p className="text-lg sm:text-xl font-black text-foreground tabular-nums">{formatGHS(data?.todayRevenue ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Metric title="Total Users"   value={String(data?.totalUsers ?? 0)}    icon={<Users className="h-5 w-5" />}        variant="indigo"  />
        <Metric title="Active Agents" value={String(data?.totalAgents ?? 0)}   icon={<UserCog className="h-5 w-5" />}      variant="amber"   />
        <Metric title="Total Orders"  value={String(data?.totalOrders ?? 0)}   icon={<ShoppingCart className="h-5 w-5" />} variant="emerald" />
        <Metric title="Total Revenue" value={formatGHS(data?.revenue ?? 0)}    icon={<DollarSign className="h-5 w-5" />}   variant="rose"    helper={`30-day: ${formatGHS(data?.revenue30d ?? 0)}`} />
      </div>

      {/* Activity feed + quick stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/40 backdrop-blur-sm lg:col-span-2">
          <div className="flex items-center justify-between border-b border-border/40 bg-card/60 px-6 py-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Recent Activity</h3>
            </div>
            <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-500">
              Live
            </span>
          </div>
          <div className="divide-y divide-border/30">
            {(data?.recentOrders ?? []).length === 0 ? (
              <p className="p-10 text-center text-sm text-muted-foreground">No recent activity.</p>
            ) : (
              (data?.recentOrders ?? []).map((o: any) => (
                <div key={o.id} className="flex items-center gap-4 px-6 py-3.5 transition-colors hover:bg-accent/20">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-lg leading-none">
                    {o.network?.logo_emoji ?? "📦"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {o.bundle?.size_label ?? "—"}{" "}
                      <span className="font-normal text-muted-foreground">· {o.network?.name}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {o.recipient_phone} · {timeAgo(o.created_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</span>
                    <ActivityStatusDot status={o.status} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/40 backdrop-blur-sm">
            <div className="border-b border-border/40 bg-card/60 px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                <h3 className="text-sm font-bold">Platform Stats</h3>
              </div>
            </div>
            <div className="divide-y divide-border/30">
              {[
                { label: "Orders Delivered", value: String(data?.delivered ?? 0),        color: "text-emerald-500" },
                { label: "Orders Failed",     value: String(data?.failed ?? 0),           color: "text-rose-500"   },
                {
                  label: "Success Rate",
                  value: `${successRate}%`,
                  color: successRate >= 80 ? "text-emerald-500" : successRate >= 60 ? "text-amber-500" : "text-rose-500",
                },
                { label: "30-Day Revenue",   value: formatGHS(data?.revenue30d ?? 0),    color: "text-primary"    },
                { label: "Today's Revenue",  value: formatGHS(data?.todayRevenue ?? 0),  color: "text-foreground" },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between px-5 py-3.5">
                  <span className="text-xs text-muted-foreground">{label}</span>
                  <span className={cn("text-sm font-black tabular-nums", color)}>{value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4 rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-soft hover:shadow-lg transition-all duration-300">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4.5 w-4.5 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Revenue (Last 7 Days)</h3>
            </div>
            <div className="h-48 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.chartData ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="opacity-[0.06]" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5, fontWeight: 600 }} tickFormatter={(val) => `₵${val}`} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '16px', border: '1px solid border-border/40', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '11px', fontWeight: '600', padding: '10px 14px' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                    formatter={(value: number) => [formatGHS(value), "Revenue"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3.5} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2.5, stroke: "hsl(var(--primary))" }} activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
