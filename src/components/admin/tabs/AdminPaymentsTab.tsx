import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw, RotateCcw, Search, ShieldCheck, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; dot: string; label: string }> = {
    delivered:   { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Delivered"   },
    paid:        { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Paid"        },
    approved:    { bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20", dot: "bg-emerald-500", label: "Approved"    },
    pending:     { bg: "bg-amber-500/10 text-amber-600 border-amber-500/20",       dot: "bg-amber-500",   label: "Pending"     },
    initialized: { bg: "bg-amber-500/10 text-amber-600 border-amber-500/20",       dot: "bg-amber-500",   label: "Initialized" },
    processing:  { bg: "bg-sky-500/10 text-sky-600 border-sky-500/20",             dot: "bg-sky-500",     label: "Processing"  },
    failed:      { bg: "bg-rose-500/10 text-rose-600 border-rose-500/20",          dot: "bg-rose-500",    label: "Failed"      },
    rejected:    { bg: "bg-rose-500/10 text-rose-600 border-rose-500/20",          dot: "bg-rose-500",    label: "Rejected"    },
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
        .select("id, reference, purpose, amount, currency, status, payload, created_at, user_id, order_id")
        .order("created_at", { ascending: false })
        .limit(200);
      
      if (error) throw error;
      
      const userIds = [...new Set((payments ?? []).map((p: any) => p.user_id).filter(Boolean))] as string[];
      let profiles: any[] = [];
      
      if (userIds.length > 0) {
        const { data: p } = await supabase.from("profiles").select("id, full_name, email, phone, wallet_balance").in("id", userIds);
        profiles = p ?? [];
      }
      const profileMap = new Map(profiles.map(p => [p.id, p]));
      
      return (payments ?? []).map((p: any) => ({
        ...p,
        customer: p.user_id ? profileMap.get(p.user_id) : null
      }));
    }
  });

  const verifyWithGateway = async (payment: any) => {
    setBusyId(payment.id);
    toast({ title: "Checking gateway...", description: `Verifying ${payment.reference} on Paystack/theTeller` });
    try {
      // Determine if the reference is likely Paystack or theTeller
      const isTheTeller = payment.reference?.startsWith("TT-") || payment.reference?.startsWith("TEL-");
      const funcName = isTheTeller ? "theteller-verify" : "paystack-verify";
      
      const { data: res, error: verifyErr } = await supabase.functions.invoke(funcName, {
        body: { reference: payment.reference }
      });

      if (verifyErr || !res?.ok) {
        throw new Error(res?.error || verifyErr?.message || "Gateway verification reported status: " + (res?.status || "unpaid"));
      }

      toast({ 
        title: "Payment Confirmed & Fulfilled! 🎉", 
        description: `Status: ${res.status || "success"}. Purpose: ${res.purpose || payment.purpose}` 
      });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast({ 
        title: "Verification result", 
        description: err.message || "Payment is not marked as paid on gateway.", 
        variant: "destructive" 
      });
    } finally {
      setBusyId(null);
    }
  };

  const forceResolve = async (payment: any) => {
    if (!confirm("Are you sure you want to mark this payment as PAID and fulfill the associated order/deposit?")) return;
    setBusyId(payment.id);
    
    try {
      const { error: resolveErr } = await supabase.functions.invoke("admin-resolve-payment", {
        body: { payment_id: payment.id }
      });
      
      if (resolveErr) {
        throw new Error(resolveErr.message);
      }
      
      if (payment.purpose === "order" && (payment.payload?.bundle_id || payment.payload?.type)) {
        const { error: fulfillErr } = await supabase.functions.invoke("place-order", {
          body: {
            recipient_phone: payment.payload?.recipient_phone,
            bundle_id: payment.payload?.bundle_id,
            agent_slug: payment.payload?.agent_slug,
            manual_fulfill: true
          }
        });
        if (fulfillErr) {
          toast({ title: "Payment resolved, but auto-delivery note", description: fulfillErr.message });
        }
      }
      
      toast({ title: "Payment successfully resolved!" });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast({ title: "Failed to resolve payment", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const manualFulfillOrder = async (payment: any) => {
    const phone = payment.payload?.recipient_phone || payment.customer?.phone;
    if (!phone) {
      toast({ title: "No recipient phone found", variant: "destructive" });
      return;
    }
    if (!confirm(`Mark data bundle as manually delivered to ${phone}?`)) return;
    
    setBusyId(payment.id);
    try {
      // Mark payment as paid if not already
      await supabase.from("payments").update({ status: "paid" }).eq("id", payment.id);

      // If order exists, mark as delivered
      if (payment.order_id) {
        await supabase.from("orders").update({ status: "delivered", notes: "Manually fulfilled by Admin" }).eq("id", payment.order_id);
      } else {
        // Find recent matching order by recipient phone
        const { data: matchedOrder } = await supabase
          .from("orders")
          .select("id")
          .eq("recipient_phone", phone)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (matchedOrder?.id) {
          await supabase.from("orders").update({ status: "delivered", notes: "Manually fulfilled by Admin" }).eq("id", matchedOrder.id);
        }
      }

      toast({ title: "Marked as Manually Fulfilled! ✅" });
      qc.invalidateQueries({ queryKey: ["admin-payments"] });
      qc.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (err: any) {
      toast({ title: "Failed to fulfill", description: err.message, variant: "destructive" });
    } finally {
      setBusyId(null);
    }
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
      const slug = (p.payload?.agent_slug || "").toLowerCase();
      const errMsg = (p.payload?.error_message || "").toLowerCase();
      const purpose = (p.purpose || "").toLowerCase();
      const amt = String(p.amount || "");
      if (
        !name.includes(q) &&
        !phone.includes(q) &&
        !ref.includes(q) &&
        !slug.includes(q) &&
        !errMsg.includes(q) &&
        !purpose.includes(q) &&
        !amt.includes(q)
      ) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-card p-5 rounded-2xl border border-border shadow-soft">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Payments Monitor & Resolution</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Track, verify live with gateway, and resolve guest storefront and user payments.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60" />
            <Input
              placeholder="Search reference, phone, agent slug..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-64 h-10 rounded-xl bg-background pl-9 pr-3 text-xs font-semibold outline-none focus-visible:ring-2 focus-visible:ring-primary/20 border-border hover:border-border/80 transition-all text-foreground"
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
          filtered.map((p: any) => {
            const isGuest = !p.user_id;
            const recipientPhone = p.payload?.recipient_phone || p.customer?.phone;
            const agentSlug = p.payload?.agent_slug;
            const isUnresolved = p.status !== "paid";

            return (
              <div key={p.id} className="p-6 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center hover:bg-accent transition-colors">
                <div className="space-y-2 max-w-2xl">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-base font-bold tracking-tight text-foreground">{formatGHS(p.amount)}</span>
                    <StatusBadge status={p.status} />
                    <span className="text-[10px] font-mono bg-secondary border border-border px-2.5 py-0.5 rounded-md text-muted-foreground">{p.reference}</span>
                    <span className="text-[9px] uppercase font-semibold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md">{p.purpose}</span>
                    {isGuest ? (
                      <span className="text-[9px] font-semibold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-md">
                        🏪 Guest Storefront Buyer
                      </span>
                    ) : (
                      <span className="text-[9px] font-semibold text-blue-600 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-md">
                        👤 Registered User
                      </span>
                    )}
                    {agentSlug && (
                      <span className="text-[9px] font-semibold text-purple-600 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-md">
                        Agent: @{agentSlug}
                      </span>
                    )}
                  </div>

                  <div className="text-xs font-semibold text-muted-foreground/90 flex flex-wrap items-center gap-2">
                    <span>Customer: {p.customer?.full_name || "Guest"}</span>
                    <span>•</span>
                    <span>Recipient Phone: <strong className="text-foreground">{recipientPhone || "N/A"}</strong></span>
                    <span>•</span>
                    <span>{timeAgo(p.created_at)}</span>
                  </div>

                  {p.payload?.error_message && (
                    <div className="mt-2 text-xs font-semibold text-rose-500 bg-rose-500/10 px-3.5 py-2 rounded-xl border border-rose-500/20 max-w-2xl">
                      🚨 Gateway Issue: {p.payload.error_message}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 w-full md:w-auto mt-2 md:mt-0">
                  {/* Live Verify with Gateway */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl text-xs font-semibold border-primary/30 text-primary bg-primary/5 hover:bg-primary hover:text-white transition-all shadow-sm"
                    disabled={!!busyId}
                    onClick={() => verifyWithGateway(p)}
                    title="Queries Paystack/theTeller API live to check if money was deducted and auto-credits/delivers"
                  >
                    {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />}
                    Verify Gateway
                  </Button>

                  {/* Force Resolve */}
                  {isUnresolved && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-xl text-xs font-semibold border-emerald-500/30 text-emerald-600 bg-emerald-500/5 hover:bg-emerald-500 hover:text-white transition-all shadow-sm"
                      disabled={!!busyId}
                      onClick={() => forceResolve(p)}
                      title="Force mark as Paid and deliver data/credit wallet"
                    >
                      {busyId === p.id ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                      Force Resolve
                    </Button>
                  )}

                  {/* Manual Fulfill */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl text-xs font-semibold border-border text-foreground hover:bg-secondary transition-all"
                    disabled={!!busyId}
                    onClick={() => manualFulfillOrder(p)}
                    title="Mark order as delivered if sent manually via USSD/SIM"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 text-emerald-500" />
                    Manual Fulfill
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
