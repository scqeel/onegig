import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, Package, ReceiptText, RefreshCcw, Search, TrendingUp, Wallet, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    delivered:  { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", label: "Delivered"  },
    paid:       { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", label: "Paid"       },
    approved:   { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400", dot: "bg-emerald-500", label: "Approved"   },
    pending:    { bg: "bg-amber-500/10  text-amber-600  border-amber-500/20  dark:text-amber-400",  dot: "bg-amber-500",  label: "Pending"    },
    processing: { bg: "bg-sky-500/10   text-sky-600   border-sky-500/20   dark:text-sky-400",    dot: "bg-sky-500",    label: "Processing" },
    failed:     { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20  dark:text-rose-400",   dot: "bg-rose-500",   label: "Failed"     },
    rejected:   { bg: "bg-rose-500/10  text-rose-600  border-rose-500/20  dark:text-rose-400",   dot: "bg-rose-500",   label: "Rejected"   },
  };
  const cfg = map[status] ?? { bg: "bg-muted text-muted-foreground border-border", dot: "bg-muted-foreground", label: status };
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", cfg.bg)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {cfg.label}
    </span>
  );
}

export function AgentTransactionsTab({ agentId }: { agentId: string }) {
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const { data: orders, isLoading } = useQuery({
    queryKey: ["agent-transactions", agentId],
    refetchInterval: 4000,
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, recipient_phone, status, sell_price, agent_profit, created_at, payment_reference, bundle:bundles(size_label, size_mb), network:networks(name, logo_emoji)")
        .eq("agent_id", agentId)
        .order("created_at", { ascending: false })
        .limit(500);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const list = (orders as any[]) ?? [];
  const delivered  = list.filter((o) => o.status === "delivered").length;
  const inProgress = list.filter((o) => ["pending", "processing"].includes(o.status)).length;
  const failed     = list.filter((o) => o.status === "failed").length;
  const refunded   = list.filter((o) => ["refunded", "refund_requested"].includes(o.status)).length;
  const totalProfit = list
    .filter((o) => o.status === "delivered")
    .reduce((s, o) => s + Number(o.agent_profit ?? 0), 0);

  const q = search.trim().toLowerCase();
  const filtered = list
    .filter((o) => {
      if (statusFilter === "in_progress") return ["pending", "processing"].includes(o.status);
      if (statusFilter === "refunded") return ["refunded", "refund_requested"].includes(o.status);
      if (statusFilter !== "all") return o.status === statusFilter;
      return true;
    })
    .filter((o) =>
      !q ||
      (o.recipient_phone ?? "").includes(q) ||
      (o.network?.name ?? "").toLowerCase().includes(q) ||
      (o.bundle?.size_label ?? "").toLowerCase().includes(q)
    );

  const FILTERS = [
    { label: "All",         value: "all",         count: list.length },
    { label: "Delivered",   value: "delivered",   count: delivered   },
    { label: "In Progress", value: "in_progress", count: inProgress  },
    { label: "Failed",      value: "failed",      count: failed      },
    { label: "Refunded",    value: "refunded",    count: refunded    },
  ];

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {[
          { label: "Total Orders", value: list.length,        icon: ReceiptText,  iconBg: "bg-primary/10",     iconCl: "text-primary",    valCl: "text-foreground"  },
          { label: "Delivered",    value: delivered,          icon: CheckCircle2, iconBg: "bg-emerald-500/10", iconCl: "text-emerald-500",valCl: "text-emerald-600" },
          { label: "In Progress",  value: inProgress,         icon: Clock,        iconBg: "bg-amber-500/10",   iconCl: "text-amber-500",  valCl: "text-amber-600"   },
          { label: "Failed",       value: failed,             icon: XCircle,      iconBg: "bg-rose-500/10",    iconCl: "text-rose-500",   valCl: "text-rose-600"    },
          { label: "Refunded",     value: refunded,           icon: RefreshCcw,   iconBg: "bg-purple-500/10",  iconCl: "text-purple-500", valCl: "text-purple-600 dark:text-purple-400" },
          { label: "Displayed Profit", value: formatGHS(totalProfit), icon: TrendingUp, iconBg: "bg-green-500/10", iconCl: "text-green-500",  valCl: "text-green-700 dark:text-green-400" },
        ].map(({ label, value, icon: Icon, iconBg, iconCl, valCl }) => (
          <div key={label} className="rounded-2xl border border-border/50 bg-card p-4 shadow-soft">
            <div className={cn("mb-3 flex h-8 w-8 items-center justify-center rounded-xl", iconBg)}>
              <Icon className={cn("h-4 w-4", iconCl)} />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</p>
            <p className={cn("mt-1 text-xl font-black tabular-nums", valCl)}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search phone, network…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border/60 bg-secondary/40 pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          />
        </div>

        <div className="flex shrink-0 gap-1 rounded-xl border border-border/50 bg-secondary/40 p-1 overflow-x-auto hide-scrollbar max-w-full">
          {FILTERS.map(({ label, value, count }) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                statusFilter === value
                  ? "gradient-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn(
                  "rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums",
                  statusFilter === value ? "bg-white/20 text-white" : "bg-secondary text-muted-foreground"
                )}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/50 bg-card shadow-soft">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/60">
              <Package className="h-7 w-7 text-muted-foreground/25" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              {list.length === 0 ? "No transactions yet" : "No orders match your filter"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              {list.length === 0
                ? "Share your store link to start receiving orders."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border/40 bg-secondary/30">
                  {["Network", "Bundle", "Recipient", "Amount", "Profit", "Status", "When"].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filtered.map((o, i) => (
                  <tr
                    key={o.id}
                    className={cn(
                      "group transition-colors hover:bg-primary/[0.025]",
                      i % 2 !== 0 && "bg-secondary/[0.04]"
                    )}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-secondary/70 text-lg leading-none">
                          {o.network?.logo_emoji ?? "📦"}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{o.network?.name}</p>
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <span className="rounded-lg bg-secondary/70 px-2.5 py-1 text-xs font-bold text-foreground">
                        {o.bundle?.size_label}
                      </span>
                    </td>

                    <td className="px-5 py-4">
                      <code className="rounded-lg bg-secondary/70 px-2 py-1 text-[11px] font-mono font-semibold text-foreground tracking-tight">
                        {o.recipient_phone}
                      </code>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col items-start gap-1">
                        <p className="text-sm font-black tabular-nums text-foreground leading-none">{formatGHS(o.sell_price)}</p>
                        {o.payment_reference?.startsWith("WP-") && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-bold text-primary uppercase tracking-wider">
                            <Wallet className="h-2.5 w-2.5" /> Wallet
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      {Number(o.agent_profit) > 0 ? (
                        <div className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-black text-emerald-600 dark:text-emerald-400">
                          <TrendingUp className="h-3 w-3" />
                          +{formatGHS(o.agent_profit)}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge status={o.status} />
                    </td>

                    <td className="px-5 py-4">
                      <p className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(o.created_at)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="border-t border-border/30 bg-secondary/20 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-bold text-foreground">{filtered.length}</span> of{" "}
              <span className="font-bold">{list.length}</span> transactions
              {totalProfit > 0 && (
                <> · Profit earned:{" "}
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatGHS(totalProfit)}</span>
                </>
              )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
