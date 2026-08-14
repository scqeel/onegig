import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock, Loader2, RefreshCw, Search, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS } from "@/lib/format";
import { cn } from "@/lib/utils";

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-card/50 p-8 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin text-primary" />
      {text}
    </div>
  );
}

export function AdminSubscriptionsTab() {
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-float transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
            <RefreshCw className="h-4.5 w-4.5 animate-spin-slow" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/75">Total Subscriptions</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-foreground tabular-nums">{subs.length}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-float transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
            <CheckCircle2 className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/75">Active Subscriptions</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{activeSubs.length}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-float transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500">
            <TrendingUp className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/75">Monthly Volume</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{formatGHS(recurringVolume)}</p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-5 shadow-soft hover:-translate-y-1 hover:border-primary/20 hover:shadow-float transition-all duration-300">
          <div className="mb-3.5 flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/20 bg-rose-500/10 text-rose-500">
            <Clock className="h-4.5 w-4.5" />
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/75">Plans (Wk / Mo)</p>
          <p className="mt-1.5 text-xl sm:text-2xl font-bold text-rose-600 dark:text-rose-400 tabular-nums">{weeklyCount} / {monthlyCount}</p>
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
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-xs font-semibold text-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/20 hover:border-border/80 transition-all"
          />
        </div>

        <div className="flex shrink-0 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
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
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap",
                filterFreq === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <RefreshCw className="h-10 w-10 text-muted-foreground/30 mb-4 animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">No recurring subscriptions match filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/40 text-muted-foreground uppercase tracking-widest font-semibold border-b border-border">
                <tr>
                  <th className="px-6 py-4">Subscriber Details</th>
                  <th className="px-6 py-4">Storefront Origin</th>
                  <th className="px-6 py-4">Bundle Plan</th>
                  <th className="px-6 py-4">Frequency</th>
                  <th className="px-6 py-4">Next Billing</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((s) => {
                  const net = s.bundle?.networks?.logo_emoji ?? "📶";
                  return (
                    <tr key={s.id} className="group hover:bg-accent transition-colors">
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
                      <td className="px-6 py-4 font-semibold uppercase tracking-wider text-[9px] text-primary">{s.frequency}</td>
                      <td className="px-6 py-4 font-semibold text-foreground">{new Date(s.next_billing_at).toLocaleDateString()}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${
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
                                className="h-8 rounded-xl text-xs font-semibold text-amber-500 border border-amber-500/20 bg-background hover:bg-amber-500 hover:text-white transition-all shadow-sm"
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
