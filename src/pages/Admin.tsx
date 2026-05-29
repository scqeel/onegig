import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCircle2, Clock, Cog, DollarSign, Loader2, Package, RefreshCw, RotateCcw, Search, Settings, ShoppingCart, Trash2, TrendingUp, UserCog, Users, XCircle } from "lucide-react";
import { formatGB } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

type Tab = "overview" | "users" | "orders" | "withdrawals" | "pricing" | "integrations" | "settings";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
};

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const loc = useLocation();

  const sidebarItems = [
    { label: "Overview", value: "overview", icon: <Users className="h-4 w-4" /> },
    { label: "Users", value: "users", icon: <UserCog className="h-4 w-4" /> },
    { label: "Orders", value: "orders", icon: <ShoppingCart className="h-4 w-4" /> },
    { label: "Withdrawals", value: "withdrawals", icon: <DollarSign className="h-4 w-4" /> },
    { label: "Pricing", value: "pricing", icon: <Cog className="h-4 w-4" /> },
    { label: "Integrations", value: "integrations", icon: <Package className="h-4 w-4" /> },
    { label: "Site Settings", value: "settings", icon: <Settings className="h-4 w-4" /> },
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
        <a href="/dashboard" className="flex items-center gap-2 rounded-xl border border-border/40 bg-card/50 px-4 py-2 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground">
          <RefreshCw className="h-3 w-3" />
          Back to Dashboard
        </a>
      }
    >
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
        {tab === "overview" && <OverviewSection />}
        {tab === "users" && <UsersSection />}
        {tab === "orders" && <OrdersSection />}
        {tab === "withdrawals" && <WithdrawalsSection />}
        { tab === "pricing" && <PricingSection /> }
        { tab === "integrations" && <IntegrationsSection /> }
        { tab === "settings" && <SiteSettingsSection /> }
      </div>
    </DashboardLayout>
  );
}

function AdminTab({
  label,
  value,
  tab,
  setTab,
}: {
  label: string;
  value: Tab;
  tab: Tab;
  setTab: (v: Tab) => void;
}) {
  return (
    <button
      onClick={() => setTab(value)}
      className={[
        "w-full rounded-xl px-4 py-2.5 text-left text-sm font-medium transition-colors",
        tab === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function OverviewSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const [profilesRes, agentsRes, ordersRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "agent"),
        supabase.from("orders").select("id, sell_price, created_at"),
      ]);

      const totalUsers = profilesRes.count ?? 0;
      const totalAgents = agentsRes.count ?? 0;
      const orders = ordersRes.data ?? [];
      const totalOrders = orders.length;
      const revenue = orders.reduce((sum, o: any) => sum + Number(o.sell_price ?? 0), 0);

      const last30 = new Date();
      last30.setDate(last30.getDate() - 30);
      const revenue30d = orders
        .filter((o: any) => new Date(o.created_at) >= last30)
        .reduce((sum, o: any) => sum + Number(o.sell_price ?? 0), 0);

      return { totalUsers, totalAgents, totalOrders, revenue, revenue30d };
    },
  });

  if (isLoading) return <LoadingCard text="Gathering platform metrics..." />;

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Metric 
        title="Total Users" 
        value={String(data?.totalUsers ?? 0)} 
        icon={<Users className="h-5 w-5" />} 
        variant="indigo"
      />
      <Metric 
        title="Active Agents" 
        value={String(data?.totalAgents ?? 0)} 
        icon={<UserCog className="h-5 w-5" />} 
        variant="amber"
      />
      <Metric 
        title="Total Orders" 
        value={String(data?.totalOrders ?? 0)} 
        icon={<ShoppingCart className="h-5 w-5" />} 
        variant="emerald"
      />
      <Metric 
        title="Total Revenue" 
        value={formatGHS(data?.revenue ?? 0)} 
        icon={<DollarSign className="h-5 w-5" />} 
        helper={`30d Growth: ${formatGHS(data?.revenue30d ?? 0)}`}
        variant="rose"
      />
    </div>
  );
}

function UsersSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

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
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "User deleted successfully" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const makeAgent = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-convert-agent", { body: { user_id: userId } });
    setBusyId(null);
    if (error) {
      toast({ title: "Conversion failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Account promoted to agent" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  const makeAdmin = async (userId: string) => {
    setBusyId(userId);
    const { error } = await supabase.functions.invoke("admin-make-admin", { body: { user_id: userId } });
    setBusyId(null);
    if (error) {
      toast({ title: "Conversion failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Account promoted to admin!" });
    qc.invalidateQueries({ queryKey: ["admin-users"] });
    qc.invalidateQueries({ queryKey: ["admin-overview"] });
  };

  if (isLoading) return <LoadingCard text="Indexing user database..." />;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
      <div className="flex items-center justify-between border-b border-border/40 bg-card/50 p-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Platform Users</h2>
          <p className="text-sm text-muted-foreground">Manage accounts and permissions across the system.</p>
        </div>
        <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          {data?.length || 0} Registered
        </div>
      </div>
      <div className="divide-y divide-border/40">
        {data?.map((u: any) => (
          <div key={u.id} className="group flex flex-col gap-4 p-6 transition-colors hover:bg-accent/20 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <p className="text-base font-semibold leading-tight">{u.full_name || u.username || "Anonymous User"}</p>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted-foreground">
                  <span>{u.email || "No email linked"}</span>
                  <span className="hidden opacity-40 md:block">•</span>
                  <span>{u.phone || "No phone"}</span>
                </div>
                <div className="mt-2 flex gap-1.5">
                  {u.roles.map((r: string) => (
                    <span key={r} className="rounded-lg bg-accent/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {r}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {!u.roles.includes("agent") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-border/60 bg-background/50 hover:bg-primary hover:text-primary-foreground"
                  disabled={busyId === u.id}
                  onClick={() => makeAgent(u.id)}
                >
                  {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><UserCog className="mr-1.5 h-3.5 w-3.5" />Make Agent</>}
                </Button>
              )}
              {!u.roles.includes("admin") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl border-border/60 bg-background/50 hover:bg-emerald-500 hover:text-white"
                  disabled={busyId === u.id}
                  onClick={() => makeAdmin(u.id)}
                >
                  {busyId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <><ShieldCheck className="mr-1.5 h-3.5 w-3.5" />Make Admin</>}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-9 rounded-xl text-destructive transition-all hover:bg-destructive/10 hover:text-destructive"
                disabled={busyId === u.id}
                onClick={() => removeUser(u.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
      {!data?.length && <div className="p-12 text-center text-muted-foreground">No users found in database.</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    delivered:  { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Delivered"  },
    paid:       { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Paid"       },
    approved:   { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Approved"   },
    pending:    { bg: "bg-amber-500/10  text-amber-600  border-amber-500/20",  dot: "bg-amber-500",  label: "Pending"    },
    processing: { bg: "bg-sky-500/10   text-sky-600   border-sky-500/20",    dot: "bg-sky-500",    label: "Processing" },
    failed:     { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20",   dot: "bg-rose-500",   label: "Failed"     },
    rejected:   { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20",   dot: "bg-rose-500",   label: "Rejected"   },
  };
  const cfg = map[status] ?? { bg: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", label: status };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function OrdersSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [retryId, setRetryId]         = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]           = useState("");

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

  const retryOrder = async (order: any) => {
    if (!order.bundle_id || !order.recipient_phone) return;
    setRetryId(order.id);
    const { error } = await supabase.functions.invoke("place-order", {
      body: { recipient_phone: order.recipient_phone, bundle_id: order.bundle_id, force_provider: "swft", retry_order_id: order.id },
    });
    setRetryId(null);
    if (error) {
      toast({ title: "Retry failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Order retried", description: "Fulfillment attempt initiated." });
    qc.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  if (isLoading) return <LoadingCard text="Loading orders..." />;

  const orders = data ?? [];
  const delivered = orders.filter((o: any) => o.status === "delivered").length;
  const inProgress = orders.filter((o: any) => ["pending", "processing"].includes(o.status)).length;
  const failed = orders.filter((o: any) => o.status === "failed").length;
  const revenue = orders.reduce((s: number, o: any) => s + Number(o.sell_price ?? 0), 0);

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
    { label: "All",        value: "all",         count: orders.length },
    { label: "Delivered",  value: "delivered",   count: delivered     },
    { label: "In Progress",value: "in_progress", count: inProgress    },
    { label: "Failed",     value: "failed",      count: failed        },
  ];

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Total Orders",  value: orders.length,    icon: ShoppingCart, iconBg: "bg-primary/10",      iconCl: "text-primary",    valCl: "text-foreground"   },
          { label: "Delivered",     value: delivered,        icon: CheckCircle2, iconBg: "bg-emerald-500/10",  iconCl: "text-emerald-500",valCl: "text-emerald-600"  },
          { label: "In Progress",   value: inProgress,       icon: Clock,        iconBg: "bg-amber-500/10",    iconCl: "text-amber-500",  valCl: "text-amber-600"    },
          { label: "Failed",        value: failed,           icon: XCircle,      iconBg: "bg-rose-500/10",     iconCl: "text-rose-500",   valCl: "text-rose-600"     },
          { label: "Total Revenue", value: formatGHS(revenue),icon: TrendingUp,  iconBg: "bg-violet-500/10",   iconCl: "text-violet-500", valCl: "text-violet-700 dark:text-violet-400" },
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

      {/* ── Search + filter ── */}
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

      {/* ── Table ── */}
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
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Bundle", "Recipient", "Customer", "Revenue", "Status", "When", ""].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((o: any, i: number) => (
                  <tr
                    key={o.id}
                    className={`group transition-colors hover:bg-primary/[0.025] ${i % 2 !== 0 ? "bg-secondary/[0.04]" : ""}`}
                  >
                    {/* Bundle */}
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

                    {/* Recipient */}
                    <td className="px-5 py-4">
                      <code className="rounded-lg bg-secondary/70 px-2 py-1 text-[11px] font-mono font-semibold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </td>

                    {/* Customer */}
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

                    {/* Revenue */}
                    <td className="px-5 py-4">
                      <p className="text-sm font-black tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
                    </td>

                    {/* Status */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={o.status} />
                        {o.status === "failed" && o.notes && (
                          <span className="text-[9px] font-medium text-rose-500/80 max-w-[120px] truncate" title={o.notes}>
                            {o.notes}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Time */}
                    <td className="px-5 py-4">
                      <div className="flex flex-col">
                        <p className="text-xs font-semibold text-foreground whitespace-nowrap">
                          {new Intl.DateTimeFormat("en-GH", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                            hour12: true,
                          }).format(new Date(o.created_at))}
                        </p>
                        <p className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(o.created_at)}</p>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="px-5 py-4 text-right">
                      {o.status === "failed" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={retryId === o.id}
                          onClick={() => retryOrder(o)}
                          className="h-8 gap-1.5 rounded-xl border-rose-500/30 bg-rose-500/5 px-3 text-xs font-bold text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all"
                        >
                          {retryId === o.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><RotateCcw className="h-3 w-3" /> Retry</>
                          }
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
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
    if (error) {
      toast({ title: "Confirmation failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Withdrawal marked as paid" });
    qc.invalidateQueries({ queryKey: ["admin-withdrawals"] });
  };

  if (isLoading) return <LoadingCard text="Auditing withdrawal requests..." />;

  return (
    <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
      <div className="border-b border-border/40 bg-card/50 p-6">
        <h2 className="text-xl font-bold tracking-tight">Withdrawal Requests</h2>
        <p className="text-sm text-muted-foreground">Manage and process agent payout requests.</p>
      </div>
      <div className="divide-y divide-border/40">
        {data?.map((w: any) => (
          <div key={w.id} className="group p-6 transition-colors hover:bg-accent/20">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
                  <DollarSign className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-base font-bold leading-tight">{w.profile?.full_name || w.profile?.email || "Unknown Agent"}</p>
                  <p className="mt-1 text-xs font-medium text-muted-foreground">
                    Available: <span className="text-foreground">{formatGHS(w.balance)}</span> • Requested: <span className="text-foreground">{timeAgo(w.created_at)}</span>
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
                <div className={`rounded-xl border px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${w.status === 'paid' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-500' : 'border-amber-500/20 bg-amber-500/10 text-amber-500'}`}>
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
      {!data?.length && <div className="p-12 text-center text-muted-foreground">No pending withdrawal requests.</div>}
    </div>
  );
}

function PricingSection() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [activationFee, setActivationFee] = useState("50");

  const { data: payload, isLoading } = useQuery({
    queryKey: ["admin-pricing"],
    queryFn: async () => {
      const [{ data: networks }, { data: bundles }, { data: feeRow }] = await Promise.all([
        supabase.from("networks").select("id, name, code").order("sort_order"),
        supabase.from("bundles").select("*").order("sort_order"),
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
      if (error) {
        toast({ title: "Update failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Package updated successfully" });
    } else {
      const { error } = await supabase.from("bundles").insert(row as any);
      if (error) {
        toast({ title: "Create failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "New package created" });
    }
    setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const removeBundle = async (id: string) => {
    if (!confirm("Are you sure you want to deactivate this package?")) return;
    const { error } = await supabase.from("bundles").update({ active: false }).eq("id", id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
      return;
    }
    await supabase.from("agent_bundle_prices").update({ active: false }).eq("bundle_id", id);
    toast({ title: "Package deactivated" });
    qc.invalidateQueries({ queryKey: ["admin-pricing"] });
  };

  const saveActivationFee = async () => {
    const { error } = await supabase.from("app_settings").upsert({ key: "agent_activation_fee", value: Number(activationFee) });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Activation fee updated" });
  };

  if (isLoading) return <LoadingCard text="Syncing pricing configurations..." />;

  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6">
          <h2 className="text-xl font-bold tracking-tight">{editingId ? "Edit Package" : "Create New Package"}</h2>
          <p className="text-sm text-muted-foreground">Configure data bundle pricing and network availability.</p>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-5">
            <select
              value={form.network_id}
              onChange={(e) => setForm((p) => ({ ...p, network_id: e.target.value }))}
              className="h-12 rounded-2xl border border-border/40 bg-background/50 px-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all"
            >
              <option value="">Select Network</option>
              {payload?.networks.map((n: any) => <option key={n.id} value={n.id}>{n.name}</option>)}
            </select>
            <Input placeholder="Label (e.g. 1GB)" value={form.size_label} onChange={(e) => setForm((p) => ({ ...p, size_label: e.target.value }))} className="h-12 rounded-2xl bg-background/50" />
            <Input placeholder="Size in GB" type="number" step="0.1" value={form.size_gb} onChange={(e) => setForm((p) => ({ ...p, size_gb: e.target.value }))} className="h-12 rounded-2xl bg-background/50" />
            <Input placeholder="User Price (GHS)" value={form.user_price} onChange={(e) => setForm((p) => ({ ...p, user_price: e.target.value }))} className="h-12 rounded-2xl bg-background/50" />
            <Input placeholder="Agent Price (GHS)" value={form.base_price} onChange={(e) => setForm((p) => ({ ...p, base_price: e.target.value }))} className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="mt-6 flex items-center gap-3">
            <Button className="h-12 rounded-2xl bg-primary px-8 font-bold shadow-soft transition-all hover:scale-105 active:scale-95" onClick={saveBundle}>
              {editingId ? "Update Configuration" : "Add Package"}
            </Button>
            {editingId && (
              <Button variant="ghost" className="h-12 rounded-2xl px-6 font-medium" onClick={() => {
                setEditingId(null);
                setForm({ network_id: "", size_label: "", size_gb: "", user_price: "", base_price: "" });
              }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
          <div className="border-b border-border/40 bg-card/50 p-6">
            <h3 className="text-lg font-bold">Active Inventory</h3>
            <p className="text-xs text-muted-foreground">List of all currently active data packages.</p>
          </div>
          <div className="max-h-[600px] overflow-y-auto p-4 space-y-4 no-scrollbar">
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
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-tight">
                            User: <span className="text-foreground">{formatGHS(Number(b.user_price ?? b.base_price))}</span> • Agent: <span className="text-primary font-bold">{formatGHS(Number(b.base_price))}</span>
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 rounded-lg p-0 hover:bg-primary hover:text-white"
                            onClick={() => {
                              setEditingId(b.id);
                              setForm({
                                network_id: b.network_id,
                                size_label: b.size_label,
                                size_gb: String(b.size_mb / 1000),
                                user_price: String(b.user_price ?? b.base_price),
                                base_price: String(b.base_price),
                              });
                            }}
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
                <Button className="h-12 rounded-2xl bg-foreground text-background px-8 font-bold transition-all hover:opacity-90 active:scale-95" onClick={saveActivationFee}>
                  Update Fee
                </Button>
              </div>
            </div>
          </div>
          
          <div className="flex-1 rounded-[2rem] border border-dashed border-border/60 bg-accent/5 p-8 flex flex-col items-center justify-center text-center">
            <div className="h-12 w-12 rounded-2xl bg-accent/20 flex items-center justify-center text-muted-foreground mb-4">
              <Settings className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-muted-foreground px-6">Additional pricing modules and promotional tools will appear here in future updates.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

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
            swft: {
              name: "SwiftData GH",
              base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api",
              api_key: "swft_live_74686859a45448bea75376f0a64f97ed"
            },
            mtopup: {
              name: "MTopUp",
              base_url: "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api",
              api_key: ""
            }
          }
        });
      }
      return true;
    },
  });

  const saveConfig = async (newConfig: any) => {
    const { error } = await supabase.from("app_settings").upsert({ key: "data_providers", value: newConfig });
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Integrations updated successfully" });
    setConfig(newConfig);
    qc.invalidateQueries({ queryKey: ["admin-integrations"] });
  };

  const updateProvider = (key: string, field: string, val: string) => {
    setConfig((prev: any) => ({
      ...prev,
      providers: {
        ...prev.providers,
        [key]: {
          ...prev.providers[key],
          [field]: val
        }
      }
    }));
  };

  if (isLoading || !config) return <LoadingCard text="Loading integrations..." />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-md shadow-soft">
        <div className="border-b border-border/40 bg-card/50 p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Data Providers</h2>
            <p className="text-sm text-muted-foreground">Manage API keys and active fulfillment providers.</p>
          </div>
          <Button onClick={() => saveConfig(config)} className="h-10 w-full sm:w-auto rounded-xl bg-primary px-6 font-bold shadow-soft transition-all hover:scale-105">
            Save Changes
          </Button>
        </div>
        <div className="p-6 space-y-6">
          {Object.entries(config.providers).map(([key, provider]: [string, any]) => {
            const isActive = config.active === key;
            return (
              <div key={key} className={`relative overflow-hidden rounded-2xl border ${isActive ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-background/50'} p-6 transition-all`}>
                {isActive && (
                  <div className="absolute top-4 right-4 flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-primary shadow-sm">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Active
                  </div>
                )}
                
                <h3 className="text-lg font-bold">{provider.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">Configure {provider.name} settings</p>
                
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Base URL</label>
                    <Input 
                      value={provider.base_url} 
                      onChange={(e) => updateProvider(key, 'base_url', e.target.value)}
                      className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">API Key / Secret</label>
                    <Input 
                      type="password"
                      value={provider.api_key} 
                      onChange={(e) => updateProvider(key, 'api_key', e.target.value)}
                      placeholder="Enter API key..."
                      className="h-12 rounded-xl bg-background/80 focus:ring-2 focus:ring-primary/20" 
                    />
                  </div>
                </div>

                {!isActive && (
                  <Button 
                    variant="outline" 
                    onClick={() => saveConfig({ ...config, active: key })}
                    className="mt-5 h-10 rounded-xl font-bold border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                  >
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

function SiteSettingsSection() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [supportPhone, setSupportPhone] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [whatsappLink, setWhatsappLink] = useState("");
  const [notice, setNotice] = useState("");
  
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
      { key: "support_phone", value: supportPhone },
      { key: "support_email", value: supportEmail },
      { key: "whatsapp_group_link", value: whatsappLink },
      { key: "popup_notice", value: notice },
    ];

    const { error } = await supabase.from("app_settings").upsert(rows as any);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }

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
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Support Hotline</label>
            <Input value={supportPhone} onChange={(e) => setSupportPhone(e.target.value)} placeholder="+233..." className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Support Email</label>
            <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@onegig.com" className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Community Hub (WhatsApp)</label>
            <Input value={whatsappLink} onChange={(e) => setWhatsappLink(e.target.value)} placeholder="https://chat.whatsapp.com/..." className="h-12 rounded-2xl bg-background/50" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Platform-Wide Notice</label>
            <textarea 
              value={notice} 
              onChange={(e) => setNotice(e.target.value)} 
              placeholder="Important update or promotional notice for all users..." 
              className="min-h-[120px] w-full rounded-2xl border border-border/40 bg-background/50 p-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 outline-none transition-all resize-none"
            />
          </div>
        </div>

        <Button className="mt-8 h-12 rounded-2xl bg-primary px-10 font-bold shadow-soft transition-all hover:scale-105 active:scale-95" onClick={saveSettings}>
          <BellRing className="mr-2 h-4 w-4" /> Save Configuration
        </Button>
      </div>
    </div>
  );
}

function Metric({ 
  title, 
  value, 
  icon, 
  helper, 
  variant = "indigo" 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  helper?: string;
  variant?: "indigo" | "amber" | "emerald" | "rose" | "sky";
}) {
  const variants = {
    indigo: "from-indigo-500/20 to-indigo-500/5 text-indigo-500 border-indigo-500/20",
    amber: "from-amber-500/20 to-amber-500/5 text-amber-500 border-amber-500/20",
    emerald: "from-emerald-500/20 to-emerald-500/5 text-emerald-500 border-emerald-500/20",
    rose: "from-rose-500/20 to-rose-500/5 text-rose-500 border-rose-500/20",
    sky: "from-sky-500/20 to-sky-500/5 text-sky-500 border-sky-500/20",
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-border/40 bg-card/40 p-6 shadow-soft transition-all hover:shadow-lg hover:-translate-y-1">
      <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${variants[variant]}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-foreground">{value}</p>
        {helper && <p className="mt-2 text-xs font-medium text-muted-foreground/80">{helper}</p>}
      </div>
      <div className={`absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br ${variants[variant]} opacity-10 blur-2xl`} />
    </div>
  );
}

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-8 text-sm text-muted-foreground">
      {text}
    </div>
  );
}


