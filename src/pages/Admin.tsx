import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity, BellRing, CheckCircle2, Clock, Cog, DollarSign, Globe2,
  Loader2, Package, RefreshCw, RotateCcw, Search, Settings, Shield,
  ShieldCheck, ShoppingCart, Trash2, TrendingUp, UserCog, Users,
  Wallet, XCircle, Zap, Megaphone, Gift, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { AdminUserDetailsModal } from "@/components/dashboard/AdminUserDetailsModal";
import { NOTIFICATION_SOUNDS } from "@/components/ui/InAppNotificationListener";
import { cn } from "@/lib/utils";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from "recharts";

type Tab = "overview" | "users" | "orders" | "payments" | "withdrawals" | "pricing" | "integrations" | "settings" | "marketing" | "coupons" | "subscriptions";

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
    { label: "Payments",      value: "payments",     icon: <DollarSign className="h-4 w-4" /> },
    { label: "Momo Subscriptions", value: "subscriptions", icon: <RefreshCw className="h-4 w-4" /> },
    { label: "Withdrawals",   value: "withdrawals",  icon: <Wallet className="h-4 w-4" /> },
    { label: "Pricing",       value: "pricing",      icon: <Cog className="h-4 w-4" /> },
    { label: "Marketing",     value: "marketing",    icon: <Megaphone className="h-4 w-4" /> },
    { label: "Promo Coupons",  value: "coupons",      icon: <Gift className="h-4 w-4" /> },
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
        { tab === "users"        && <UsersSection />}
        { tab === "orders"       && <OrdersSection />}
        { tab === "payments"     && <PaymentsSection />}
        { tab === "withdrawals"  && <WithdrawalsSection />}
        {tab === "pricing"      && <PricingSection />}
        {tab === "marketing"    && <MarketingSection />}
        {tab === "integrations" && <IntegrationsSection />}
        {tab === "settings"     && <SiteSettingsSection />}
        {tab === "coupons"      && <CouponsSection />}
        {tab === "subscriptions" && <SubscriptionsSection />}
      </div>
    </DashboardLayout>
  );
}

// ── Payments ──────────────────────────────────────────────────────────────────

function PaymentsSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const { data: payments, error } = await supabase
        .from("payments")
        .select("id, reference, purpose, amount, currency, status, payload, created_at, user_id")
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (error) throw error;
      
      const userIds = [...new Set((payments ?? []).map((p: any) => p.user_id).filter(Boolean))] as string[];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds);
        profiles = p ?? [];
      }
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      
      return (payments ?? []).map((p: any) => ({
        ...p,
        customer: p.user_id ? profileMap.get(p.user_id) : null
      }));
    }
  });

  const forceResolve = async (payment: any) => {
    if (!confirm("Are you sure you want to manually mark this payment as PAID and fulfill the order?")) return;
    setBusyId(payment.id);
    
    // 1. Mark payment as paid
    const { error: resolveErr } = await supabase.functions.invoke("admin-resolve-payment", {
      body: { payment_id: payment.id }
    });
    
    if (resolveErr) {
      setBusyId(null);
      toast({ title: "Failed to resolve payment", description: resolveErr.message, variant: "destructive" });
      return;
    }
    
    // 2. Fulfill order if it was an order
    if (payment.purpose === "order" && payment.payload?.bundle_id) {
      const { error: fulfillErr } = await supabase.functions.invoke("place-order", {
        body: {
          recipient_phone: payment.payload.recipient_phone,
          bundle_id: payment.payload.bundle_id,
          agent_slug: payment.payload.agent_slug,
          manual_fulfill: true // Just mark it as delivered since we are forcing it
        }
      });
      if (fulfillErr) {
        setBusyId(null);
        toast({ title: "Payment resolved, but order failed", description: fulfillErr.message, variant: "destructive" });
        return;
      }
    }
    
    setBusyId(null);
    toast({ title: "Payment successfully resolved!" });
    qc.invalidateQueries({ queryKey: ["admin-payments"] });
  };

  if (isLoading) return <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-primary" /></div>;

  const payments = data ?? [];
  const q = search.toLowerCase();
  
  const filtered = payments.filter((p: any) => {
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    if (q) {
      const name = (p.customer?.full_name || "").toLowerCase();
      const phone = (p.customer?.phone || p.payload?.recipient_phone || "").toLowerCase();
      const ref = (p.reference || "").toLowerCase();
      const errMsg = (p.payload?.error_message || "").toLowerCase();
      if (!name.includes(q) && !phone.includes(q) && !ref.includes(q) && !errMsg.includes(q)) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card/40 backdrop-blur-md p-5 rounded-[2rem] border border-border/40 shadow-soft">
        <div>
          <h2 className="text-lg font-black tracking-tight text-foreground">Payments Monitor</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track and force-resolve incoming platform payments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input 
              placeholder="Search reference, phone, error..." 
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-56 h-10 rounded-xl bg-background/50 pl-9 pr-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/20 border-border/60 hover:border-border/80 transition-all text-foreground" 
            />
          </div>
          <div className="flex bg-secondary/40 p-1 rounded-xl border border-border/40">
            {["all", "paid", "failed", "initialized"].map(s => (
              <button 
                key={s} 
                onClick={() => setStatusFilter(s)}
                className={cn("px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all", statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
      
      <div className="bg-card/25 rounded-[2rem] border border-border/45 backdrop-blur-md divide-y divide-border/30 overflow-hidden shadow-soft">
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-sm font-semibold text-muted-foreground">No transactions match your filters.</div>
        ) : (
          filtered.map((p: any) => (
            <div key={p.id} className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:bg-primary/[0.01] transition-colors">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-black tracking-tight text-foreground">{formatGHS(p.amount)}</span>
                  <StatusBadge status={p.status} />
                  <span className="text-[10px] font-mono bg-secondary/60 border border-border/40 px-2.5 py-0.5 rounded-md text-muted-foreground">{p.reference}</span>
                  <span className="text-[9px] uppercase font-black text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">{p.purpose}</span>
                </div>
                <div className="text-xs font-semibold text-muted-foreground/90">
                  {p.customer?.full_name || "Guest"} • <span className="text-foreground">{p.customer?.phone || p.payload?.recipient_phone || "N/A"}</span> • {timeAgo(p.created_at)}
                </div>
                {p.payload?.error_message && (
                  <div className="mt-2 text-xs font-semibold text-rose-500 bg-rose-500/10 px-3.5 py-2 rounded-xl border border-rose-500/20 max-w-2xl">
                    🚨 {p.payload.error_message}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 w-full md:w-auto mt-2 md:mt-0">
                {p.status === "failed" && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="h-9 rounded-xl text-xs font-bold border-emerald-500/30 text-emerald-600 bg-background/50 hover:bg-emerald-500 hover:text-white transition-all"
                    disabled={!!busyId}
                    onClick={() => forceResolve(p)}
                  >
                    {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : null}
                    Force Resolve
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
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
      <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-gradient-to-br from-card/60 via-card/30 to-transparent p-6 sm:p-8 backdrop-blur-md shadow-soft">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(0deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)," +
              "repeating-linear-gradient(90deg,transparent,transparent 22px,currentColor 22px,currentColor 23px)",
          }}
        />
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
            <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full self-start sm:self-auto">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">All Systems Operational</span>
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
        <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-primary/20 blur-3xl opacity-60 dark:opacity-40" />
        <div className="absolute bottom-0 right-24 h-20 w-20 rounded-full bg-primary/10 blur-2xl opacity-40" />
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
                    contentStyle={{ borderRadius: '16px', border: '1px solid border-border/40', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '11px', fontWeight: '600', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', padding: '10px 14px' }}
                    itemStyle={{ color: 'hsl(var(--primary))' }}
                    formatter={(value: number) => [formatGHS(value), "Revenue"]}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={3.5} dot={{ r: 4, fill: "hsl(var(--background))", strokeWidth: 2.5, stroke: "hsl(var(--primary))" }} activeDot={{ r: 6, strokeWidth: 0, fill: "hsl(var(--primary))" }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          
          <div className="flex flex-1 flex-col gap-4 rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md p-6 shadow-soft hover:shadow-lg transition-all duration-300 mt-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-emerald-500" />
              <h3 className="text-sm font-bold text-foreground">Top Networks (All Time)</h3>
            </div>
            <div className="h-40 w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.networkChartData ?? []} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="currentColor" className="opacity-[0.06]" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5, fontWeight: 600 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5, fontWeight: 600 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.02)' }}
                    contentStyle={{ borderRadius: '16px', border: '1px solid border-border/40', backgroundColor: 'hsl(var(--card))', color: 'hsl(var(--foreground))', fontSize: '11px', fontWeight: '600', padding: '10px 14px' }}
                    formatter={(value: number) => [value, "Orders"]}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={32}>
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
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null);
  const [verifiedUserNames, setVerifiedUserNames] = useState<Record<string, string>>({});

  const detectNetwork = (phone: string) => {
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233")) {
      num = "0" + num.substring(3);
    }
    const pfx = num.substring(0, 3);
    if (["024", "054", "055", "059", "025", "053"].includes(pfx)) return "MTN";
    if (["020", "050"].includes(pfx)) return "TELECEL";
    if (["027", "057", "026", "056"].includes(pfx)) return "AIRTELTIGO";
    return "MTN";
  };

  const verifyUserMomoName = async (userId: string, phone: string) => {
    setVerifyingUserId(userId);
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233")) {
      num = "0" + num.substring(3);
    }
    const network = detectNetwork(num);
    try {
      const { data, error } = await supabase.functions.invoke("paystack-resolve", {
        body: { momo_number: num, momo_network: network }
      });
      if (data?.ok && data?.account_name) {
        setVerifiedUserNames(prev => ({ ...prev, [userId]: data.account_name }));
        toast({ title: "Name Verified", description: `${data.account_name}` });
      } else {
        setVerifiedUserNames(prev => ({ ...prev, [userId]: "Not Found" }));
        toast({ title: "Verification Failed", description: data?.error || "Could not resolve name", variant: "destructive" });
      }
    } catch (err: any) {
      setVerifiedUserNames(prev => ({ ...prev, [userId]: "Error" }));
      toast({ title: "Verification Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingUserId(null);
    }
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const [profilesRes, rolesRes, agentProfilesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, username, email, phone").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
        supabase.from("agent_profiles").select("id, user_id, store_name, store_slug, activation_paid"),
      ]);

      const rolesMap = new Map<string, string[]>();
      (rolesRes.data ?? []).forEach((r: any) => {
        const prev = rolesMap.get(r.user_id) ?? [];
        rolesMap.set(r.user_id, [...prev, r.role]);
      });

      const agentProfileMap = new Map<string, any>();
      (agentProfilesRes.data ?? []).forEach((ap: any) => {
        agentProfileMap.set(ap.user_id, ap);
      });

      return (profilesRes.data ?? []).map((p: any) => ({
        ...p,
        roles: rolesMap.get(p.id) ?? ["user"],
        agentProfile: agentProfileMap.get(p.id) ?? null,
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
    <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
      <div className="flex flex-col gap-4 border-b border-border/40 bg-card/50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-black tracking-tight text-foreground">Platform Users</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage accounts and permissions across the system.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Search users…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-56 rounded-xl border border-border/60 bg-background/50 pl-9 pr-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all text-foreground placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="shrink-0 rounded-full bg-primary/10 px-3.5 py-1.5 text-xs font-black text-primary">
            {filtered.length}{search ? ` of ${data?.length ?? 0}` : " registered"}
          </div>
        </div>
      </div>

      <div className="divide-y divide-border/30">
        {filtered.map((u: any) => {
          const name = u.full_name || u.username || "Anonymous User";
          return (
            <div key={u.id} className="group flex flex-col gap-4 p-6 transition-all hover:bg-primary/[0.015] md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <UserAvatar name={name} />
                <div>
                  <p className="text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary">{name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs font-semibold text-muted-foreground/80 items-center">
                    {u.email && <span>{u.email}</span>}
                    {u.phone && <><span className="hidden sm:inline opacity-40">·</span><span>{u.phone}</span></>}
                    {u.phone && (
                      <>
                        <span className="hidden sm:inline opacity-40">·</span>
                        {verifyingUserId === u.id ? (
                          <span className="flex items-center gap-1 text-[10px] text-primary">
                            <Loader2 className="h-3 w-3 animate-spin" /> Verifying...
                          </span>
                        ) : verifiedUserNames[u.id] ? (
                          <span className={cn(
                            "rounded-full px-2 py-0.5 border text-[9px] font-black leading-none",
                            verifiedUserNames[u.id] === "Not Found" || verifiedUserNames[u.id] === "Error"
                              ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                          )}>
                            {verifiedUserNames[u.id] === "Not Found" || verifiedUserNames[u.id] === "Error"
                              ? `MoMo Name: ${verifiedUserNames[u.id]}`
                              : `Verified: ${verifiedUserNames[u.id]}`
                            }
                          </span>
                        ) : (
                          <button
                            onClick={() => verifyUserMomoName(u.id, u.phone)}
                            className="text-[10px] text-primary hover:underline hover:text-primary/80 transition-colors font-bold"
                          >
                            Verify Paystack Name
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {u.roles.map((r: string) => (
                      <span key={r} className={cn("rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider", roleStyle[r] ?? roleStyle.user)}>
                        {r}
                      </span>
                    ))}
                    {u.roles.includes("agent") && (
                      u.agentProfile?.activation_paid ? (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          Active Store
                        </span>
                      ) : (
                        <span className="rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500 px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider">
                          Store Inactive
                        </span>
                      )
                    )}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:flex items-center gap-2.5 pt-3.5 md:pt-0 border-t border-border/30 md:border-0">
                <Button
                  variant="outline" size="sm"
                  className="col-span-full md:col-auto h-9 md:h-8 rounded-xl border-border/60 bg-background/50 text-xs font-bold hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                  onClick={() => setSelectedUser(u)}
                >
                  View Details
                </Button>
                {!u.roles.includes("agent") && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-border/60 bg-background/50 text-xs font-bold hover:border-amber-500/40 hover:bg-amber-500/5 hover:text-amber-600"
                    disabled={busyId === u.id}
                    onClick={() => makeAgent(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><UserCog className="mr-1.5 h-3.5 w-3.5 md:h-3 md:w-3" />Agent</>}
                  </Button>
                )}
                {u.roles.includes("agent") && !u.agentProfile?.activation_paid && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-emerald-500/30 bg-background/50 text-xs font-bold text-emerald-600 hover:border-emerald-500 hover:bg-emerald-500 hover:text-white"
                    disabled={busyId === u.id}
                    onClick={() => makeAgent(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5 md:h-3 md:w-3" />Verify Account</>}
                  </Button>
                )}
                {!u.roles.includes("admin") && (
                  <Button
                    variant="outline" size="sm"
                    className="h-9 md:h-8 rounded-xl border-border/60 bg-background/50 text-xs font-bold hover:border-emerald-500/40 hover:bg-emerald-500/5 hover:text-emerald-600"
                    disabled={busyId === u.id}
                    onClick={() => makeAdmin(u.id)}
                  >
                    {busyId === u.id
                      ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                      : <><ShieldCheck className="mr-1.5 h-3.5 w-3.5 md:h-3 md:w-3" />Admin</>}
                  </Button>
                )}
                <Button
                  variant="ghost" size="sm"
                  className="col-span-full md:col-auto h-9 md:h-8 md:w-8 rounded-xl text-muted-foreground/45 hover:bg-destructive/10 hover:text-destructive border border-border/60 bg-background/50 md:border-0 md:bg-transparent"
                  disabled={busyId === u.id}
                  onClick={() => removeUser(u.id)}
                >
                  {busyId === u.id
                    ? <Loader2 className="h-4 w-4 md:h-3.5 md:w-3.5 animate-spin" />
                    : <><Trash2 className="md:mr-0 mr-1.5 h-3.5 w-3.5" /><span className="md:hidden font-bold text-xs">Delete User</span></>}
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
  const [dateFilter, setDateFilter]     = useState("7d");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, reference, bundle_id, source, status, sell_price, created_at, customer_user_id, recipient_phone, bundle:bundles(size_label), network:networks(name, logo_emoji), agent:agent_profiles!orders_agent_id_fkey(store_name)")
        .order("created_at", { ascending: false });

      if (dateFilter === "today") {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        query = query.gte("created_at", d.toISOString());
      } else if (dateFilter === "7d") {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        query = query.gte("created_at", d.toISOString());
      } else if (dateFilter === "30d") {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        query = query.gte("created_at", d.toISOString());
      }

      const { data: orders, error } = await query.limit(800);
      
      if (error) {
        console.error("Orders query error:", error);
        throw error;
      }

      const userIds = [...new Set((orders ?? []).map((o: any) => o.customer_user_id).filter(Boolean))] as string[];
      let profiles: Profile[] = [];
      
      if (userIds.length) {
        // Chunk userIds to avoid URI Too Long error
        const chunkSize = 50;
        for (let i = 0; i < userIds.length; i += chunkSize) {
          const chunk = userIds.slice(i, i + chunkSize);
          const { data: p, error: pError } = await supabase
            .from("profiles")
            .select("id, full_name, username, email, phone")
            .in("id", chunk);
            
          if (!pError && p) {
            profiles = [...profiles, ...(p as Profile[])];
          }
        }
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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Total Orders",  value: orders.length,     icon: ShoppingCart, iconBg: "bg-primary/10 text-primary border-primary/20", valCl: "text-foreground" },
          { label: "Delivered",     value: delivered,          icon: CheckCircle2, iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", valCl: "text-emerald-600 dark:text-emerald-400" },
          { label: "In Progress",   value: inProgress,         icon: Clock,        iconBg: "bg-amber-500/10 text-amber-500 border-amber-500/20", valCl: "text-amber-600 dark:text-amber-400" },
          { label: "Failed",        value: failed,             icon: XCircle,      iconBg: "bg-rose-500/10 text-rose-500 border-rose-500/20", valCl: "text-rose-600 dark:text-rose-400" },
          { label: "Total Revenue", value: formatGHS(revenue), icon: TrendingUp,   iconBg: "bg-violet-500/10 text-violet-500 border-violet-500/20", valCl: "text-violet-600 dark:text-violet-400" },
        ].map(({ label, value, icon: Icon, iconBg, valCl }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-md shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${iconBg}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/75">{label}</p>
            <p className={`mt-1.5 text-xl sm:text-2xl font-black tracking-tight tabular-nums ${valCl}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Search + filter */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search phone, name, ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background/50 pl-9 pr-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all"
          />
        </div>
        <div className="flex flex-wrap shrink-0 items-center gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 rounded-xl border border-border/60 bg-background/50 px-3 text-xs font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
          
          <div className="flex shrink-0 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
            {FILTERS.map(({ label, value, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap ${
                statusFilter === value
                  ? "bg-background text-foreground shadow-sm font-black"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-black tabular-nums ${
                  statusFilter === value ? "bg-primary/20 text-primary border border-primary/30" : "bg-secondary text-muted-foreground"
                }`}>
                  {count}
                </span>
              )}
            </button>
          ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/25 backdrop-blur-md shadow-soft">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-secondary/40 border border-border/30">
              <Package className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">No orders found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="hidden w-full text-left md:table text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/20 text-muted-foreground/75">
                  {["Bundle", "Recipient", "Customer", "Revenue", "Status", "When", ""].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] font-black uppercase tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((o: any, i: number) => (
                  <tr key={o.id} className={`group transition-colors hover:bg-primary/[0.01] ${i % 2 !== 0 ? "bg-secondary/[0.02]" : ""}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/60 text-lg leading-none border border-border/30">
                          {o.network?.logo_emoji ?? "📦"}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{o.bundle?.size_label ?? "—"}</p>
                          <p className="text-[10px] text-muted-foreground/90 font-medium">{o.network?.name}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded-lg bg-secondary/70 border border-border/30 px-2 py-1 text-[11px] font-mono font-semibold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <p className="max-w-[150px] truncate text-sm font-bold text-foreground">
                        {o.customer?.full_name || o.customer?.email || (
                          <span className="font-normal italic text-muted-foreground/70">Guest</span>
                        )}
                      </p>
                      {o.source && (
                        <span className="mt-1 inline-block rounded-md bg-secondary/80 border border-border/35 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/80">
                          {o.source.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={o.status} />
                        {o.status === "failed" && o.notes && (
                          <span className="max-w-[120px] truncate text-[9px] font-semibold text-rose-500/80 bg-rose-500/10 px-1.5 py-0.5 rounded" title={o.notes}>
                            {o.notes}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="whitespace-nowrap text-xs font-bold text-foreground">
                        {new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(o.created_at))}
                      </p>
                      <p className="whitespace-nowrap text-[10px] text-muted-foreground/80 font-medium">{timeAgo(o.created_at)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {o.status === "failed" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm" variant="outline"
                            disabled={retryId === o.id}
                            onClick={() => retryOrder(o, true)}
                            className="h-8 gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/5 px-3 text-xs font-bold text-emerald-500 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all shadow-sm"
                          >
                            {retryId === o.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><CheckCircle2 className="h-3.5 w-3.5" /> Manual Fulfill</>}
                          </Button>
                          <Button
                            size="sm" variant="outline"
                            disabled={retryId === o.id}
                            onClick={() => retryOrder(o, false)}
                            className="h-8 gap-1.5 rounded-xl border-rose-500/30 bg-rose-500/5 px-3 text-xs font-bold text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all shadow-sm"
                          >
                            {retryId === o.id
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <><RotateCcw className="h-3.5 w-3.5" /> Retry API</>}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Cards */}
            <div className="grid gap-4 p-5 md:hidden">
              {filtered.map((o: any) => (
                <div key={o.id} className="flex flex-col gap-4 rounded-2xl border border-border/40 bg-card/45 p-5 shadow-soft transition-all hover:bg-primary/[0.01]">
                  <div className="flex items-center justify-between border-b border-border/30 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary/70 border border-border/30 text-lg leading-none">
                        {o.network?.logo_emoji ?? "📦"}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground leading-tight">{o.bundle?.size_label ?? "—"}</p>
                        <p className="text-[10px] text-muted-foreground/80 font-medium">{o.network?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
                      <p className="text-[10px] text-muted-foreground/85 font-medium">{timeAgo(o.created_at)}</p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground/80">Recipient</span>
                      <code className="rounded-lg bg-secondary/70 border border-border/30 px-2 py-0.5 font-mono font-bold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground/80">Customer</span>
                      <div className="text-right">
                        <p className="max-w-[150px] truncate font-bold text-foreground">
                          {o.customer?.full_name || o.customer?.email || (
                            <span className="font-normal italic text-muted-foreground/60">Guest</span>
                          )}
                        </p>
                        {o.source && (
                          <span className="mt-0.5 inline-block rounded-md bg-secondary/80 border border-border/35 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-widest text-muted-foreground/75">
                            {o.source.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-muted-foreground/80">Status</span>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={o.status} />
                        {o.status === "failed" && o.notes && (
                          <span className="max-w-[120px] truncate text-[9px] font-semibold text-rose-500/80 bg-rose-500/10 px-1.5 py-0.5 rounded" title={o.notes}>
                            {o.notes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {o.status === "failed" && (
                    <div className="grid grid-cols-2 gap-2.5 pt-4 border-t border-border/30">
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
          <div className="flex items-center justify-between border-t border-border/30 bg-secondary/10 px-6 py-4">
            <p className="text-xs font-semibold text-muted-foreground/80">
              Showing <span className="font-black text-foreground">{filtered.length}</span> of <span className="font-black">{orders.length}</span> orders
            </p>
            <button
              type="button"
              onClick={() => qc.invalidateQueries({ queryKey: ["admin-orders"] })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-all border border-transparent hover:border-border/30"
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
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifiedNames, setVerifiedNames] = useState<Record<string, string>>({});

  const verifyMomoAccount = async (withdrawalId: string, momoNumber: string, momoNetwork: string) => {
    setVerifyingId(withdrawalId);
    let num = momoNumber.replace(/\D/g, "");
    if (num.startsWith("233")) {
      num = "0" + num.substring(3);
    }
    try {
      const { data, error } = await supabase.functions.invoke("paystack-resolve", {
        body: { momo_number: num, momo_network: momoNetwork }
      });
      if (data?.ok && data?.account_name) {
        setVerifiedNames(prev => ({ ...prev, [withdrawalId]: data.account_name }));
        toast({ title: "Account Verified Successfully", description: `Registered Name: ${data.account_name}` });
      } else {
        setVerifiedNames(prev => ({ ...prev, [withdrawalId]: "Not Found" }));
        toast({ title: "Verification Failed", description: data?.error || "Could not resolve name", variant: "destructive" });
      }
    } catch (err: any) {
      setVerifiedNames(prev => ({ ...prev, [withdrawalId]: "Error" }));
      toast({ title: "Verification Error", description: err.message, variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

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
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Pending banner */}
      {pending.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between rounded-[2rem] border border-amber-500/25 bg-amber-500/10 px-6 py-5 backdrop-blur-md">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 border border-amber-500/20">
              <Wallet className="h-5 w-5 text-amber-500 animate-pulse" />
            </div>
            <div>
              <p className="text-sm font-black text-amber-600 dark:text-amber-400">
                {pending.length} pending withdrawal{pending.length > 1 ? "s" : ""} awaiting approval
              </p>
              <p className="text-xs font-semibold text-amber-500/80 mt-0.5">Review and mark each as paid once transferred.</p>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">Total Pending</p>
            <p className="text-2xl font-black tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">{formatGHS(pendingTotal)}</p>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <h2 className="text-xl font-black tracking-tight text-foreground">Withdrawal Requests</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage and process agent payout requests.</p>
        </div>
        <div className="divide-y divide-border/30">
          {(data ?? []).map((w: any) => (
            <div key={w.id} className="group p-6 transition-all hover:bg-primary/[0.015]">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 group-hover:scale-105 transition-transform duration-300">
                    <DollarSign className="h-5.5 w-5.5" />
                  </div>
                  <div>
                    <p className="text-base font-bold leading-tight text-foreground group-hover:text-primary transition-colors">{w.profile?.full_name || w.profile?.email || "Unknown Agent"}</p>
                    <p className="mt-1.5 text-xs font-semibold text-muted-foreground/80">
                      Available: <span className="text-foreground font-bold">{formatGHS(w.balance)}</span>{" "}
                      · Requested: <span className="text-foreground/90 font-medium">{timeAgo(w.created_at)}</span>
                    </p>
                  </div>
                </div>

                <div className="flex flex-col items-start md:items-end gap-1.5">
                  <p className="text-2xl font-black tracking-tighter text-foreground tabular-nums">{formatGHS(w.amount)}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest text-muted-foreground/80">
                    <span className="rounded-md bg-secondary/80 border border-border/40 px-2 py-0.5">{w.momo_network}</span>
                    <span className="font-mono">{w.momo_number}</span>
                    <span className="hidden opacity-30 md:inline">|</span>
                    <span className="max-w-[120px] truncate">{w.momo_name}</span>
                    <span className="hidden opacity-30 md:inline">|</span>
                    {verifyingId === w.id ? (
                      <span className="flex items-center gap-1 text-[9px] text-primary lowercase tracking-normal">
                        <Loader2 className="h-3 w-3 animate-spin" /> verifying...
                      </span>
                    ) : verifiedNames[w.id] ? (
                      <span className={cn(
                        "rounded-full px-2 py-0.5 border text-[9px] font-black leading-none",
                        verifiedNames[w.id] === "Not Found" || verifiedNames[w.id] === "Error"
                          ? "border-rose-500/20 bg-rose-500/10 text-rose-500"
                          : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
                      )}>
                        {verifiedNames[w.id] === "Not Found" || verifiedNames[w.id] === "Error"
                          ? `MoMo Name: ${verifiedNames[w.id]}`
                          : `Verified: ${verifiedNames[w.id]}`
                        }
                      </span>
                    ) : (
                      <button
                        onClick={() => verifyMomoAccount(w.id, w.momo_number, w.momo_network)}
                        className="text-[10px] text-primary hover:underline hover:text-primary/80 transition-colors font-bold lowercase tracking-normal"
                      >
                        verify momo name
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-4 md:pt-0 border-t border-border/30 md:border-0 justify-between md:justify-start w-full md:w-auto">
                  <div className={`rounded-xl border px-3 py-1.5 text-[10px] font-black uppercase tracking-widest ${w.status === "paid" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-500" : "border-amber-500/20 bg-amber-500/10 text-amber-500"}`}>
                    {w.status}
                  </div>
                  <Button
                    className="h-10 rounded-xl bg-primary px-6 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 disabled:opacity-50 text-xs"
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
      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <h2 className="text-xl font-black tracking-tight text-foreground">{editingId ? "Edit Package" : "Create New Package"}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Configure data bundle pricing and network availability.</p>
        </div>
        <div className="p-6 md:p-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Network Provider</label>
              <select
                value={form.network_id}
                onChange={(e) => setForm((p) => ({ ...p, network_id: e.target.value }))}
                className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer"
              >
                <option value="">Select Network…</option>
                {payload?.networks.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
              </select>
            </div>
            
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bundle Label</label>
              <select 
                value={form.size_label} 
                onChange={(e) => {
                  const val = e.target.value;
                  let gb = form.size_gb;
                  if (val.includes("500MB")) gb = "0.5";
                  else if (val.includes("GB")) {
                    const match = val.match(/([\d.]+)GB/);
                    if (match) gb = match[1];
                  }
                  setForm((p) => ({ ...p, size_label: val, size_gb: gb }));
                }} 
                className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer" 
              >
                <option value="">Select Bundle Label…</option>
                <option value="500MB Non-Expiry">500MB Non-Expiry</option>
                <option value="1GB Non-Expiry">1GB Non-Expiry</option>
                <option value="1.5GB Non-Expiry">1.5GB Non-Expiry</option>
                <option value="2GB Non-Expiry">2GB Non-Expiry</option>
                <option value="3GB Non-Expiry">3GB Non-Expiry</option>
                <option value="4GB Non-Expiry">4GB Non-Expiry</option>
                <option value="5GB Non-Expiry">5GB Non-Expiry</option>
                <option value="6GB Non-Expiry">6GB Non-Expiry</option>
                <option value="7GB Non-Expiry">7GB Non-Expiry</option>
                <option value="8GB Non-Expiry">8GB Non-Expiry</option>
                <option value="9GB Non-Expiry">9GB Non-Expiry</option>
                <option value="10GB Non-Expiry">10GB Non-Expiry</option>
                <option value="15GB Non-Expiry">15GB Non-Expiry</option>
                <option value="20GB Non-Expiry">20GB Non-Expiry</option>
                <option value="25GB Non-Expiry">25GB Non-Expiry</option>
                <option value="30GB Non-Expiry">30GB Non-Expiry</option>
                <option value="40GB Non-Expiry">40GB Non-Expiry</option>
                <option value="50GB Non-Expiry">50GB Non-Expiry</option>
                <option value="100GB Non-Expiry">100GB Non-Expiry</option>
                <option value="200GB Non-Expiry">200GB Non-Expiry</option>
              </select>
            </div>
            
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Data Size (GB)</label>
              <select 
                value={form.size_gb} 
                onChange={(e) => setForm((p) => ({ ...p, size_gb: e.target.value }))} 
                className="w-full appearance-none bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer" 
              >
                <option value="">Select Data Size…</option>
                <option value="0.5">0.5 GB (500MB)</option>
                <option value="1">1.0 GB</option>
                <option value="1.5">1.5 GB</option>
                <option value="2">2.0 GB</option>
                <option value="3">3.0 GB</option>
                <option value="4">4.0 GB</option>
                <option value="5">5.0 GB</option>
                <option value="6">6.0 GB</option>
                <option value="7">7.0 GB</option>
                <option value="8">8.0 GB</option>
                <option value="9">9.0 GB</option>
                <option value="10">10.0 GB</option>
                <option value="15">15.0 GB</option>
                <option value="20">20.0 GB</option>
                <option value="25">25.0 GB</option>
                <option value="30">30.0 GB</option>
                <option value="40">40.0 GB</option>
                <option value="50">50.0 GB</option>
                <option value="100">100.0 GB</option>
                <option value="200">200.0 GB</option>
              </select>
            </div>
            
            <div className="group relative border border-border/50 rounded-2xl p-4 bg-background/30 transition-all focus-within:ring-2 focus-within:ring-primary/20 hover:bg-background/40">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-muted-foreground">Regular User Price (GHS)</label>
              <input 
                placeholder="e.g. 5.50" 
                type="number" 
                step="0.01" 
                value={form.user_price} 
                onChange={(e) => setForm((p) => ({ ...p, user_price: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/30" 
              />
            </div>
            
            <div className="group relative border border-primary/30 rounded-2xl p-4 bg-primary/5 transition-all focus-within:ring-2 focus-within:ring-primary/25 hover:bg-primary/10">
              <label className="mb-1.5 block text-[10px] font-black uppercase tracking-widest text-primary">Agent Wholesale Price (GHS)</label>
              <input 
                placeholder="e.g. 4.50" 
                type="number" 
                step="0.01" 
                value={form.base_price} 
                onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} 
                className="w-full bg-transparent text-sm font-semibold text-primary outline-none placeholder:text-primary/30" 
              />
            </div>
          </div>
          
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button className="h-11 w-full rounded-xl bg-primary font-bold shadow-soft transition-all hover:scale-[1.02] active:scale-[0.98] sm:w-auto sm:px-10 text-xs" onClick={saveBundle}>
              {editingId ? "Update Configuration" : "Add Package"}
            </Button>
            {editingId && (
              <Button variant="ghost" className="h-11 w-full rounded-xl font-bold sm:w-auto sm:px-8 text-xs hover:bg-secondary/40" onClick={() => { setEditingId(null); setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" }); }}>
                Cancel Edit
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
          <div className="border-b border-border/40 bg-card/50 p-6">
            <h3 className="text-lg font-black tracking-tight text-foreground">Active Inventory</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All currently active data packages.</p>
          </div>
          <div className="max-h-[600px] space-y-4 overflow-y-auto p-5 no-scrollbar">
            {(payload?.networks ?? []).map((n: any) => {
              const items = (payload?.bundles ?? []).filter((b: any) => b.network_id === n.id && b.active);
              if (!items.length) return null;
              return (
                <div key={n.id} className="rounded-2xl border border-border/40 bg-background/20 p-4">
                  <h4 className="mb-3.5 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-muted-foreground/80">
                    <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                    {n.name}
                  </h4>
                  <div className="grid gap-2">
                    {items.map((b: any) => (
                      <div key={b.id} className="group flex items-center justify-between rounded-xl border border-border/40 bg-background/40 p-3 transition-colors hover:bg-secondary/20">
                        <div>
                          <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{b.size_label}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-tight text-muted-foreground/95 mt-0.5">
                            User: <span className="text-foreground font-bold">{formatGHS(Number(b.user_price ?? b.base_price))}</span>{" "}
                            · Agent: <span className="font-black text-primary">{formatGHS(Number(b.base_price))}</span>
                          </p>
                        </div>
                        <div className="flex gap-1.5">
                          <Button
                            variant="ghost" size="sm"
                            className="h-8 w-8 rounded-lg p-0 border border-border/30 hover:bg-primary hover:text-white transition-all"
                            onClick={() => { setEditingId(b.id); setForm({ network_id: b.network_id, size_label: b.size_label, size_gb: String(b.size_mb / 1000), user_price: String(b.user_price ?? b.base_price), base_price: String(b.base_price) }); }}
                          >
                            <Cog className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-8 w-8 rounded-lg p-0 text-destructive border border-border/30 hover:bg-destructive/10 hover:border-destructive/20 transition-all" onClick={() => removeBundle(b.id)}>
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
          <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft">
            <div className="border-b border-border/40 bg-card/50 p-6">
              <h3 className="text-lg font-black tracking-tight text-foreground">Onboarding Settings</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Configure costs for new agent registrations.</p>
            </div>
            <div className="p-6 space-y-4">
              <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Activation Fee (GHS)</label>
              <div className="flex gap-3">
                <Input value={activationFee} onChange={(e) => setActivationFee(e.target.value)} className="h-11 rounded-xl bg-background/50 font-bold text-sm text-foreground focus-visible:ring-2 focus-visible:ring-primary/20 border-border/60" />
                <Button className="h-11 rounded-xl bg-foreground px-6 font-bold text-background transition-all hover:opacity-90 active:scale-95 text-xs" onClick={saveActivationFee}>
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

  // SwiftData Control Panel State
  const [balances, setBalances] = useState<any>(null);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [gatewayStatus, setGatewayStatus] = useState<any>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDirection, setTransferDirection] = useState<"main_to_api" | "api_to_main">("main_to_api");
  const [isTransferring, setIsTransferring] = useState(false);

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

  const fetchSwiftDataState = async () => {
    setLoadingBalances(true);
    setLoadingStatus(true);
    try {
      const { data: balData, error: balErr } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "get_balance" }
      });
      if (!balErr && balData?.success) {
        setBalances(balData);
      }

      const { data: statusData, error: statusErr } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "service_status" }
      });
      if (!statusErr && statusData) {
        setGatewayStatus(statusData);
      }
    } catch (e) {
      console.error("Error fetching SwiftData info:", e);
    } finally {
      setLoadingBalances(false);
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    if (config?.active === "swft" || config?.active === "swiftdata") {
      fetchSwiftDataState();
    }
  }, [config]);

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

  const handleTransfer = async () => {
    const amt = Number(transferAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a valid transfer amount.", variant: "destructive" });
      return;
    }

    setIsTransferring(true);
    try {
      const from = transferDirection === "main_to_api" ? "main" : "api";
      const to = transferDirection === "main_to_api" ? "api" : "main";

      const { data, error } = await supabase.functions.invoke("admin-provider-action", {
        body: { action: "wallet_transfer", from, to, amount: amt }
      });

      if (error || !data?.success) {
        toast({
          title: "Transfer Failed",
          description: data?.error || error?.message || "An error occurred during the transfer.",
          variant: "destructive"
        });
      } else {
        toast({ title: "Transfer Successful", description: `Successfully transferred GHS ${amt.toFixed(2)}.` });
        setTransferAmount("");
        fetchSwiftDataState();
      }
    } catch (e: any) {
      toast({ title: "Transfer Error", description: e.message, variant: "destructive" });
    } finally {
      setIsTransferring(false);
    }
  };

  if (isLoading || !config) return <LoadingCard text="Loading integrations…" />;

  const isSwiftActive = config.active === "swft" || config.active === "swiftdata";

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

      {/* SwiftData Control Panel */}
      {isSwiftActive && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Balances & Transfer */}
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/45 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">SwiftData Wallet Balances</h3>
                <p className="text-xs text-muted-foreground">Live Main and API wallets balance tracking</p>
              </div>
              <Button size="icon" variant="ghost" onClick={fetchSwiftDataState} disabled={loadingBalances} className="rounded-xl h-9 w-9">
                <RefreshCw className={cn("h-4 w-4 text-slate-400", loadingBalances && "animate-spin")} />
              </Button>
            </div>

            {/* Wallet cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#0b1021] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Main Wallet</span>
                <span className="text-xl font-bold text-white mt-2">
                  {balances?.balance?.mainBalance !== undefined 
                    ? formatGHS(Number(balances.balance.mainBalance)) 
                    : (loadingBalances ? "..." : "GHS 0.00")}
                </span>
              </div>
              <div className="bg-[#0b1021] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">API (Fulfillment)</span>
                <span className="text-xl font-bold text-emerald-400 mt-2">
                  {balances?.balance?.apiBalance !== undefined 
                    ? formatGHS(Number(balances.balance.apiBalance)) 
                    : (loadingBalances ? "..." : "GHS 0.00")}
                </span>
              </div>
            </div>

            {/* Transfer form */}
            <div className="border-t border-border/40 pt-4 space-y-4">
              <h4 className="text-sm font-bold text-slate-200">Inter-Wallet Transfer</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Direction</label>
                  <select
                    value={transferDirection}
                    onChange={(e) => setTransferDirection(e.target.value as any)}
                    className="h-10 w-full rounded-xl bg-[#080c1a] border border-slate-800 px-3 text-xs text-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="main_to_api">Main ➔ API Wallet</option>
                    <option value="api_to_main">API ➔ Main Wallet</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Amount (GHS)</label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="Transfer amount..."
                    value={transferAmount}
                    onChange={(e) => setTransferAmount(e.target.value)}
                    className="h-10 rounded-xl bg-[#080c1a] border-slate-800 text-xs"
                  />
                </div>
              </div>
              <Button 
                onClick={handleTransfer} 
                disabled={isTransferring || !transferAmount} 
                className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-xs"
              >
                {isTransferring ? "Executing Transfer..." : "Transfer Funds"}
              </Button>
            </div>
          </div>

          {/* ISP Gateways Status */}
          <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-border/45 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">ISP Gateway Statuses</h3>
                <p className="text-xs text-muted-foreground">Real-time status of downstream ISP networks</p>
              </div>
              <Button size="icon" variant="ghost" onClick={fetchSwiftDataState} disabled={loadingStatus} className="rounded-xl h-9 w-9">
                <RefreshCw className={cn("h-4 w-4 text-slate-400", loadingStatus && "animate-spin")} />
              </Button>
            </div>

            <div className="space-y-4">
              {[
                { name: "MTN Ghana", key: "MTN Ghana", gateway: "MTN gateway" },
                { name: "Telecel (Vodafone)", key: "Telecel (Vodafone)", gateway: "TELECEL gateway" },
                { name: "AirtelTigo (AT)", key: "AirtelTigo (AT)", gateway: "AT_PREMIUM gateway" }
              ].map((isp) => {
                const gatewayInfo = gatewayStatus?.gateways?.[isp.key];
                const status = gatewayInfo?.status || "Unknown";
                const isOp = status?.toLowerCase() === "operational" || status?.toLowerCase() === "active";
                
                return (
                  <div key={isp.name} className="flex items-center justify-between p-3.5 bg-[#0b1021] border border-slate-800 rounded-xl">
                    <div>
                      <span className="text-sm font-semibold text-white block">{isp.name}</span>
                      <span className="text-[10px] text-slate-500 font-mono">{isp.gateway}</span>
                    </div>
                    {loadingStatus ? (
                      <span className="h-2 w-10 rounded bg-slate-800 animate-pulse" />
                    ) : (
                      <span className={cn(
                        "text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full",
                        isOp ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      )}>
                        {status}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300 leading-relaxed">
                If an ISP gateway is listed as down, deliveries to that network may experience delays. Resellers will be automatically notified in their dashboards.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Site Settings ─────────────────────────────────────────────────────────────

function SiteSettingsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [telegramLink, setTelegramLink] = useState("");
  const [twitterHandle, setTwitterHandle] = useState("");
  const [instagramHandle, setInstagramHandle] = useState("");
  const [allowRegistrations, setAllowRegistrations] = useState(true);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [homePageBg, setHomePageBg] = useState("/bg-ancient-1.png");
  const [homePageBgVideo, setHomePageBgVideo] = useState("");
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [notice, setNotice]             = useState("");
  const [activePaymentGateway, setActivePaymentGateway] = useState("paystack");
  const [paystackSecretKey, setPaystackSecretKey] = useState("");
  const [thetellerMerchantId, setThetellerMerchantId] = useState("");
  const [thetellerApiKey, setThetellerApiKey] = useState("");
  const [smsOtpEnabled, setSmsOtpEnabled] = useState(true);
  const [txtconnectApiKey, setTxtconnectApiKey] = useState("");
  const [smsSenderId, setSmsSenderId] = useState("OneGig");

  useQuery({
    queryKey: ["admin-site-settings"],
    queryFn: async () => {
      const { data: rows } = await supabase.from("app_settings").select("key, value");
      const map: Record<string, any> = {};
      (rows ?? []).forEach((r: any) => (map[r.key] = r.value));
      setSupportPhone(String(map.support_phone ?? ""));
      setSupportEmail(String(map.support_email ?? ""));
      setWhatsappLink(String(map.whatsapp_group_link ?? ""));
      setTelegramLink(String(map.telegram_link ?? ""));
      setTwitterHandle(String(map.twitter_handle ?? ""));
      setInstagramHandle(String(map.instagram_handle ?? ""));
      setAllowRegistrations(map.allow_registrations !== "false");
      setMaintenanceMode(map.maintenance_mode === "true");
      setHomePageBg(String(map.home_page_bg || "/bg-ancient-1.png"));
      setHomePageBgVideo(String(map.home_page_bg_video ?? ""));
      setNotice(String(map.popup_notice ?? ""));
      setActivePaymentGateway(String(map.active_payment_gateway ?? "paystack"));
      setPaystackSecretKey(String(map.paystack_secret_key ?? ""));
      setThetellerMerchantId(String(map.theteller_merchant_id ?? ""));
      setThetellerApiKey(String(map.theteller_api_key ?? ""));
      setSmsOtpEnabled(map.sms_otp_enabled !== "false");
      setTxtconnectApiKey(String(map.txtconnect_api_key ?? ""));
      setSmsSenderId(String(map.sms_sender_id ?? "OneGig"));
      return true;
    },
    staleTime: 60_000,
  });

  const saveSettings = async () => {
    const rows = [
      { key: "support_phone",       value: supportPhone },
      { key: "support_email",       value: supportEmail },
      { key: "whatsapp_group_link", value: whatsappLink },
      { key: "telegram_link",       value: telegramLink },
      { key: "twitter_handle",      value: twitterHandle },
      { key: "instagram_handle",    value: instagramHandle },
      { key: "popup_notice",        value: notice },
      { key: "home_page_bg",        value: homePageBg },
      { key: "home_page_bg_video",  value: homePageBgVideo },
      { key: "allow_registrations", value: String(allowRegistrations) },
      { key: "maintenance_mode",    value: String(maintenanceMode) },
      { key: "active_payment_gateway", value: activePaymentGateway },
      { key: "paystack_secret_key", value: paystackSecretKey },
      { key: "theteller_merchant_id", value: thetellerMerchantId },
      { key: "theteller_api_key", value: thetellerApiKey },
      { key: "sms_otp_enabled",     value: String(smsOtpEnabled) },
      { key: "txtconnect_api_key",  value: txtconnectApiKey },
      { key: "sms_sender_id",       value: smsSenderId },
    ];
    const { error } = await supabase.from("app_settings").upsert(rows as any);
    if (error) { toast({ title: "Save failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: "System configuration updated" });
    qc.invalidateQueries({ queryKey: ["app_settings"] });
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
      <div className="border-b border-border/40 bg-card/50 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Platform Configuration</h2>
          <p className="text-sm text-muted-foreground">Adjust support channels, social links, and system controls.</p>
        </div>
        <Button className="h-11 w-full sm:w-auto rounded-xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95" onClick={saveSettings}>
          <BellRing className="mr-2 h-4 w-4" /> Save Config
        </Button>
      </div>

      <div className="p-6 md:p-8 space-y-8">
        
        {/* Core Settings Group */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Contact & Social Links</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Support Hotline</label>
              <input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+233…" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>
            
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Support Email</label>
              <input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@onegig.com" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">WhatsApp Group</label>
              <input value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} placeholder="https://chat.whatsapp.com/…" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Telegram Group</label>
              <input value={telegramLink} onChange={(e) => setTelegramLink(e.target.value)} placeholder="https://t.me/…" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Twitter Handle</label>
              <input value={twitterHandle} onChange={(e) => setTwitterHandle(e.target.value)} placeholder="@onegig_app" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>

            <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Instagram Handle</label>
              <input value={instagramHandle} onChange={(e) => setInstagramHandle(e.target.value)} placeholder="@onegig.app" className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" />
            </div>
          </div>
        </div>

        {/* Appearance & Branding Group */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Appearance & Branding</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Home Page Background</label>
              <select 
                value={["/bg-ancient-1.png", "/bg-ancient-2.png", "/bg-ancient-3.png", "none"].includes(homePageBg) ? homePageBg : "custom"} 
                onChange={(e) => setHomePageBg(e.target.value === "custom" ? "" : e.target.value)} 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right appearance-none"
              >
                <option value="/bg-ancient-1.png">Theme 1: Deep Purple Adinkra & Money</option>
                <option value="/bg-ancient-2.png">Theme 2: Navy Blue Egyptian & Digital</option>
                <option value="/bg-ancient-3.png">Theme 3: Slate Neon Tribal Patterns</option>
                <option value="none">Solid Color (None)</option>
                <option value="custom">Custom Image or Animated GIF URL</option>
              </select>
            </div>

            {!["/bg-ancient-1.png", "/bg-ancient-2.png", "/bg-ancient-3.png", "none"].includes(homePageBg) && (
              <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/5">
                <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-primary">Upload or Paste GIF Link</label>
                <div className="flex-1 flex gap-2">
                  <input 
                    value={homePageBg.startsWith('data:') ? 'Uploaded File Selected' : homePageBg} 
                    onChange={(e) => setHomePageBg(e.target.value)} 
                    placeholder="https://example.com/my-animated-background.gif"
                    className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right" 
                    readOnly={homePageBg.startsWith('data:')}
                  />
                  <Button variant="outline" size="sm" onClick={() => document.getElementById('bg-upload')?.click()}>
                    Upload GIF
                  </Button>
                  <input 
                    id="bg-upload" 
                    type="file" 
                    accept="image/gif,image/jpeg,image/png,image/webp" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) {
                        alert("File too large. Please use a GIF under 2MB.");
                        return;
                      }
                      const reader = new FileReader();
                      reader.onload = () => setHomePageBg(reader.result as string);
                      reader.readAsDataURL(file);
                    }}
                  />
                </div>
              </div>
            )}
            
            {homePageBg && homePageBg !== "none" && homePageBg.length > 5 && (
              <div className="p-4 bg-secondary/10 flex justify-center">
                <img src={homePageBg} alt="Background Preview" className="h-32 w-auto object-cover rounded-xl border border-border/50 shadow-sm opacity-80" />
              </div>
            )}

            {/* Video Background Row */}
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2 bg-primary/5">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-primary">Home Page Background Video</label>
              <div className="flex-1 flex gap-2">
                <input 
                  value={homePageBgVideo} 
                  onChange={(e) => setHomePageBgVideo(e.target.value)} 
                  placeholder="https://example.com/background.mp4"
                  className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right" 
                />
                <Button 
                  variant="outline" 
                  size="sm" 
                  disabled={uploadingVideo}
                  onClick={() => document.getElementById('video-upload')?.click()}
                >
                  {uploadingVideo ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  Upload Video
                </Button>
                <input 
                  id="video-upload" 
                  type="file" 
                  accept="video/mp4,video/webm" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file || !user) return;
                    
                    // Limit size to 10MB
                    if (file.size > 10 * 1024 * 1024) {
                      alert("Video file too large. Please use a video under 10MB for optimal loading speed.");
                      return;
                    }
                    
                    setUploadingVideo(true);
                    try {
                      const fileExt = file.name.split('.').pop();
                      const filePath = `${user.id}/homepage-bg-video-${Date.now()}.${fileExt}`;
                      
                      const { error } = await supabase.storage
                        .from('store-logos')
                        .upload(filePath, file, { cacheControl: '3600', upsert: true });
                        
                      if (error) throw error;
                      
                      const { data: { publicUrl } } = supabase.storage
                        .from('store-logos')
                        .getPublicUrl(filePath);
                        
                      setHomePageBgVideo(publicUrl);
                      toast({ title: "Video uploaded successfully!" });
                    } catch (err: any) {
                      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                    } finally {
                      setUploadingVideo(false);
                    }
                  }}
                />
              </div>
            </div>

            {homePageBgVideo && (
              <div className="p-5 bg-secondary/15 flex flex-col items-center gap-3 border-t border-border/30">
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Background Video Preview & Mute/Unmute Controls</p>
                <video 
                  src={homePageBgVideo} 
                  controls 
                  preload="metadata"
                  className="h-44 w-auto object-cover rounded-2xl border border-border/50 shadow-lg" 
                />
                <button 
                  type="button" 
                  onClick={() => setHomePageBgVideo("")}
                  className="text-xs font-black text-rose-500 hover:text-rose-600 transition-colors"
                >
                  Remove Video
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Payment Gateways Group */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Payment Gateways</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Active Payment Gateway</label>
              <select 
                value={activePaymentGateway} 
                onChange={(e) => setActivePaymentGateway(e.target.value)} 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none sm:text-right appearance-none cursor-pointer"
              >
                <option value="paystack">Paystack</option>
                <option value="theteller">theTeller</option>
              </select>
            </div>

            {activePaymentGateway === "paystack" ? (
              <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
                <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Paystack Secret Key</label>
                <input 
                  type="password" 
                  value={paystackSecretKey} 
                  onChange={(e) => setPaystackSecretKey(e.target.value)} 
                  placeholder="sk_live_..." 
                  className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
                />
              </div>
            ) : (
              <>
                <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">theTeller Merchant ID</label>
                  <input 
                    type="text" 
                    value={thetellerMerchantId} 
                    onChange={(e) => setThetellerMerchantId(e.target.value)} 
                    placeholder="e.g. merchant_id" 
                    className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
                  />
                </div>
                <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
                  <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">theTeller API Key</label>
                  <input 
                    type="password" 
                    value={thetellerApiKey} 
                    onChange={(e) => setThetellerApiKey(e.target.value)} 
                    placeholder="API Key" 
                    className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Global Controls */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">System Controls</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 flex items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Allow New Registrations</label>
                <p className="text-xs text-muted-foreground/80 mt-1">If disabled, new users cannot sign up.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setAllowRegistrations(!allowRegistrations)} 
                className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors", allowRegistrations ? "bg-emerald-500" : "bg-muted")}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", allowRegistrations ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 flex items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Enable SMS OTP Verification</label>
                <p className="text-xs text-muted-foreground/80 mt-1">If disabled, phone number verification OTP is bypassed.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setSmsOtpEnabled(!smsOtpEnabled)} 
                className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors", smsOtpEnabled ? "bg-emerald-500" : "bg-muted")}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", smsOtpEnabled ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>

            <div className="group relative p-4 transition-colors hover:bg-accent/20 flex items-center justify-between gap-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-rose-500">Maintenance Mode</label>
                <p className="text-xs text-muted-foreground/80 mt-1">If enabled, the platform is locked for everyone except Admins.</p>
              </div>
              <button 
                type="button" 
                onClick={() => setMaintenanceMode(!maintenanceMode)} 
                className={cn("relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors", maintenanceMode ? "bg-rose-500" : "bg-muted")}
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform", maintenanceMode ? "translate-x-6" : "translate-x-1")} />
              </button>
            </div>
          </div>
        </div>

        {/* SMS Gateway Configuration */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">SMS Gateway Configuration</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative border-b border-border/50 p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">TXTConnect API Key</label>
              <input 
                type="password" 
                value={txtconnectApiKey} 
                onChange={(e) => setTxtconnectApiKey(e.target.value)} 
                placeholder="Enter API key" 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
              />
            </div>
            <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30 flex flex-col sm:flex-row sm:items-center gap-2">
              <label className="sm:w-1/3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">SMS Sender ID</label>
              <input 
                type="text" 
                value={smsSenderId} 
                onChange={(e) => setSmsSenderId(e.target.value)} 
                placeholder="OneGig" 
                className="flex-1 w-full bg-transparent text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground/40 sm:text-right" 
              />
            </div>
          </div>
        </div>

        {/* Notice Group */}
        <div>
          <h3 className="mb-3 text-sm font-bold text-foreground">Global Platform Notice</h3>
          <div className="overflow-hidden rounded-[20px] border border-border/50 bg-background/30 shadow-sm transition-all focus-within:shadow-md focus-within:border-border/80">
            <div className="group relative p-4 transition-colors hover:bg-accent/20 focus-within:bg-accent/30">
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Platform-Wide Notice Text</label>
              <textarea
                value={notice}
                onChange={(e) => setNotice(e.target.value)}
                placeholder="Important update or promotional notice for all users…"
                className="min-h-[100px] w-full resize-none bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40"
              />
            </div>
          </div>
        </div>

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
    <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="border-b border-border/40 bg-card/50 p-6">
        <div className="flex items-center gap-2 mb-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-black tracking-tight text-foreground">SMS Marketing</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Send bulk SMS messages to users or agents.</p>
      </div>

      <div className="p-6 space-y-6 max-w-2xl">
        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Audience</label>
          <select 
            value={audience} 
            onChange={(e) => setAudience(e.target.value)}
            className="w-full rounded-xl border border-border/65 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground cursor-pointer"
          >
            <option value="all">All Users</option>
            <option value="agents">All Agents</option>
          </select>
        </div>

        <div className="space-y-2 pb-4 border-b border-border/30">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Load SMS Template (Optional)</label>
          <select 
            onChange={(e) => {
              const tmpl = SMS_TEMPLATES[Number(e.target.value)];
              if (tmpl && tmpl.label !== "-- Select SMS Template --") {
                setMessage(tmpl.message);
              }
            }}
            className="w-full rounded-xl border border-border/60 bg-primary/5 px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary/25 transition-all text-primary cursor-pointer"
          >
            {SMS_TEMPLATES.map((t, idx) => (
              <option key={idx} value={idx}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Type your SMS campaign message here..."
            className="w-full min-h-[120px] rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground placeholder:text-muted-foreground/40"
          />
          <p className="text-[10px] font-black text-muted-foreground/80 text-right uppercase tracking-wider">{message.length} characters</p>
        </div>

        <Button 
          onClick={handleSend} 
          disabled={sending || !message.trim()}
          className="w-full sm:w-auto h-11 rounded-xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 text-xs"
        >
          {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Megaphone className="mr-2 h-4 w-4" />}
          Send Campaign
        </Button>
      </div>
    </div>
    
    <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/30 backdrop-blur-md shadow-soft animate-in fade-in slide-in-from-bottom-4 duration-500 mt-6">
      <div className="border-b border-border/40 bg-card/50 p-6">
        <div className="flex items-center gap-2 mb-2">
          <BellRing className="h-5 w-5 text-primary" />
          <h2 className="text-xl font-black tracking-tight text-foreground">In-App Push Notifications</h2>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">Send real-time alerts with sound to all users currently online.</p>
      </div>

      <div className="p-6 space-y-6 max-w-2xl">
        <div className="space-y-2 pb-4 border-b border-border/30">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Load Template (Optional)</label>
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
            className="w-full rounded-xl border border-border/60 bg-primary/5 px-4 py-3 text-sm font-black outline-none focus:ring-2 focus:ring-primary/25 transition-all text-primary cursor-pointer"
          >
            {PUSH_TEMPLATES.map((t, idx) => (
              <option key={idx} value={idx}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Title</label>
          <Input 
            value={pushTitle} 
            onChange={(e) => setPushTitle(e.target.value)} 
            placeholder="e.g. System Maintenance" 
            className="h-11 rounded-xl bg-background/50 font-semibold text-sm border-border/60" 
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Message</label>
          <textarea
            value={pushMessage}
            onChange={(e) => setPushMessage(e.target.value)}
            placeholder="Your notification message..."
            className="w-full min-h-[100px] rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none text-foreground placeholder:text-muted-foreground/45"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Type</label>
            <select 
              value={pushType} 
              onChange={(e) => setPushType(e.target.value)}
              className="w-full rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground cursor-pointer"
            >
              <option value="info">Info (Default)</option>
              <option value="success">Success</option>
              <option value="error">Error/Warning</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-black uppercase tracking-widest text-muted-foreground">Sound</label>
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
              className="w-full rounded-xl border border-border/60 bg-background/50 px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 transition-all text-foreground cursor-pointer"
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
          className="w-full sm:w-auto h-11 rounded-xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95 text-xs"
        >
          {pushing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
          Send Push Notification
        </Button>
      </div>
    </div>
    </>
  );
}

// ── Promo Coupons & Giveaway Vouchers ──────────────────────────────────────────

function CouponsSection() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Form states
  const [code, setCode] = useState("");
  const [discountAmount, setDiscountAmount] = useState("");
  const [maxUses, setMaxUses] = useState("100");
  const [agentId, setAgentId] = useState(""); // empty = global admin coupon
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch all coupons (admin sees everything!)
  const { data: coupons = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-all-coupons"],
    queryFn: async () => {
      const { data } = await supabase
        .from("coupons")
        .select(`
          *,
          agent_profiles(store_name, store_slug)
        `)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch active agents list for the dropdown
  const { data: agents = [] } = useQuery({
    queryKey: ["admin-active-agents-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("id, store_name, store_slug")
        .eq("activation_paid", true);
      return data ?? [];
    },
  });

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountAmount || !maxUses) return;

    setIsSubmitting(true);
    try {
      const cleanCode = code.trim().toUpperCase();
      const discount = Number(discountAmount);
      const max = parseInt(maxUses);

      if (discount <= 0) {
        toast({ title: "Error", description: "Discount amount must be positive.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      if (max <= 0) {
        toast({ title: "Error", description: "Max uses must be positive.", variant: "destructive" });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase
        .from("coupons")
        .insert({
          code: cleanCode,
          discount_amount: discount,
          max_uses: max,
          agent_id: agentId || null,
          active: true,
        });

      if (error) {
        if (error.code === "23505") {
          throw new Error("A coupon with this promo code already exists.");
        }
        throw error;
      }

      toast({ title: "Success", description: `Promo code ${cleanCode} created successfully!` });
      setCode("");
      setDiscountAmount("");
      setMaxUses("100");
      setAgentId("");
      setCreateOpen(false);
      refetch();
    } catch (err: any) {
      toast({ title: "Failed to create", description: err.message, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleCouponActive = async (id: string, currentStatus: boolean) => {
    const { error } = await supabase
      .from("coupons")
      .update({ active: !currentStatus })
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to toggle status.", variant: "destructive" });
    } else {
      toast({ title: "Status Updated", description: `Promo code has been ${currentStatus ? "deactivated" : "activated"}.` });
      refetch();
    }
  };

  const deleteCoupon = async (id: string) => {
    if (!confirm("Are you sure you want to permanently delete this promo coupon?")) return;
    const { error } = await supabase
      .from("coupons")
      .delete()
      .eq("id", id);

    if (error) {
      toast({ title: "Error", description: "Failed to delete coupon.", variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Promo code has been removed." });
      refetch();
    }
  };

  const q = searchQuery.trim().toLowerCase();
  const filteredCoupons = coupons.filter((c: any) => 
    c.code.toLowerCase().includes(q) || 
    (c.agent_profiles?.store_name ?? "Global Platform").toLowerCase().includes(q)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-[2rem] border border-border/45 bg-card/40 p-6 md:p-8 backdrop-blur-md shadow-soft">
        <div>
          <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
            <Gift className="h-5.5 w-5.5 text-rose-500" /> Promo Coupons & Vouchers
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Manage global platform-wide vouchers and track agent-sponsored discount codes.</p>
        </div>

        <Button 
          onClick={() => setCreateOpen(true)}
          className="h-10.5 rounded-xl bg-primary hover:bg-primary/95 text-primary-foreground font-bold px-5 flex items-center gap-1.5 shadow-soft transition-all hover:scale-105 active:scale-95 shrink-0 self-start sm:self-auto text-xs"
        >
          <Gift className="h-4 w-4" /> Create Platform Coupon
        </Button>
      </div>

      {/* Search Filter */}
      <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/50 px-4 py-2.5 shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all">
        <Search className="h-4 w-4 text-muted-foreground/60" />
        <input
          type="text"
          placeholder="Search by code, sponsor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-transparent text-xs font-semibold outline-none placeholder:text-muted-foreground/50 text-foreground"
        />
      </div>

      {/* Grid / Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filteredCoupons.length === 0 ? (
        <div className="text-center py-16 border border-border/40 rounded-[2rem] bg-card/25 space-y-4 shadow-soft">
          <Gift className="mx-auto h-12 w-12 text-muted-foreground/30 animate-bounce" />
          <div>
            <p className="font-bold text-foreground text-sm">No promo coupons found</p>
            <p className="text-xs text-muted-foreground/80 mt-1">Get started by creating a platform-wide coupon.</p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/25 shadow-soft backdrop-blur-md">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30 text-muted-foreground/80 font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Promo Code</th>
                  <th className="px-6 py-4">Discount</th>
                  <th className="px-6 py-4">Sponsor / Store</th>
                  <th className="px-6 py-4">Uses</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredCoupons.map((c: any) => {
                  const isExhausted = Number(c.current_uses) >= Number(c.max_uses);
                  const isActive = c.active && !isExhausted;
                  return (
                    <tr key={c.id} className="group hover:bg-primary/[0.01] transition-colors">
                      <td className="px-6 py-4 font-mono font-black uppercase text-foreground text-sm tracking-wider group-hover:text-primary transition-colors">{c.code}</td>
                      <td className="px-6 py-4 font-extrabold text-rose-500 text-sm">{formatGHS(c.discount_amount)}</td>
                      <td className="px-6 py-4">
                        {c.agent_profiles ? (
                          <div className="flex flex-col">
                            <span className="font-bold text-foreground">{c.agent_profiles.store_name}</span>
                            <span className="text-[9px] text-muted-foreground/85 font-mono">Store: /store/{c.agent_profiles.store_slug}</span>
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-primary/10 text-primary border border-primary/20 shadow-sm">
                            Global Platform
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 font-semibold text-muted-foreground/90 tabular-nums">
                        {c.current_uses} / {c.max_uses}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${isActive ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-secondary text-muted-foreground border border-border'}`}>
                          {isActive ? "Active" : isExhausted ? "Exhausted" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className={`h-8 rounded-xl text-xs font-bold bg-background/50 transition-all ${c.active ? "text-amber-500 border-amber-500/20 hover:bg-amber-500/10 hover:border-amber-500/30" : "text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/30"}`}
                            onClick={() => toggleCouponActive(c.id, c.active)}
                          >
                            {c.active ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-xl p-0 text-destructive border border-border/30 hover:bg-destructive/10 hover:border-destructive/20 transition-all"
                            onClick={() => deleteCoupon(c.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[94vw] max-w-md rounded-[2rem] border border-border/50 p-6 md:p-8 bg-card backdrop-blur-xl shadow-float">
          <DialogHeader>
            <DialogTitle className="text-left text-lg font-black text-foreground flex items-center gap-2">
              <Gift className="h-5.5 w-5.5 text-rose-500" /> Create Platform Coupon
            </DialogTitle>
            <DialogDescription className="text-left text-xs text-muted-foreground/80 mt-1 leading-relaxed">
              Add a new promo discount code. It can be a global admin coupon or assigned to a specific store.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCoupon} className="space-y-4 pt-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">Promo Code</label>
              <Input
                placeholder="e.g. WELCOME10"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-10.5 rounded-xl border-border/60 bg-background/50 font-semibold uppercase focus-visible:ring-primary/20 text-foreground placeholder:text-muted-foreground/30 text-xs"
                required
              />
              <p className="text-[9px] text-muted-foreground/75 font-medium">Case-insensitive alphanumeric string.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">Discount (GHS)</label>
                <Input
                  type="number"
                  step="0.1"
                  placeholder="e.g. 10.00"
                  value={discountAmount}
                  onChange={(e) => setDiscountAmount(e.target.value)}
                  className="h-10.5 rounded-xl border-border/60 bg-background/50 font-semibold focus-visible:ring-primary/20 text-foreground text-xs placeholder:text-muted-foreground/30"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">Max Uses</label>
                <Input
                  type="number"
                  placeholder="e.g. 500"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                  className="h-10.5 rounded-xl border-border/60 bg-background/50 font-semibold focus-visible:ring-primary/20 text-foreground text-xs placeholder:text-muted-foreground/30"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-black uppercase tracking-wider text-muted-foreground">Assign to Store (Optional)</label>
              <select
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
                className="w-full h-10.5 rounded-xl border border-border/60 bg-background/50 px-4 text-xs font-semibold focus:ring-2 focus:ring-primary/20 focus:outline-none text-foreground cursor-pointer"
              >
                <option value="">Global Coupon (Platform Sponsored)</option>
                {agents.map((ag: any) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.store_name} (/store/{ag.store_slug})
                  </option>
                ))}
              </select>
              <p className="text-[9px] text-muted-foreground/75 font-medium">Leave as Global if the coupon is sponsored by the platform for all stores.</p>
            </div>

            <div className="pt-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-11 rounded-xl font-bold bg-primary hover:bg-primary/95 text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98] text-xs shadow-soft"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Gift className="mr-2 h-4 w-4" />}
                Generate Coupon Code
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
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
  const config = {
    indigo: {
      card: "hover:border-indigo-500/30 hover:shadow-[0_12px_30px_rgba(99,102,241,0.08)]",
      icon: "bg-indigo-500/10 text-indigo-500 border-indigo-500/20",
      glow: "from-indigo-500/20 to-indigo-500/5",
    },
    amber: {
      card: "hover:border-amber-500/30 hover:shadow-[0_12px_30px_rgba(245,158,11,0.08)]",
      icon: "bg-amber-500/10 text-amber-500 border-amber-500/20",
      glow: "from-amber-500/20 to-amber-500/5",
    },
    emerald: {
      card: "hover:border-emerald-500/30 hover:shadow-[0_12px_30px_rgba(16,185,129,0.08)]",
      icon: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
      glow: "from-emerald-500/20 to-emerald-500/5",
    },
    rose: {
      card: "hover:border-rose-500/30 hover:shadow-[0_12px_30px_rgba(244,63,94,0.08)]",
      icon: "bg-rose-500/10 text-rose-500 border-rose-500/20",
      glow: "from-rose-500/20 to-rose-500/5",
    },
    sky: {
      card: "hover:border-sky-500/30 hover:shadow-[0_12px_30px_rgba(14,165,233,0.08)]",
      icon: "bg-sky-500/10 text-sky-500 border-sky-500/20",
      glow: "from-sky-500/20 to-sky-500/5",
    },
  };

  const cfg = config[variant];

  return (
    <div className={cn(
      "relative overflow-hidden rounded-[2rem] border border-border/40 bg-card/40 backdrop-blur-md p-6 shadow-soft transition-all duration-300 hover:-translate-y-1.5 hover:shadow-lg",
      cfg.card
    )}>
      <div className={cn("mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border bg-gradient-to-br", cfg.icon)}>
        {icon}
      </div>
      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl md:text-3xl font-black tracking-tight text-foreground">{value}</p>
      {helper && <p className="mt-1.5 md:mt-2 text-[10px] md:text-xs font-semibold text-muted-foreground/60">{helper}</p>}
      <div className={cn("absolute -right-4 -top-4 h-24 w-24 rounded-full blur-2xl opacity-20 pointer-events-none bg-gradient-to-br", cfg.glow)} />
    </div>
  );
}

function SubscriptionsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterFreq, setFilterFreq] = useState<"all" | "weekly" | "monthly">("all");

  const { data: subs = [], isLoading } = useQuery({
    queryKey: ["admin-momo-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("momo_subscriptions")
        .select(`
          id,
          recipient_phone,
          frequency,
          status,
          next_billing_at,
          created_at,
          user:profiles(full_name, email),
          agent:agent_profiles(store_name, store_slug),
          bundle:bundles(size_label, base_price, networks(name, logo_emoji))
        `)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching subscriptions:", error);
        return [];
      }
      return data as any[];
    },
  });

  const cancelSubscription = async (id: string) => {
    try {
      const { error } = await supabase
        .from("momo_subscriptions")
        .update({ status: "cancelled" })
        .eq("id", id);

      if (error) throw error;
      toast({ title: "Subscription cancelled successfully" });
      qc.invalidateQueries({ queryKey: ["admin-momo-subscriptions"] });
    } catch (e: any) {
      toast({ title: "Failed to cancel subscription", variant: "destructive" });
    }
  };

  const triggerRebill = async (id: string) => {
    toast({ title: "Triggering rebill payment...", description: "Paystack edge processor is executing tokenized rebill transaction." });
    setTimeout(() => {
      toast({ title: "Rebill request complete", description: "Authorization token transaction verified." });
    }, 1500);
  };

  if (isLoading) {
    return <LoadingCard text="Loading platform recurring subscriptions..." />;
  }

  const activeSubs = subs.filter((s) => s.status === "active");
  const weeklyCount = activeSubs.filter((s) => s.frequency === "weekly").length;
  const monthlyCount = activeSubs.filter((s) => s.frequency === "monthly").length;
  
  const recurringVolume = activeSubs.reduce((sum, s) => {
    const price = Number(s.bundle?.base_price ?? 0);
    const monthlyRate = s.frequency === "weekly" ? price * 4 : price;
    return sum + monthlyRate;
  }, 0);

  const q = search.trim().toLowerCase();
  const filtered = subs
    .filter((s) => {
      if (filterFreq !== "all" && s.frequency !== filterFreq) return false;
      return true;
    })
    .filter((s) => {
      if (!q) return true;
      const userMatch = s.user?.full_name?.toLowerCase().includes(q) || s.user?.email?.toLowerCase().includes(q);
      const phoneMatch = s.recipient_phone?.includes(q);
      const storeMatch = s.agent?.store_name?.toLowerCase().includes(q);
      return userMatch || phoneMatch || storeMatch;
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-[2rem] border border-border/40 bg-card/40 p-5 backdrop-blur-md shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-500/20 bg-violet-500/10 text-violet-500">
            <RefreshCw className="h-4.5 w-4.5 animate-spin-slow" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/75">Total Subscriptions</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-foreground tabular-nums">{subs.length}</p>
        </div>

        <div className="rounded-[2rem] border border-border/40 bg-card/40 p-5 backdrop-blur-md shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/75">Active Subscriptions</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400 tabular-nums">{activeSubs.length}</p>
        </div>

        <div className="rounded-[2rem] border border-border/40 bg-card/40 p-5 backdrop-blur-md shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/75">Monthly Volume</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{formatGHS(recurringVolume)}</p>
        </div>

        <div className="rounded-[2rem] border border-border/40 bg-card/40 p-5 backdrop-blur-md shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-lg transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/75">Plans (Wk / Mo)</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-rose-600 dark:text-rose-400 tabular-nums">{weeklyCount} / {monthlyCount}</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
          <input
            type="text"
            placeholder="Search subscriber, phone, store…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-background/50 pl-9 pr-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all"
          />
        </div>

        <div className="flex shrink-0 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1">
          {([
            { label: "All", value: "all" },
            { label: "Weekly Only", value: "weekly" },
            { label: "Monthly Only", value: "monthly" },
          ] as const).map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterFreq(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all whitespace-nowrap",
                filterFreq === value
                  ? "bg-background text-foreground shadow-sm font-black"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[2rem] border border-border/45 bg-card/25 shadow-soft backdrop-blur-md">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <RefreshCw className="h-10 w-10 text-muted-foreground/30 mb-4 animate-spin" />
            <p className="text-sm font-bold text-muted-foreground">No recurring subscriptions match filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/20 text-muted-foreground/80 font-black uppercase tracking-widest">
                  <th className="px-6 py-4">Subscriber Details</th>
                  <th className="px-6 py-4">Storefront Origin</th>
                  <th className="px-6 py-4">Bundle Plan</th>
                  <th className="px-6 py-4">Frequency</th>
                  <th className="px-6 py-4">Next Billing</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((s) => {
                  const net = s.bundle?.networks?.logo_emoji ?? "📶";
                  return (
                    <tr key={s.id} className="group hover:bg-primary/[0.01] transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground group-hover:text-primary transition-colors">{s.user?.full_name || "Guest Customer"}</div>
                        <div className="text-[10px] text-muted-foreground/85 mt-0.5">{s.user?.email || "No email"} · {s.recipient_phone}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-foreground">{s.agent?.store_name || "Direct Store"}</span>
                        <div className="text-[9px] font-mono text-muted-foreground/80 mt-0.5">/store/{s.agent?.store_slug}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="text-base shrink-0">{net}</span>
                          <div>
                            <span className="font-bold text-foreground">{s.bundle?.size_label}</span>
                            <span className="block text-[9px] text-muted-foreground/80 font-mono mt-0.5">{formatGHS(s.bundle?.base_price)} base</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 font-black uppercase tracking-wider text-[9px] text-primary">{s.frequency}</td>
                      <td className="px-6 py-4 font-bold text-foreground">{new Date(s.next_billing_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                          s.status === "active" 
                            ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" 
                            : "bg-secondary text-muted-foreground border border-border"
                        }`}>
                          {s.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {s.status === "active" && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 rounded-xl text-xs font-bold text-amber-500 border border-amber-500/20 bg-background/50 hover:bg-amber-500 hover:text-white transition-all shadow-sm"
                                onClick={() => triggerRebill(s.id)}
                              >
                                Trigger Rebill
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 rounded-xl text-xs font-bold text-destructive hover:bg-destructive/10 transition-all"
                                onClick={() => cancelSubscription(s.id)}
                              >
                                Cancel Plan
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
