import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

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

export function AdminPaymentsTab() {
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
    
    const { error: resolveErr } = await supabase.functions.invoke("admin-resolve-payment", {
      body: { payment_id: payment.id }
    });
    
    if (resolveErr) {
      setBusyId(null);
      toast({ title: "Failed to resolve payment", description: resolveErr.message, variant: "destructive" });
      return;
    }
    
    if (payment.purpose === "order" && payment.payload?.bundle_id) {
      const { error: fulfillErr } = await supabase.functions.invoke("place-order", {
        body: {
          recipient_phone: payment.payload.recipient_phone,
          bundle_id: payment.payload.bundle_id,
          agent_slug: payment.payload.agent_slug,
          manual_fulfill: true
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-5 rounded-2xl border border-border shadow-soft">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Payments Monitor</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track and force-resolve incoming platform payments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search reference, phone, error..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-56 h-10 rounded-xl bg-background pl-9 pr-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/20 border-border hover:border-border/80 transition-all text-foreground"
            />
          </div>
          <div className="flex bg-secondary/40 p-1 rounded-xl border border-border">
            {["all", "paid", "failed", "initialized"].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn("px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all", statusFilter === s ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border divide-y divide-border overflow-hidden shadow-soft">
        {filtered.length === 0 ? (
          <div className="p-16 text-center text-sm font-semibold text-muted-foreground">No transactions match your filters.</div>
        ) : (
          filtered.map((p: any) => (
            <div key={p.id} className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:bg-accent transition-colors">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base font-bold tracking-tight text-foreground">{formatGHS(p.amount)}</span>
                  <StatusBadge status={p.status} />
                  <span className="text-[10px] font-mono bg-secondary border border-border px-2.5 py-0.5 rounded-md text-muted-foreground">{p.reference}</span>
                  <span className="text-[9px] uppercase font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">{p.purpose}</span>
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
                    className="h-9 rounded-xl text-xs font-semibold border-emerald-500/30 text-emerald-600 bg-background hover:bg-emerald-500 hover:text-white transition-all"
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
