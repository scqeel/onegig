import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, BellRing, CheckCircle2, Clock, Cog, DollarSign, Globe2,
  Loader2, Package, RefreshCw, RotateCcw, Search, Settings, Shield,
  ShieldCheck, ShoppingCart, Trash2, TrendingUp, UserCog, Users,
  Wallet, XCircle, Zap, Megaphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminUserDetailsModal } from "@/components/dashboard/AdminUserDetailsModal";
import { NOTIFICATION_SOUNDS } from "@/components/ui/InAppNotificationListener";
import { cn } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

type Tab = "overview" | "users" | "orders" | "withdrawals" | "pricing" | "integrations" | "settings" | "marketing";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
};

// ── Visual helpers ─────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-border/40", className)} />;
}

const AVATAR_GRADIENTS = [
  "from-violet-500 to-purple-700",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-700",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-700",
  "from-indigo-500 to-violet-700",
  "from-cyan-500 to-sky-700",
];

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function getAvatarColor(seed: string) {
  const n = seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return AVATAR_GRADIENTS[n % AVATAR_GRADIENTS.length];
}

function UserAvatar({ name }: { name: string }) {
  return (
    <div
      className={cn(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-sm font-black text-white shadow-inner",
        getAvatarColor(name)
      )}
    >
      {getInitials(name)}
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {text}
    </div>
  );
}

