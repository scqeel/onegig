import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Loader2, ArrowUpRight, ArrowDownLeft, Clock, History, KeyRound, Wallet, Ban } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdminUserDetailsModal({ 
  user, 
  isOpen, 
  onClose 
}: { 
  user: any, 
  isOpen: boolean, 
  onClose: () => void 
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "wallet" | "orders">("overview");

  // Wallet Form State
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjusting, setAdjusting] = useState(false);

  // Password Reset State
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Fetch Wallet Balance
  const { data: balanceData, isLoading: loadingBalance, refetch: refetchBalance } = useQuery({
    queryKey: ["admin-user-balance", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_wallet_balance", { _user_id: user.id });
      if (error) throw error;
      return Number(data || 0);
    },
    enabled: !!user?.id && isOpen,
  });

  // Fetch Transactions
  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["admin-user-tx", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("wallet_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isOpen && tab === "overview",
  });

  // Fetch Orders
  const { data: orders, isLoading: loadingOrders } = useQuery({
    queryKey: ["admin-user-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, bundle:bundles(size_label), network:networks(name)").eq("customer_user_id", user.id).order("created_at", { ascending: false }).limit(20);
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && isOpen && tab === "orders",
  });

  const handleWalletAdjust = async (type: "credit" | "debit") => {
    const amt = Number(adjustAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Enter a valid positive amount", variant: "destructive" });
      return;
    }
    
    setAdjusting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: {
          action: "adjust_wallet",
          target_user_id: user.id,
          amount: type === "credit" ? amt : -amt,
          description: adjustReason || (type === "credit" ? "Admin Manual Credit" : "Admin Manual Debit"),
        }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      toast({ title: "Wallet updated successfully!" });
      setAdjustAmount("");
      setAdjustReason("");
      refetchBalance();
      qc.invalidateQueries({ queryKey: ["admin-user-tx", user.id] });
    } catch (err: any) {
      toast({ title: "Failed to update wallet", description: err.message, variant: "destructive" });
    } finally {
      setAdjusting(false);
    }
  };

  const handlePasswordReset = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: {
          action: "reset_password",
          target_user_id: user.id,
          new_password: newPassword,
        }
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      toast({ title: "Password reset successfully!" });
      setNewPassword("");
    } catch (err: any) {
      toast({ title: "Failed to reset password", description: err.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-border/50 rounded-3xl">
        <div className="bg-muted/30 p-6 border-b border-border/40">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-xl font-black">{user.full_name || user.username || "Anonymous"}</DialogTitle>
              <DialogDescription className="mt-1 font-mono text-xs text-muted-foreground">{user.id}</DialogDescription>
            </div>
            <div className="flex gap-1 flex-wrap justify-end">
              {user.roles?.map((r: string) => (
                <span key={r} className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider", 
                  r === 'admin' ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20' : 
                  r === 'agent' ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : 
                  'bg-secondary text-muted-foreground border border-border/50'
                )}>
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 text-sm text-muted-foreground">
            <div><span className="font-semibold text-foreground">Email:</span> {user.email || "N/A"}</div>
            <div><span className="font-semibold text-foreground">Phone:</span> {user.phone || "N/A"}</div>
          </div>
        </div>

        <div className="flex border-b border-border/40 bg-muted/10 px-4">
          <button onClick={() => setTab("overview")} className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors", tab === "overview" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Overview</button>
          <button onClick={() => setTab("wallet")} className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors", tab === "wallet" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Manage Wallet</button>
          <button onClick={() => setTab("orders")} className={cn("px-4 py-3 text-sm font-bold border-b-2 transition-colors", tab === "orders" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>Orders</button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-6 scrollbar-none">
          {tab === "overview" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between p-5 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/10">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Wallet className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary/80 uppercase tracking-wider">Current Balance</p>
                    <div className="text-3xl font-black text-foreground">
                      {loadingBalance ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : formatGHS(balanceData || 0)}
                    </div>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTab("wallet")} className="rounded-xl font-bold bg-background/50">Adjust</Button>
              </div>

              <div>
                <h3 className="font-bold text-sm text-muted-foreground uppercase tracking-wider mb-3">Recent Transactions</h3>
                {loadingTx ? (
                  <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : transactions?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-2xl">No transactions found</div>
                ) : (
                  <div className="space-y-2">
                    {transactions?.slice(0, 5).map(tx => (
                      <div key={tx.id} className="flex justify-between items-center p-3 rounded-xl border border-border/40 bg-card">
                        <div className="flex items-center gap-3">
                          <div className={cn("h-8 w-8 rounded-full flex items-center justify-center", tx.amount > 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500")}>
                            {tx.amount > 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="text-sm font-bold capitalize">{tx.type.replace("_", " ")}</p>
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(tx.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={cn("text-sm font-black", tx.amount > 0 ? "text-emerald-500" : "text-foreground")}>{tx.amount > 0 ? "+" : ""}{formatGHS(tx.amount)}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{tx.status}</p>
                        </div>
                      </div>
                    ))}
                    {transactions && transactions.length > 5 && (
                       <div className="text-center pt-2 text-xs font-bold text-muted-foreground">Showing 5 of {transactions.length}</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "wallet" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-5 rounded-2xl border border-border/50 bg-card space-y-4">
                <h3 className="font-bold text-lg flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" /> Adjust Wallet Balance</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Use this tool to manually credit or debit funds from this user's wallet. This will immediately affect their available balance and record a transaction in their history.
                </p>
                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Amount (GHS)</label>
                    <Input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0.00" className="h-11 rounded-xl text-lg font-bold" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1.5 block">Reason (Visible to user)</label>
                    <Input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} placeholder="e.g. Refund for failed order #REF-123" className="h-11 rounded-xl" />
                  </div>
                  <div className="flex gap-3 pt-2">
                    <Button onClick={() => handleWalletAdjust("credit")} disabled={adjusting} className="flex-1 h-11 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold">
                      {adjusting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowDownLeft className="h-4 w-4 mr-2" />} Credit Wallet
                    </Button>
                    <Button onClick={() => handleWalletAdjust("debit")} disabled={adjusting} variant="outline" className="flex-1 h-11 rounded-xl border-rose-500/30 text-rose-500 hover:bg-rose-500/10 font-bold">
                      {adjusting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />} Debit Wallet
                    </Button>
                  </div>
                </div>
              </div>

              <div className="p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-4">
                <h3 className="font-bold text-lg text-rose-500 flex items-center gap-2"><KeyRound className="h-5 w-5" /> Danger Zone</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-bold text-rose-500/70 uppercase tracking-wider mb-1.5 block">Force Reset Password</label>
                    <div className="flex gap-2">
                      <Input value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="New strong password" type="text" className="h-11 rounded-xl border-rose-500/30 bg-background/50" />
                      <Button onClick={handlePasswordReset} disabled={resetting} className="h-11 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-bold shrink-0">
                        {resetting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reset"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === "orders" && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
               {loadingOrders ? (
                  <div className="py-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : orders?.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-2xl">No orders found</div>
                ) : (
                  <div className="space-y-3">
                    {orders?.map(o => (
                      <div key={o.id} className="p-4 rounded-xl border border-border/40 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                         <div>
                           <p className="font-bold">{o.network?.name} {o.bundle?.size_label}</p>
                           <p className="text-xs font-mono text-muted-foreground mt-1">{o.recipient_phone}</p>
                         </div>
                         <div className="text-left sm:text-right">
                           <p className="font-black text-lg">{formatGHS(o.sell_price)}</p>
                           <span className={cn("inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mt-1", 
                             o.status === 'completed' || o.status === 'delivered' ? 'bg-emerald-500/10 text-emerald-500' :
                             o.status === 'failed' ? 'bg-rose-500/10 text-rose-500' : 'bg-amber-500/10 text-amber-500'
                           )}>{o.status}</span>
                         </div>
                      </div>
                    ))}
                  </div>
                )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
