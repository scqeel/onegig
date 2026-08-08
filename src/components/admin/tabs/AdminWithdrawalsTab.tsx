import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DollarSign, Loader2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatGHS, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

type Profile = {
  id: string;
  full_name: string;
  username: string | null;
  email: string | null;
  phone: string | null;
};

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-border/40 ${className}`} />;
}

export function AdminWithdrawalsTab() {
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
    <div className="space-y-6 animate-in fade-in duration-300">
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
