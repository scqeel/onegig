import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WalletManager } from "@/components/agent/WalletManager";
import { StatusBadge } from "@/components/agent/tabs/AgentTransactionsTab";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";

const MOMO_NETWORKS = ["MTN", "Telecel", "AirtelTigo"] as const;

export function AgentWalletTab({ userId }: { userId: string }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: walletData, isLoading } = useQuery({
    queryKey: ["agent-wallet", userId],
    queryFn: async () => {
      const [balRes, earningsRes, withdrawalsRes] = await Promise.all([
        supabase.rpc("get_wallet_balance", { _user_id: userId }),
        supabase.from("wallet_transactions").select("amount").eq("user_id", userId).eq("type", "earning").eq("status", "completed"),
        supabase.from("withdrawals").select("id, amount, momo_number, momo_name, momo_network, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      ]);
      const balance = Number(balRes.data ?? 0);
      const totalRevenue = (earningsRes.data ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
      return { balance, totalRevenue, withdrawals: withdrawalsRes.data ?? [] };
    },
  });

  const requestWithdrawal = async () => {
    const amt = Number(amount);
    if (!amt || amt < 50) { toast({ title: "Minimum withdrawal is GHS 50", variant: "destructive" }); return; }
    if (!momoNumber || !momoName || !momoNetwork) { toast({ title: "Fill in all MoMo details", variant: "destructive" }); return; }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("request-withdrawal", { body: { amount: amt, momo_number: momoNumber, momo_name: momoName, momo_network: momoNetwork } });
    setBusy(false);
    if (error || !data?.ok) { toast({ title: "Withdrawal failed", description: data?.error || error?.message, variant: "destructive" }); return; }
    toast({ title: "Withdrawal requested!", description: "Processed within 24 hours." });
    setAmount(""); setMomoNumber(""); setMomoName(""); setMomoNetwork("");
    qc.invalidateQueries({ queryKey: ["agent-wallet"] });
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-[#080c1a] p-6 shadow-float">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/40">
              <Wallet className="h-3.5 w-3.5" /> Available Balance
            </div>
            <p className="mt-3 text-4xl font-bold text-white">{isLoading ? "…" : formatGHS(walletData?.balance ?? 0)}</p>
            <p className="mt-1 text-xs text-white/40">Ready to withdraw</p>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card p-6 shadow-soft">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Lifetime Wallet Earnings
          </div>
          <p className="mt-3 text-4xl font-bold text-foreground">{isLoading ? "…" : formatGHS(walletData?.totalRevenue ?? 0)}</p>
          <p className="mt-1 text-xs text-muted-foreground">All-time earnings</p>
        </div>
      </div>

      <WalletManager />

      <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
        <div className="border-b border-border/60 bg-secondary/30 px-5 py-4 md:px-6">
          <h2 className="text-base font-bold text-foreground">Request Withdrawal</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Minimum GHS 50 · Processed within 24 hours.</p>
        </div>
        <div className="p-5 md:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Amount (GHS)</label>
              <Input type="number" min="50" className="h-11 rounded-xl" placeholder="e.g. 100" value={amount} onChange={(e) => setAmount(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">MoMo Network</label>
              <select
                aria-label="MoMo Network"
                value={momoNetwork}
                onChange={(e) => setMomoNetwork(e.target.value)}
                className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">Select network</option>
                {MOMO_NETWORKS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">MoMo Number</label>
              <Input type="tel" inputMode="tel" className="h-11 rounded-xl" placeholder="024 000 0000" value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Account Name</label>
              <Input className="h-11 rounded-xl" placeholder="Name on MoMo account" value={momoName} onChange={(e) => setMomoName(e.target.value)} />
            </div>
          </div>
          <Button type="button" className="mt-5 h-11 rounded-xl px-8 font-bold gradient-primary shadow-float" disabled={busy} onClick={requestWithdrawal}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Request Withdrawal"}
          </Button>
        </div>
      </div>

      {(walletData?.withdrawals?.length ?? 0) > 0 && (
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-soft">
          <div className="border-b border-border/60 bg-secondary/30 px-5 py-4 md:px-6">
            <h3 className="text-base font-bold text-foreground">Withdrawal History</h3>
          </div>
          <div className="space-y-2 p-5 md:p-6">
            {(walletData?.withdrawals as any[]).map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-xl border border-border/60 bg-secondary/20 p-4 hover:bg-secondary/40 transition-colors">
                <div>
                  <p className="font-bold text-foreground">{formatGHS(w.amount)}</p>
                  <p className="text-xs text-muted-foreground">{w.momo_network} · {w.momo_number} · {w.momo_name}</p>
                </div>
                <div className="text-right">
                  <StatusBadge status={w.status} />
                  <p className="mt-1.5 text-xs text-muted-foreground">{timeAgo(w.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