// ── Page root ─────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");

  const sidebarItems = [
    { label: "Overview",      value: "overview",     icon: <Activity className="h-4 w-4" /> },
    { label: "Users",         value: "users",        icon: <Users className="h-4 w-4" /> },
    { label: "Orders",        value: "orders",       icon: <ShoppingCart className="h-4 w-4" /> },
    { label: "Withdrawals",   value: "withdrawals",  icon: <Wallet className="h-4 w-4" /> },
    { label: "Pricing",       value: "pricing",      icon: <Cog className="h-4 w-4" /> },
    { label: "Marketing",     value: "marketing",    icon: <Megaphone className="h-4 w-4" /> },
    { label: "Integrations",  value: "integrations", icon: <Globe2 className="h-4 w-4" /> },
    { label: "Site Settings", value: "settings",     icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Complete control over users, orders, pricing, and system configurations."
      badge="Admin Console"
      sidebarItems={sidebarItems.map((item) => ({
        label: item.label,
        icon: item.icon,
        active: tab === (item.value as Tab),
        onClick: () => setTab(item.value as Tab),
      }))}
      topActions={
        <a
          href="/dashboard"
          className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
        >
          <RefreshCw className="h-3 w-3" />
          Back to Dashboard
        </a>
      }
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {tab === "overview"     && <OverviewSection />}
        {tab === "users"        && <UsersSection />}
        {tab === "orders"       && <OrdersSection />}
        {tab === "withdrawals"  && <WithdrawalsSection />}
        {tab === "pricing"      && <PricingSection />}
        {tab === "marketing"    && <MarketingSection />}
        {tab === "integrations" && <IntegrationsSection />}
        {tab === "settings"     && <SiteSettingsSection />}
      </div>
    </DashboardLayout>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────

function OverviewSection() {
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
        return d.toISOString().split("T")[0]; // YYYY-MM-DD
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
    <div className="space-y-6">
      {/* Hero banner */}
      <div className="relative overflow-hidden rounded-[2rem] border border-primary/20 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-5 sm:p-7">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)," +
              "repeating-linear-gradient(90deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)",
          }}
        />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="mb-2.5 inline-flex items-center gap-2 rounded-lg bg-primary/15 px-3 py-1">
              <Shield className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-primary">Admin Console</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground">Platform Overview</h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">Real-time metrics across the OneGig ecosystem.</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-500">All Systems Operational</span>
            </div>
            <div className="flex gap-4 sm:gap-5">
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's Orders</p>
                <p className="text-base sm:text-lg font-black text-foreground">{data?.todayOrders ?? 0}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Today's Revenue</p>
                <p className="text-base sm:text-lg font-black text-foreground">{formatGHS(data?.todayRevenue ?? 0)}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute bottom-0 right-24 h-20 w-20 rounded-full bg-primary/5 blur-2xl" />
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

          <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-border/60 bg-card/40 p-5 shadow-soft">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Revenue (Last 7 Days)</h3>
            </div>
            <div className="h-48 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data?.chartData ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} tickFormatter={(val) => `₵${val}`} />
                  <RechartsTooltip
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '12px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                    formatter={(value: number) => [formatGHS(value), "Revenue"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2 }} activeDot={{ r: 6, strokeWidth: 0 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="flex flex-1 flex-col gap-4 rounded-3xl border border-border/60 bg-card/40 p-5 shadow-soft mt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-emerald-500" />
              <h3 className="text-sm font-bold">Top Networks (All Time)</h3>
            </div>
            <div className="h-40 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.networkChartData ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '12px' }}
                    formatter={(value: number) => [value, "Orders"]}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {(data?.networkChartData ?? []).map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
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

// ── Users ─────────────────────────────────────────────────────────────────────

function UsersSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, email, phone").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const rolesMap = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r: any) => {
        const prev = rolesMap.get(r.user_id) ?? [];
        rolesMap.set(r.user_id, [...prev, r.role]);
      });

      return (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        roles: rolesMap.get(p.id) ?? ["user"],
      }));
    },
  });

  const removeUser = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently delete this user?")) return;
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
    setBusyId(null);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "User deleted successfully" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const makeAgent = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-convert-agent", { body: { user_id: userId } });
    setBusyId(null);
    if (error) { toast({ title: "Conversion failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Account promoted to agent" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const makeAdmin = async (userId: string) => {
    const code = window.prompt("Enter the 4-digit security code to grant admin access:");
    if (!code) return;
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-make-admin", { body: { user_id: userId, code: code.trim() } });
    setBusyId(null);
    if (error) { toast({ title: "Conversion failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Account promoted to admin!" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/30">
        <div className="border-b border-border/40 p-6">
          <Skeleton className="mb-2 h-6 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="divide-y divide-border/40">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-5">
              <Skeleton className="h-11 w-11 shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-8 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = (data ?? []).filter((u: any) =>
    !q ||
    (u.full_name ?? "").toLowerCase().includes(q) ||
    (u.username ?? "").toLowerCase().includes(q) ||
    (u.email ?? "").toLowerCase().includes(q) ||
    (u.phone ?? "").includes(q)
  );

  const roleStyle: Record<string, string> = {
    admin: "border-rose-500/30 bg-rose-500/10 text-rose-500",
    agent: "border-amber-500/30 bg-amber-500/10 text-amber-600",
    user:  "border-border/40 bg-secondary/50 text-muted-foreground",
  };

  return (
    <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
      <div className="flex flex-col gap-4 border-b border-border/40 bg-card/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Platform Users</h2>
          <p className="text-sm text-muted-foreground">Manage accounts and permissions across the system.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-52 rounded-xl border border-border/60 bg-background/50 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            />
          </div>
          <div className="shrink-0 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            {filtered.length}{search ? ` of ${data?.length ?? 0}` : " registered"}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/40">
        {filtered.map((u: any) => {
          const name = u.full_name || u.username || "Anonymous User";
          return (
            <div key={u.id} className="group flex flex-col gap-4 p-5 transition-colors hover:bg-accent/20 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar name={name} />
                <div>
                  <p className="text-sm font-bold leading-tight text-foreground">{name}</p>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    {u.email && <span>{u.email}</span>}
                    {u.phone && <><span className="hidden sm:inline opacity-40">·</span><span>{u.phone}</span></>}
                  </div>
                  <div className="mt-1.5 flex gap-1">
                    {u.roles.map((r: string) => (
                      <span key={r} className={cn("rounded-md border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider", roleStyle[r] ?? roleStyle.user)}>
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:flex items-center gap-2 pt-3 md:pt-0 border-t border-border/30 md:border-0">
                <Button
                  variant="outline" size="sm"
                  className="col-span-full md:col-auto h-9 md:h-8 rounded-xl border-border/60 bg-background/50 text-xs font-semibold hover:border-primary hover:bg-primary hover:text-primary-foreground"
                  onClick={() => setSelectedUser(u)}
                >
                  View Details
                </Button>
                {!u.roles.includes("agent") && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-border/60 bg-background/50 text-xs font-semibold hover:border-amber-500 hover:bg-amber-500 hover:text-white"
                    disabled={busyId === u.id}
                    onClick={() => makeAgent(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><UserCog className="mr-1.5 h-4 w-4 md:h-3 md:w-3" />Agent</>}
                  </Button>
                )}
                {!u.roles.includes("admin") && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-border/60 bg-background/50 text-xs font-semibold hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
                    disabled={busyId === u.id}
                    onClick={() => makeAdmin(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><ShieldCheck className="mr-1.5 h-4 w-4 md:h-3 md:w-3" />Admin</>}
                  </Button>
                )}
                <Button
                  variant="ghost" size="sm"
                  className="col-span-full md:col-auto h-9 md:h-8 md:w-8 rounded-xl text-muted-foreground/50 hover:bg-destructive/10 hover:text-destructive border border-border/60 bg-background/50 md:border-0 md:bg-transparent"
                  disabled={busyId === u.id}
                  onClick={() => removeUser(u.id)}
                >
                  {busyId === u.id
                    ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                    : <><Trash2 className="md:mr-0 mr-1.5 h-4 w-4 md:h-3.5 md:w-3.5" /><span className="md:hidden font-semibold text-xs text-foreground">Delete User</span></>}
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/50">
            <Users className="h-6 w-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm font-bold text-muted-foreground">
            {search ? "No users match your search." : "No users found in database."}
          </p>
        </div>
      )}
      <AdminUserDetailsModal 
        user={selectedUser} 
        isOpen={!!selectedUser} 
        onClose={() => setSelectedUser(null)} 
      />
    </div>
  );
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    delivered:  { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Delivered"  },
    paid:       { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Paid"       },
    approved:   { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Approved"   },
    pending:    { bg: "bg-amber-500/10 text-amber-600 border-amber-500/20",       dot: "bg-amber-500",   label: "Pending"    },
    processing: { bg: "bg-sky-500/10 text-sky-600 border-sky-500/20",             dot: "bg-sky-500",     label: "Processing" },
    failed:     { bg: "bg-rose-500/10 text-rose-600 border-rose-500/20",          dot: "bg-rose-500",    label: "Failed"     },
    rejected:   { bg: "bg-rose-500/10 text-rose-600 border-rose-500/20",          dot: "bg-rose-500",    label: "Rejected"   },
  };
  const cfg = map[status] ?? { bg: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ── Orders ────────────────────────────────────────────────────────────────────

function OrdersSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [retryId, setRetryId]           = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]             = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("id, reference, bundle_id, source, status, sell_price, created_at, customer_user_id, recipient_phone, bundle:bundles(size_label), network:networks(name, logo_emoji), agent:agent_profiles(store_name)")
        .order("created_at", { ascending: false })
        .limit(100);

      const userIds = [...new Set((orders ?? []).map((o: any) => o.customer_user_id).filter(Boolean))] as string[];
      let profiles: Profile[] = [];
      if (userIds.length) {
        const { data: p } = await supabase.from("profiles").select("id, full_name, username, email, phone").in("id", userIds);
        profiles = (p ?? []) as Profile[];
      }
      const profileMap = new Map(profiles.map((p) => [p.id, p]));
      return (orders ?? []).map((o: any) => ({
        ...o,
        customer: o.customer_user_id ? profileMap.get(o.customer_user_id) ?? null : null,
      }));
    },
  });

  const retryOrder = async (order: any, manualFulfill: boolean = false) => {
    if (!order.bundle_id || !order.recipient_phone) return;
    setRetryId(order.id);
    const { error } = await supabase.functions.invoke("place-order", {
      body: { 
        recipient_phone: order.recipient_phone, 
        bundle_id: order.bundle_id, 
        force_provider: "swft", 
        retry_order_id: order.id,
        manual_fulfill: manualFulfill
      },
    });
    setRetryId(null);
    if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: manualFulfill ? "Marked as delivered" : "Order retried", description: "Status updated successfully." });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  const orders = data ?? [];
  const delivered  = orders.filter((o: any) => o.status === "delivered").length;
  const inProgress = orders.filter((o: any) => ["pending", "processing"].includes(o.status)).length;
  const failed     = orders.filter((o: any) => o.status === "failed").length;
  const revenue    = orders.reduce((s: number, o: any) => s + Number(o.sell_price ?? 0), 0);

  const q = search.trim().toLowerCase();
  const filtered = orders
    .filter((o: any) => {
      if (statusFilter === "in_progress") return ["pending", "processing"].includes(o.status);
      if (statusFilter !== "all") return o.status === statusFilter;
      return true;
    })
    .filter((o: any) =>
      !q ||
      (o.recipient_phone ?? "").includes(q) ||
      (o.customer?.full_name ?? "").toLowerCase().includes(q) ||
      (o.customer?.email ?? "").toLowerCase().includes(q) ||
      (o.reference ?? "").toLowerCase().includes(q) ||
      (o.network?.name ?? "").toLowerCase().includes(q)
    );

  const FILTERS = [
    { label: "All",         value: "all",         count: orders.length },
    { label: "Delivered",   value: "delivered",   count: delivered     },
    { label: "In Progress", value: "in_progress", count: inProgress    },
    { label: "Failed",      value: "failed",      count: failed        },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Total Orders",  value: orders.length,     icon: ShoppingCart, iconBg: "bg-primary/10",     iconCl: "text-primary",    valCl: "text-foreground"  },
          { label: "Delivered",     value: delivered,          icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconCl: "text-emerald-500", valCl: "text-emerald-600" },
          { label: "In Progress",   value: inProgress,         icon: Clock,        iconBg: "bg-amber-500/10",   iconCl: "text-amber-500",  valCl: "text-amber-600"   },
          { label: "Failed",        value: failed,             icon: XCircle,      iconBg: "bg-rose-500/10",    iconCl: "text-rose-500",   valCl: "text-rose-600"    },
          { label: "Total Revenue", value: formatGHS(revenue), icon: TrendingUp,   iconBg: "bg-violet-500/10",  iconCl: "text-violet-500", valCl: "text-violet-700 dark:text-violet-400" },
        ].map(({ label, value, icon: Icon, iconBg, iconCl, valCl }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-border/50 bg-card p-4 shadow-soft">
            <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}>
              <Icon className={`h-4 w-4 ${iconCl}`} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className={`mt-1 text-2xl font-black tabular-nums ${valCl}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search phone, name, ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>
        <div className="flex shrink-0 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
          {FILTERS.map(({ label, value, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === value
                  ? "gradient-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                  statusFilter === value ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
              <Package className="h-7 w-7 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">No orders found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="hidden w-full text-left md:table">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Bundle", "Recipient", "Customer", "Revenue", "Status", "When", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((o: any, i: number) => (
                  <tr key={o.id} className={`group transition-colors hover:bg-primary/[0.025] ${i % 2 !== 0 ? "bg-secondary/[0.04]" : ""}`}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-lg leading-none">
                          {o.network?.logo_emoji ?? "📦"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-tight">{o.bundle?.size_label ?? "—"}</p>
                          <p className="text-[11px] text-muted-foreground">{o.network?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <code className="rounded-lg bg-secondary/70 px-2 py-1 text-[11px] font-mono font-semibold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </td>
                    <td className="px-5 py-4">
                      <p className="max-w-[150px] truncate text-sm font-semibold text-foreground">
                        {o.customer?.full_name || o.customer?.email || (
                          <span className="font-normal italic text-muted-foreground">Guest</span>
                        )}
                      </p>
                      {o.source && (
                        <span className="mt-0.5 inline-block rounded bg-secondary/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          {o.source.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={o.status} />
                        {o.status === "failed" && o.notes && (
                          <span className="max-w-[120px] truncate text-[9px] font-medium text-rose-500/80" title={o.notes}>
                            {o.notes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="whitespace-nowrap text-xs font-semibold text-foreground">
                        {new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(o.created_at))}
                      </p>
                      <p className="whitespace-nowrap text-[10px] text-muted-foreground">{timeAgo(o.created_at)}</p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      {o.status === "failed" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm" variant="outline"
                            disabled={retryId === o.id}
                            onClick={() => retryOrder(o, true)}
                            className="h-8 gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-500 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all"
                          >
                            {retryId === o.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><CheckCircle2 className="h-3 w-3" /> Manual Fulfill</>}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            disabled={retryId === o.id}
                            onClick={() => retryOrder(o, false)}
                            className="h-8 gap-1.5 rounded-xl border-rose-500/30 bg-rose-500/5 px-3 text-xs font-bold text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all"
                          >
                            {retryId === o.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><RotateCcw className="h-3 w-3" /> Retry API</>}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="grid gap-3 p-4 md:hidden">
              {filtered.map((o: any) => (
                <div key={o.id} className="flex flex-col gap-3 rounded-3xl border border-border/50 bg-card/40 p-5 shadow-soft transition-all hover:bg-accent/10">
                  <div className="flex items-center justify-between border-b border-border/30 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary/70 text-xl leading-none">
                        {o.network?.logo_emoji ?? "📦"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{o.bundle?.size_label ?? "—"}</p>
                        <p className="text-[11px] text-muted-foreground">{o.network?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
                      <p className="text-[10px] text-muted-foreground">{timeAgo(o.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Recipient</span>
                      <code className="rounded-lg bg-secondary/70 px-2 py-1 text-xs font-mono font-bold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Customer</span>
                      <div className="text-right">
                        <p className="max-w-[150px] truncate text-sm font-semibold text-foreground">
                          {o.customer?.full_name || o.customer?.email || (
                            <span className="font-normal italic text-muted-foreground">Guest</span>
                          )}
                        </p>
                        {o.source && (
                          <span className="mt-0.5 inline-block rounded bg-secondary/80 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                            {o.source.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">Status</span>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        {o.status === "failed" && o.notes && (
                          <span className="max-w-[120px] truncate text-[9px] font-medium text-rose-500/80" title={o.notes}>
                            {o.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {o.status === "failed" && (
                    <div className="mt-2 grid grid-cols-2 gap-2 pt-4 border-t border-border/30">
                      <Button
                        size="sm" variant="outline"
                        disabled={retryId === o.id}
                        onClick={() => retryOrder(o, true)}
                        className="h-10 rounded-xl border-emerald-500/30 bg-emerald-500/5 text-xs font-bold text-emerald-500 hover:bg-emerald-500 hover:text-white"
                      >
                        {retryId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><CheckCircle2 className="mr-1.5 h-4 w-4" /> Fulfill</>}
                      </Button>
                      <Button
                        size="sm" variant="outline"
                        disabled={retryId === o.id}
                        onClick={() => retryOrder(o, false)}
                        className="h-10 rounded-xl border-rose-500/30 bg-rose-500/5 text-xs font-bold text-rose-500 hover:bg-rose-500 hover:text-white"
                      >
                        {retryId === o.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="mr-1.5 h-4 w-4" /> Retry API</>}
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="flex items-center justify-between border-t border-border/30 bg-secondary/20 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filtered.length}</span> of <span className="font-bold">{orders.length}</span> orders
            </p>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-orders"] })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all"
            >
              <RefreshCw className="h-3 w-3" /> Refresh
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Withdrawals ───────────────────────────────────────────────────────────────

function WithdrawalsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-withdrawals"],
    queryFn: async () => {
      const { data: withdrawals } = await supabase
        .from("withdrawals")
        .select("id, user_id, amount, momo_name, momo_number, momo_network, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      const userIds = [...new Set((withdrawals ?? []).map((w: any) => w.user_id).filter(Boolean))] as string[];
      let profiles: Profile[] = [];
      if (userIds.length) {
        const { data: p } = await supabase.from("profiles").select("id, full_name, username, email, phone").in("id", userIds);
        profiles = (p ?? []) as Profile[];
      }
      const profileMap = new Map(profiles.map((p) => [p.id, p]));

      const balances = await Promise.all(
        userIds.map(async (uid) => {
          const { data: bal } = await supabase.rpc("get_wallet_balance", { _user_id: uid });
          return [uid, Number(bal ?? 0)] as const;
        })
      );
      const balMap = new Map(balances);

      return (withdrawals ?? []).map((w: any) => ({
        ...w,
        profile: profileMap.get(w.user_id) ?? null,
        balance: balMap.get(w.user_id) ?? 0,
      }));
    },
  });

  const confirmWithdrawal = async (withdrawalId: string) => {
    if (!confirm("Mark this withdrawal as paid? This action cannot be undone.")) return;
    setBusyId(withdrawalId);
    const { error } = await supabase.functions.invoke("process-withdrawal", {
      body: { withdrawal_id: withdrawalId, action: "mark_paid" },
    });
    setBusyId(null);
    if (error) { toast({ title: "Confirmation failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Withdrawal marked as paid" });
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/30">
          <div className="border-b border-border/40 p-6">
            <Skeleton className="mb-2 h-6 w-40" />
            <Skeleton className="h-4 w-56" />
          </div>
          <div className="divide-y divide-border/40">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-6">
                <Skeleton className="h-12 w-12 shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-3 w-56" />
                </div>
                <Skeleton className="h-10 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const pending      = (data ?? []).filter((w: any) => w.status === "pending");
  const pendingTotal = pending.reduce((s, w: any) => s + Number(w.amount ?? 0), 0);

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Pending banner */}
      {pending.length > 0 && (
        <div className="flex items-center justify-between rounded-2xl border border-amber-500/25 bg-amber-500/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
              <Wallet className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-600">
                {pending.length} pending withdrawal{pending.length > 1 ? "s" : ""} awaiting approval
              </p>
              <p className="text-xs text-amber-500/70">Review and mark each as paid once transferred.</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-500/70">Total Pending</p>
            <p className="text-xl font-black tabular-nums text-amber-600">{formatGHS(pendingTotal)}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-3xl border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <h2 className="text-xl font-bold tracking-tight">Withdrawal Requests</h2>
          <p className="text-sm text-muted-foreground">Manage and process agent payout requests.</p>
        </div>
        <div className="divide-y divide-border/40">
          {(data ?? []).map((w: any) => (
            <div key={w.id} className="group p-6 transition-colors hover:bg-accent/20">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                    <DollarSign className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold leading-tight">{w.profile?.full_name || w.profile?.email || "Unknown Agent"}</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">
                      Available: <span className="text-foreground">{formatGHS(w.balance)}</span>{" "}
                      · Requested: <span className="text-foreground">{timeAgo(w.created_at)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1">
                  <p className="text-2xl font-black tracking-tighter text-foreground">{formatGHS(w.amount)}</p>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <span className="rounded bg-accent/50 px-1.5 py-0.5">{w.momo_network}</span>
                    <span>{w.momo_number}</span>
                    <span className="hidden opacity-30 md:inline">|</span>
                    <span className="max-w-[120px] truncate">{w.momo_name}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${w.status === "paid" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-amber-500/20 bg-amber-500/10 text-amber-500"}`}>
                    {w.status}
                  </div>
                  <Button
                    className="h-10 rounded-xl bg-primary px-6 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                    disabled={busyId === w.id || w.status === "paid"}
                    onClick={() => confirmWithdrawal(w.id)}
                  >
                    {busyId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark Paid"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!(data ?? []).length && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary/50">
              <Wallet className="h-6 w-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">No pending withdrawal requests.</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pricing ───────────────────────────────────────────────────────────────────

function PricingSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm]           = useState({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activationFee, setActivationFee] = useState("50");

  const { data: payload, isLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: feeRow }] = await Promise.all([
        supabase.from("networks").select("id, name, code").order("sort_order"),
        supabase.from("bundles").select("*").order("size_mb", { ascending: true }),
        supabase.from("app_settings").select("value").eq("key", "agent_activation_fee").maybeSingle(),
      ]);
      return { networks: networks ?? [], bundles: bundles ?? [], activationFee: Number(feeRow?.value ?? 50) };
    },
  });

  useEffect(() => {
    if (payload?.activationFee != null) setActivationFee(String(payload.activationFee));
  }, [payload?.activationFee]);

  const saveBundle = async () => {
    if (!form.network_id || !form.size_label || !form.size_gb || !form.base_price || !form.user_price) return;
    const row = {
      network_id: form.network_id,
      size_label: form.size_label,
      size_mb: Math.round(Number(form.size_gb) * 1000),
      user_price: Number(form.user_price),
      base_price: Number(form.base_price),
      sort_order: 0,
      active: true,
    };
    if (editingId) {
      const { error } = await supabase.from("bundles").update(row as any).eq("id", editingId);
      if (error) { toast({ title: "Update failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Package updated successfully" });
    } else {
      const { error } = await supabase.from("bundles").insert(row as any);
      if (error) { toast({ title: "Create failed", description: error.message, variant: "destructive" }); return; }
      toast({ title: "New package created" });
    }
    setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const removeBundle = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this package?")) return;
    const { error } = await supabase.from("bundles").update({ active: false }).eq("id", id);
    if (error) { toast({ title: "Delete failed", description: error.message, variant: "destructive" }); return; }
    await supabase.from("agent_bundle_prices").update({ active: false }).eq("bundle_id", id);
    toast({ title: "Package deactivated" });
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const saveActivationFee = async () => {
    const { error } = await supabase.from("app_settings").upsert({ key: "agent_activation_fee", value: Number(activationFee) });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Activation fee updated" });
  };

  if (isLoading) return <LoadingCard text="Syncing pricing configurations…" />;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <h2 className="text-xl font-bold tracking-tight">{editingId ? "Edit Package" : "Create New Package"}</h2>
          <p className="text-sm text-muted-foreground">Configure data bundle pricing and network availability.</p>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Network Provider</label>
              <select
                value={form.network_id}
                onChange={(e) => setForm((p) => ({ ...p, network_id: e.target.value }))}
                className="h-14 w-full rounded-2xl border border-border/60 bg-background/50 px-4 text-sm font-medium focus:border-primary/50 focus:ring-4 focus:ring-primary/10 outline-none transition-all hover:bg-accent/20"
              >
                <option value="">Select Network…</option>
                {payload?.networks.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Bundle Label</label>
              <Input placeholder="e.g. 1GB Non-Expiry" value={form.size_label} onChange={(e) => setForm((p) => ({ ...p, size_label: e.target.value }))} className="h-14 rounded-2xl border-border/60 bg-background/50 px-4 text-sm focus-visible:ring-4 focus-visible:ring-primary/10 hover:bg-accent/20 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Data Size (GB)</label>
              <Input placeholder="e.g. 1.0" type="number" step="0.1" value={form.size_gb} onChange={(e) => setForm((p) => ({ ...p, size_gb: e.target.value }))} className="h-14 rounded-2xl border-border/60 bg-background/50 px-4 text-sm focus-visible:ring-4 focus-visible:ring-primary/10 hover:bg-accent/20 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Regular User Price (GHS)</label>
              <Input placeholder="e.g. 5.50" value={form.user_price} onChange={(e) => setForm((p) => ({ ...p, user_price: e.target.value }))} className="h-14 rounded-2xl border-border/60 bg-background/50 px-4 text-sm focus-visible:ring-4 focus-visible:ring-primary/10 hover:bg-accent/20 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-primary">Agent Wholesale Price (GHS)</label>
              <Input placeholder="e.g. 4.50" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} className="h-14 rounded-2xl border-primary/30 bg-primary/5 px-4 text-sm focus-visible:ring-4 focus-visible:ring-primary/10 hover:bg-primary/10 transition-all" />
            </div>
          </div>
          <div className="mt-8 flex flex-col gap-3 border-t border-border/40 pt-6 sm:flex-row sm:items-center">
            <Button className="h-14 w-full rounded-2xl bg-primary font-bold shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-10" onClick={saveBundle}>
              {editingId ? "Update Configuration" : "Add Package"}
            </Button>
            {editingId && (
              <Button variant="ghost" className="h-14 w-full rounded-2xl font-medium sm:w-auto sm:px-8" onClick={() => { setEditingId(null); setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" }); }}>
                Cancel Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
          <div className="border-b border-border/40 bg-card/50 p-6">
            <h3 className="text-lg font-bold">Active Inventory</h3>
            <p className="text-xs text-muted-foreground">All currently active data packages.</p>
          </div>
          <div className="max-h-[600px] space-y-4 overflow-y-auto p-4 no-scrollbar">
            {(payload?.networks ?? []).map((n: any) => {
              const items = (payload?.bundles ?? []).filter((b: any) => b.network_id === n.id && b.active);
              if (!items.length) return null;
              return (
                <div key={n.id} className="rounded-[1.5rem] border border-border/40 bg-background/20 p-4">
                  <h4 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-muted-foreground/80">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    {n.name}
                  </h4>
                  <div className="grid gap-2">
                    {items.map((b: any) => (
                      <div key={b.id} className="group flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-3 transition-colors hover:bg-accent/30">
                        <div>
                          <p className="text-sm font-bold">{b.size_label}</p>
                          <p className="text-[10px] font-medium uppercase tracking-tight text-muted-foreground">
                            User: <span className="text-foreground">{formatGHS(Number(b.user_price ?? b.base_price))}</span>{" "}
                            · Agent: <span className="font-bold text-primary">{formatGHS(Number(b.base_price))}</span>
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 rounded-lg p-0 hover:bg-primary hover:text-white"
                            onClick={() => { setEditingId(b.id); setForm({ network_id: b.network_id, size_label: b.size_label, size_gb: String(b.size_mb / 1000), user_price: String(b.user_price ?? b.base_price), base_price: String(b.base_price) }); }}
                          >
                            <Cog className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-destructive hover:bg-destructive/10" onClick={() => removeBundle(b.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
            <div className="border-b border-border/40 bg-card/50 p-6">
              <h3 className="text-lg font-bold tracking-tight">Onboarding Settings</h3>
              <p className="text-xs text-muted-foreground">Configure costs for new agent registrations.</p>
            </div>
            <div className="p-6">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activation Fee (GHS)</label>
              <div className="mt-2 flex gap-3">
                <Input value={activationFee} onChange={(e) => setActivationFee(e.target.value)} className="h-12 rounded-2xl bg-background/50 font-bold" />
                <Button className="h-12 rounded-2xl bg-foreground px-8 font-bold text-background transition-all hover:opacity-90 active:scale-95" onClick={saveActivationFee}>
                  Update Fee
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center rounded-[2rem] border border-dashed border-border/60 bg-accent/5 p-8 text-center">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/20 text-muted-foreground">
              <Settings className="h-6 w-6" />
            </div>
            <p className="px-6 text-sm font-medium text-muted-foreground">Additional pricing modules and promotional tools will appear here in future updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Integrations ──────────────────────────────────────────────────────────────

function IntegrationsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [config, setConfig] = useState<any>(null);

  const { isLoading } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "data_providers").maybeSingle();
      if (data?.value) {
        setConfig(data.value);
      } else {
        setConfig({
          active: "swft",
          providers: {
            swft:   { name: "SwiftData GH", base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "swft_live_74686859a45448bea75376f0a64f97ed" },
            mtopup: { name: "MTopUp",        base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api", api_key: "" },
          },
        });
      }
      return true;
    },
  });

  const saveConfig = async (newConfig: any) => {
    const { error } = await supabase.from("app_settings").upsert({ key: "data_providers", value: newConfig });
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Integrations updated successfully" });
    setConfig(newConfig);
    qc.invalidateQueries({ queryKey: ["admin-integrations"] });
  };

  const updateProvider = (key: string, field: string, val: string) => {
    setConfig((prev: any) => ({
      ...prev,
      providers: { ...prev.providers, [key]: { ...prev.providers[key], [field]: val } },
    }));
  };

  if (isLoading || !config) return <LoadingCard text="Loading integrations…" />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="flex flex-col gap-4 border-b border-border/40 bg-card/50 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Data Providers</h2>
            <p className="text-sm text-muted-foreground">Manage API keys and active fulfillment providers.</p>
          </div>
          <Button onClick={() => saveConfig(config)} className="h-10 w-full rounded-xl bg-primary px-6 font-bold shadow-soft transition-all hover:scale-105 sm:w-auto">
            Save Changes
          </Button>
        </div>
        <div className="space-y-6 p-6">
          {Object.entries(config.providers).map(([key, provider]: [string, any]) => {
            const isActive = config.active === key;
            return (
              <div key={key} className={`relative overflow-hidden rounded-2xl border p-6 transition-all ${isActive ? "border-primary/50 bg-primary/5" : "border-border/40 bg-background/50"}`}>
                {isActive && (
                  <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </div>
                )}
                <h3 className="text-lg font-bold">{provider.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground">Configure {provider.name} settings</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Base URL</label>
                    <Input value={provider.base_url} onChange={(e) => updateProvider(key, "base_url", e.target.value)} className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" />
                  </div>
                  <div className="space-y-2">
                    <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">API Key / Secret</label>
                    <Input type="password" value={provider.api_key} onChange={(e) => updateProvider(key, "api_key", e.target.value)} placeholder="Enter API key…" className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" />
                  </div>
                </div>
                {!isActive && (
                  <Button variant="outline" onClick={() => saveConfig({ ...config, active: key })} className="mt-5 h-10 rounded-xl border-primary/20 font-bold text-primary hover:bg-primary hover:text-primary-foreground">
                    Set as Active Provider
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Site Settings ─────────────────────────────────────────────────────────────

function SiteSettingsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [notice, setNotice]             = useState("");

  useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("app_settings").select("key, value");
      const map: Record<string, any> = {};
      (rows ?? []).forEach((r: any) => (map[r.key] = r.value));
      setSupportPhone(String(map.support_phone ?? ""));
      setSupportEmail(String(map.support_email ?? ""));
      setWhatsappLink(String(map.whatsapp_group_link ?? ""));
      setNotice(String(map.popup_notice ?? ""));
      return true;
    },
    staleTime: 60_000,
  });

  const saveSettings = async () => {
    const rows = [
      { key: "support_phone",       value: supportPhone },
      { key: "support_email",       value: supportEmail },
      { key: "whatsapp_group_link", value: whatsappLink },
      { key: "popup_notice",        value: notice },
    ];
    const { error } = await supabase.from("app_settings").upsert(rows as any);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "System configuration updated" });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
      <div className="border-b border-border/40 bg-card/50 p-6">
        <h2 className="text-xl font-bold tracking-tight">Platform Configuration</h2>
        <p className="text-sm text-muted-foreground">Adjust support channels and system-wide notifications.</p>
      </div>
      <div className="p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <div className="space-y-2">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Support Hotline</label>
            <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+233…" className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="space-y-2">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Support Email</label>
            <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@onegig.com" className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Community Hub (WhatsApp)</label>
            <Input value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="ml-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">Platform-Wide Notice</label>
            <textarea
              value={notice}
              onChange={(e) => setNotice(e.target.value)}
              placeholder="Important update or promotional notice for all users…"
              className="min-h-[120px] w-full resize-none rounded-2xl border border-border/40 bg-background/50 p-4 text-sm font-medium outline-none transition-all focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>
        <Button className="mt-8 w-full sm:w-auto h-12 rounded-2xl bg-primary px-10 font-bold shadow-soft transition-all hover:scale-105 active:scale-95" onClick={saveSettings}>
          <BellRing className="mr-2 h-4 w-4" /> Save Configuration
        </Button>
      </div>
    </div>
  );
}

// ── Marketing ─────────────────────────────────────────────────────────────────

function MarketingSection() {
  const { toast } = useToast();
  const [audience, setAudience] = useState("all");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // In-App Notification state
  const [pushTitle, setPushTitle] = useState("");
  const [pushMessage, setPushMessage] = useState("");
  const [pushType, setPushType] = useState("info");
  const [pushSound, setPushSound] = useState("default");
  const [pushing, setPushing] = useState(false);

  const PUSH_TEMPLATES = [
    { label: "-- Select Template --", title: "", message: "", type: "info", sound: "default" },
    { label: "System Maintenance", title: "Scheduled Maintenance 🛠️", message: "Our system will undergo brief maintenance shortly. Expect 15 mins of downtime.", type: "info", sound: "alert" },
    { label: "Flash Sale Promo", title: "Flash Sale! 🎉", message: "Get 10% extra on all MTN data purchases for the next 2 hours!", type: "success", sound: "success" },
    { label: "Network Issue (MTN)", title: "MTN Network Delay ⚠️", message: "We are currently experiencing delays with MTN data deliveries. We are monitoring the situation.", type: "error", sound: "alert" },
    { label: "Network Resolved", title: "Network Issues Resolved ✅", message: "All pending data orders have been delivered. Thank you for your patience!", type: "success", sound: "success" },
    { label: "Agent Bonus", title: "Agent Bonus Received! 💰", message: "Congratulations! You've received a bonus in your wallet for reaching your weekly target.", type: "success", sound: "paystack" },
    { label: "Wallet Top-Up Promo", title: "Top Up Bonus 🎁", message: "Fund your wallet with GHS 100 or more today and get a free 1GB data bundle!", type: "info", sound: "default" },
    { label: "New Feature", title: "New Feature Alert 🚀", message: "You can now copy your order receipts directly from your dashboard!", type: "info", sound: "success" },
    { label: "Failed Order Refund", title: "Order Refunded 💸", message: "Your recent failed order has been fully refunded to your wallet.", type: "info", sound: "paystack" },
    { label: "Weekend Special", title: "Weekend Special! 🌟", message: "Happy weekend! Enjoy seamless data top-ups with zero transaction fees today.", type: "success", sound: "default" },
    { label: "Security Notice", title: "Security Reminder 🔒", message: "Never share your password or OTP with anyone. Our staff will never ask for it.", type: "error", sound: "alert" },
  ];

  const SMS_TEMPLATES = [
    { label: "-- Select SMS Template --", message: "" },
    { label: "Scheduled Maintenance", message: "OneGig Update: Our system will undergo brief maintenance from 12AM to 1AM tonight. We apologize for the inconvenience." },
    { label: "Flash Sale Promo", message: "Flash Sale! Get 10% extra on all MTN data purchases at OneGig for the next 2 hours! Buy now at onegig.com" },
    { label: "Network Issue (MTN)", message: "Notice: We are currently experiencing delays with MTN data deliveries. Our team is monitoring the situation." },
    { label: "Network Resolved", message: "Update: All MTN network issues have been resolved! Your pending data orders have been processed. Thank you for your patience." },
    { label: "Agent Promo", message: "Agent Alert: Sell over GHS 500 this week and earn a special bonus credited directly to your OneGig wallet!" },
    { label: "Welcome Bonus", message: "Welcome to OneGig! Get a free 500MB bonus on your first data purchase of GHS 20 or more today." },
    { label: "Price Drop Alert", title: "Price Drop", message: "Great News! We've dropped prices on all Telecel data bundles. Check out the new rates on your dashboard today." },
    { label: "Weekend Special", message: "Happy Weekend! Top up your data on OneGig with zero transaction fees all weekend long. Stay connected!" },
    { label: "Account Security", message: "Security Reminder: OneGig staff will never call to ask for your password or OTP. Please keep your account details secure." },
    { label: "Holiday Greeting", message: "Happy Holidays from OneGig! Enjoy 5% cashback on all data purchases today to celebrate the season with loved ones." },
  ];

  const handleSend = async () => {
    if (!message.trim()) {
      toast({ title: "Error", description: "Message cannot be empty.", variant: "destructive" });
      return;
    }
    if (!window.confirm("Are you sure you want to send this SMS campaign? This may cost credits.")) return;
    
    setSending(true);
    const { error } = await supabase.functions.invoke("send-campaign-sms", {
      body: { audience, message },
    });
    setSending(false);

    if (error) {
      toast({ title: "Campaign failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({ title: "Campaign sent successfully", description: "SMS messages are being dispatched in the background." });
    setMessage("");
  };

  return (
    <>
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-b border-border/40 bg-card/50 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">SMS Marketing</h2>
        </div>
        <p className="text-sm text-muted-foreground">Send bulk SMS messages to users or agents.</p>
      </div>

      <div className="p-6 space-y-6 max-w-2xl">
        <div className="space-y-3">
          <label className="text-sm font-semibold">Select Audience</label>
          <select 
            value={audience} 
            onChange={(e) => setAudience(e.target.value)}
            className="w-full rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="all">All Users</option>
            <option value="agents">All Agents</option>
          </select>
        </div>

        <div className="space-y-3 pb-2 border-b border-border/40">
          <label className="text-sm font-semibold">Load SMS Template (Optional)</label>
          <select 
            onChange={(e) => {
              const tmpl = SMS_TEMPLATES[Number(e.target.value)];
              if (tmpl && tmpl.label !== "-- Select SMS Template --") {
                setMessage(tmpl.message);
              }
            }}
            className="w-full rounded-2xl border border-border/60 bg-primary/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all font-semibold"
          >
            {SMS_TEMPLATES.map((t, idx) => (
              <option key={idx} value={idx}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS campaign message here..."
            className="w-full min-h-[120px] rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
          />
          <p className="text-xs text-muted-foreground text-right">{message.length} characters</p>
        </div>

        <Button 
          onClick={handleSend} 
          disabled={sending || !message.trim()}
          className="w-full sm:w-auto h-12 rounded-2xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95"
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
          Send Campaign
        </Button>
      </div>
    </div>
    
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
      <div className="border-b border-border/40 bg-card/50 p-6">
        <div className="flex items-center gap-2 mb-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-bold tracking-tight">In-App Push Notifications</h2>
        </div>
        <p className="text-sm text-muted-foreground">Send real-time alerts with sound to all users currently online.</p>
      </div>

      <div className="p-6 space-y-6 max-w-2xl">
        <div className="space-y-3 pb-2 border-b border-border/40">
          <label className="text-sm font-semibold">Load Template (Optional)</label>
          <select 
            onChange={(e) => {
              const tmpl = PUSH_TEMPLATES[Number(e.target.value)];
              if (tmpl && tmpl.label !== "-- Select Template --") {
                setPushTitle(tmpl.title);
                setPushMessage(tmpl.message);
                setPushType(tmpl.type);
                setPushSound(tmpl.sound);
              }
            }}
            className="w-full rounded-2xl border border-border/60 bg-primary/5 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all font-semibold"
          >
            {PUSH_TEMPLATES.map((t, idx) => (
              <option key={idx} value={idx}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold">Title</label>
          <Input 
            value={pushTitle} 
            onChange={(e) => setPushTitle(e.target.value)} 
            placeholder="e.g. System Maintenance" 
            className="h-12 rounded-2xl bg-background/50" 
          />
        </div>

        <div className="space-y-3">
          <label className="text-sm font-semibold">Message</label>
          <textarea
            value={pushMessage}
            onChange={(e) => setPushMessage(e.target.value)}
            placeholder="Your notification message..."
            className="w-full min-h-[100px] rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <label className="text-sm font-semibold">Type</label>
            <select 
              value={pushType} 
              onChange={(e) => setPushType(e.target.value)}
              className="w-full rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            >
              <option value="info">Info (Default)</option>
              <option value="success">Success</option>
              <option value="error">Error/Warning</option>
            </select>
          </div>

          <div className="space-y-3">
            <label className="text-sm font-semibold">Sound</label>
            <select 
              value={pushSound} 
              onChange={(e) => {
                setPushSound(e.target.value);
                // Play preview
                const url = NOTIFICATION_SOUNDS[e.target.value] || NOTIFICATION_SOUNDS.default;
                const audio = new Audio(url);
                audio.volume = 0.8;
                audio.play().catch(() => {});
              }}
              className="w-full rounded-2xl border border-border/60 bg-background/50 px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            >
              <option value="default">Pop (Default)</option>
              <option value="success">Chime (Success)</option>
              <option value="paystack">Coin Drop (Paystack-like)</option>
              <option value="alert">Alert (Urgent)</option>
            </select>
          </div>
        </div>

        <Button 
          onClick={async () => {
            if (!pushTitle.trim() || !pushMessage.trim()) return toast({ title: "Error", description: "Title and message required.", variant: "destructive" });
            setPushing(true);
            const { error } = await supabase.from('app_notifications').insert({
              title: pushTitle,
              message: pushMessage,
              type: pushType,
              sound_name: pushSound,
              is_global: true
            });
            setPushing(false);
            if (error) {
              toast({ title: "Failed to send", description: error.message, variant: "destructive" });
            } else {
              toast({ title: "Notification Sent", description: "Sent to all active users instantly." });
              setPushTitle("");
              setPushMessage("");
            }
          }} 
          disabled={pushing || !pushTitle.trim() || !pushMessage.trim()}
          className="w-full sm:w-auto h-12 rounded-2xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95"
        >
          {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
          Send Push Notification
        </Button>
      </div>
    </div>
    </>
  );
}

// ── Metric card ───────────────────────────────────────────────────────────────

function Metric({
  title, value, icon, helper, variant = "indigo",
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  helper?: string;
  variant?: "indigo" | "amber" | "emerald" | "rose" | "sky";
}) {
  const variants = {
    indigo:  "from-indigo-500/20 to-indigo-500/5 text-indigo-500 border-indigo-500/20",
    amber:   "from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/20",
    rose:    "from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/20",
    sky:     "from-sky-500/20 to-sky-500/5 text-sky-500 border-sky-500/20",
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-card/40 p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${variants[variant]}`}>
        {icon}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="mt-0.5 text-2xl md:text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {helper && <p className="mt-1.5 md:mt-2 text-[10px] md:text-xs font-medium text-muted-foreground/80">{helper}</p>}
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${variants[variant]} opacity-10 blur-2xl`} />
    </div>
  );
}
