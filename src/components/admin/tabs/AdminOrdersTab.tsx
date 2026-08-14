import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Package, RefreshCw, RotateCcw, Search, ShoppingCart, TrendingUp, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
};

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
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-border/40 ${className}`} />;
}

export function AdminOrdersTab() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [syncingId, setSyncingId]       = useState<string | null>(null);
  const [retryId, setRetryId]           = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch]             = useState("");
  const [dateFilter, setDateFilter]     = useState("30d");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", dateFilter],
    queryFn: async () => {
      let query = supabase
        .from("orders")
        .select("id, reference, bundle_id, source, status, sell_price, created_at, customer_user_id, recipient_phone, notes, bundle:bundles(size_label), network:networks(name, logo_emoji)")
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

  const syncOrderStatus = async (order: any) => {
    setSyncingId(order.id);
    try {
      toast({ title: "Syncing Provider Status...", description: `Checking live status with DataHub GH for order ref ${order.reference || order.id}...` });
      
      const { data, error } = await supabase.functions.invoke("admin-provider-action", {
        body: {
          action: "check_order_status",
          order_id: order.id,
          reference: order.reference || order.id
        }
      });

      if (error) {
        toast({ title: "Sync Failed", description: error.message, variant: "destructive" });
      } else if (data?.success) {
        const newStatus = data.status || "processing";
        toast({
          title: `Order Status Synced: ${newStatus.toUpperCase()} 🔄`,
          description: `Provider status (${data.provider_status || 'ok'}) mapped to ${newStatus}. Order tracker updated!`,
        });
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      } else {
        toast({ title: "Sync Response", description: data?.error || "Could not resolve order status from provider." });
      }
    } catch (err: any) {
      toast({ title: "Sync Failed", description: err.message, variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  const retryOrder = async (order: any, manualFulfill: boolean = false) => {
    if (!order.recipient_phone) return;
    setRetryId(order.id);
    try {
      toast({ title: "Retrying Delivery...", description: `Submitting order ref ${order.reference || order.id} to DataHub GH...` });
      
      const { data, error } = await supabase.functions.invoke("admin-provider-action", {
        body: { 
          action: "retry_order",
          order_id: order.id,
          manual_fulfill: manualFulfill
        },
      });

      if (error) { 
        toast({ title: "Retry Failed", description: error.message, variant: "destructive" }); 
      } else {
        toast({ 
          title: manualFulfill ? "Marked as Delivered 🟢" : "Order Retried & Submitted 🔄", 
          description: data?.message || "Provider request executed. Status updated!" 
        });
        qc.invalidateQueries({ queryKey: ["admin-orders"] });
      }
    } catch (err: any) {
      toast({ title: "Retry Failed", description: err.message, variant: "destructive" });
    } finally {
      setRetryId(null);
    }
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
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-5">
        {[
          { label: "Total Orders",  value: orders.length,     icon: ShoppingCart, iconBg: "bg-primary/10 text-primary border-primary/20", valCl: "text-foreground" },
          { label: "Delivered",     value: delivered,          icon: CheckCircle2, iconBg: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20", valCl: "text-emerald-600 dark:text-emerald-400" },
          { label: "In Progress",   value: inProgress,         icon: Clock,        iconBg: "bg-amber-500/10 text-amber-500 border-amber-500/20", valCl: "text-amber-600 dark:text-amber-400" },
          { label: "Failed",        value: failed,             icon: XCircle,      iconBg: "bg-rose-500/10 text-rose-500 border-rose-500/20", valCl: "text-rose-600 dark:text-rose-400" },
          { label: "Total Revenue", value: formatGHS(revenue), icon: TrendingUp,   iconBg: "bg-primary/10 text-primary border-primary/20", valCl: "text-primary" },
        ].map(({ label, value, icon: Icon, iconBg, valCl }) => (
          <div key={label} className="relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-float transition-all duration-300">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl border ${iconBg}`}>
              <Icon className="h-4 w-4" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/75">{label}</p>
            <p className={`mt-1.5 text-xl sm:text-2xl font-bold tracking-tight tabular-nums ${valCl}`}>{value}</p>
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
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all"
          />
        </div>
        <div className="flex flex-wrap shrink-0 items-center gap-3">
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-10 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>

          <div className="flex shrink-0 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
            {FILTERS.map(({ label, value, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold tabular-nums ${
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
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary border border-border">
              <Package className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground">No orders found</p>
            <p className="mt-1 text-xs text-muted-foreground/60">Try adjusting your search or filter.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <table className="hidden w-full text-left md:table text-xs">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-wider font-semibold border-b border-border">
                <tr>
                  {["Bundle", "Recipient", "Customer", "Revenue", "Status", "When", ""].map((h) => (
                    <th key={h} className="px-6 py-4 text-[10px] tracking-widest whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((o: any) => (
                  <tr key={o.id} className="group transition-colors hover:bg-accent">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-lg leading-none border border-border">
                          {o.bundle ? (o.network?.logo_emoji ?? "📦") : (o.notes?.includes("Utility") ? "⚡" : "📱")}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                            {o.bundle?.size_label ?? (o.notes?.split(" - ")[0] ?? "Order")}
                          </p>
                          <p className="text-[10px] text-muted-foreground/90 font-medium">
                            {o.network?.name ?? (o.notes?.includes("Utility") ? "Utility Payment" : "System")}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <code className="rounded-lg bg-secondary border border-border px-2 py-1 text-[11px] font-mono font-semibold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <p className="max-w-[150px] truncate text-sm font-semibold text-foreground">
                        {o.customer?.full_name || o.customer?.email || (
                          <span className="font-normal italic text-muted-foreground/70">Guest</span>
                        )}
                      </p>
                      {o.source && (
                        <span className="mt-1 inline-block rounded-md bg-secondary border border-border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground/80">
                          {o.source.replace("_", " ")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold tabular-nums text-foreground">{formatGHS(o.sell_price)}</p>
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
                      <p className="whitespace-nowrap text-xs font-semibold text-foreground">
                        {new Intl.DateTimeFormat("en-GH", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true }).format(new Date(o.created_at))}
                      </p>
                      <p className="whitespace-nowrap text-[10px] text-muted-foreground/80 font-medium">{timeAgo(o.created_at)}</p>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm" variant="outline"
                          disabled={syncingId === o.id}
                          onClick={() => syncOrderStatus(o)}
                          className="h-8 gap-1.5 rounded-xl border-primary/30 bg-primary/5 px-3 text-xs font-semibold text-primary hover:bg-primary hover:border-primary hover:text-primary-foreground transition-all shadow-sm"
                          title="Fetch live provider status & update database + tracker"
                        >
                          {syncingId === o.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><RefreshCw className="h-3.5 w-3.5" /> Sync Status</>}
                        </Button>
                        {["failed", "processing", "pending"].includes(o.status) && (
                          <>
                            <Button
                              size="sm" variant="outline"
                              disabled={retryId === o.id}
                              onClick={() => retryOrder(o, true)}
                              className="h-8 gap-1.5 rounded-xl border-emerald-500/30 bg-emerald-500/5 px-3 text-xs font-semibold text-emerald-500 hover:bg-emerald-500 hover:border-emerald-500 hover:text-white transition-all shadow-sm"
                            >
                              {retryId === o.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <><CheckCircle2 className="h-3.5 w-3.5" /> Manual Fulfill</>}
                            </Button>
                            <Button
                              size="sm" variant="outline"
                              disabled={retryId === o.id}
                              onClick={() => retryOrder(o, false)}
                              className="h-8 gap-1.5 rounded-xl border-rose-500/30 bg-rose-500/5 px-3 text-xs font-semibold text-rose-500 hover:bg-rose-500 hover:border-rose-500 hover:text-white transition-all shadow-sm"
                            >
                              {retryId === o.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <><RotateCcw className="h-3.5 w-3.5" /> Retry API</>}
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
