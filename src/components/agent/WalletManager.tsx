import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Wallet, Plus, ArrowUpRight, ArrowDownLeft, Clock, RefreshCcw, CheckCircle2, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSettings } from "@/hooks/useSettings";

export const WalletManager = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const activeGateway = settings?.active_payment_gateway || "paystack";
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [depositOpen, setDepositOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");

  const [phase, setPhase] = useState<"idle" | "processing" | "otp" | "polling" | "success" | "error">("idle");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const [historyTab, setHistoryTab] = useState<"transactions" | "orders">("transactions");
  const [transactions, setTransactions] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const fetchBalance = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase.rpc("get_wallet_balance", { _user_id: profile.id });
      if (!error) setBalance(Number(data));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    if (!profile?.id) return;
    setLoadingHistory(true);
    
    const [txRes, ordRes] = await Promise.all([
      supabase.from("wallet_transactions").select("*").eq("user_id", profile.id).order("created_at", { ascending: false }).limit(500),
      supabase.from("orders").select("*, bundle:bundles(size_label), network:networks(name)").eq("customer_user_id", profile.id).order("created_at", { ascending: false }).limit(500)
    ]);
    
    if (txRes.data) setTransactions(txRes.data);
    if (ordRes.data) setOrders(ordRes.data);
    
    setLoadingHistory(false);
  };

  useEffect(() => {
    fetchBalance();
    fetchHistory();

    const handleUpdate = () => {
      fetchBalance();
      fetchHistory();
    };

    window.addEventListener('wallet-updated', handleUpdate);
    return () => {
      window.removeEventListener('wallet-updated', handleUpdate);
    };
  }, [profile?.id]);

  const payWithRedirect = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setDepositOpen(false);
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-initiate`, {
        body: {
          purpose: "wallet_deposit",
          amount: numAmount,
          email: profile?.email || "customer@mtopup.shop",
          return_url: window.location.origin + "/payment/callback",
          momo_number: momoNumber,
        },
      });

      if (error || !data?.ok) {
        setPhase("error");
        setErrorMsg(data?.error || error?.message || "Failed to initiate deposit");
        return;
      }

      window.location.href = data.authorization_url;
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e?.message || "An unexpected error occurred.");
    }
  };

  const initiateDeposit = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (!amount || Number(amount) < 1) return toast({ title: "Enter a valid amount", variant: "destructive" });
    
    if (activeGateway === "theteller") {
      return payWithRedirect();
    }
    
    if (momoNumber.length < 9) return toast({ title: "Enter valid mobile number", variant: "destructive" });


    setPhase("processing");
    try {


      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
        body: {
          purpose: "wallet_deposit",
          amount: Number(amount),
          momo_number: momoNumber,
          momo_network: momoNetwork,
          email: profile?.email || "guest@mtopup.shop",
        },
      });

      if (error || data?.error) {
        const rawErr = data?.error ?? error?.message ?? "Deposit failed";
        setErrorMsg(typeof rawErr === "object" ? JSON.stringify(rawErr) : String(rawErr));
        return setPhase("error");
      }

      setOrderRef(data.reference);
      if (data.status === "send_otp") {
        setOtpTimer(60);
        return setPhase("otp");
      }
      setPhase("polling");
    } catch (e: any) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  };

  const resendDepositOtp = async () => {
    if (otpTimer > 0) return;
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
        body: {
          purpose: "wallet_deposit",
          amount: Number(amount),
          momo_number: momoNumber,
          momo_network: momoNetwork,
          email: profile?.email || "guest@mtopup.shop",
        }
      });
      if (error || data?.error) {
        setErrorMsg(data?.error || error?.message || "Failed to resend OTP");
        setPhase("error");
        return;
      }
      setOrderRef(data.reference);
      if (data.status === "send_otp") {
        setOtpTimer(60);
        setPhase("otp");
      } else {
        setPhase("polling");
      }
    } catch (e: any) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  };

  const submitOtp = async (overrideOtp?: string | React.MouseEvent) => {
    const finalOtp = typeof overrideOtp === 'string' ? overrideOtp : otp;
    if (!finalOtp || !orderRef) return;
    
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
        body: { action: "submit_otp", otp: finalOtp, reference: orderRef, purpose: "wallet_deposit", momo_number: "0", momo_network: "MTN" },
      });
      if (error || data?.error) {
        setErrorMsg(data?.error || "OTP failed");
        return setPhase("error");
      }
      if (data.status === "send_otp") return setPhase("otp");
      setPhase("polling");
    } catch (e: any) {
      setErrorMsg(e.message);
      setPhase("error");
    }
  };

  useEffect(() => {
    if (phase !== "polling" || !orderRef) return;
    let interval: any;
    let attempts = 0;

    const check = async () => {
      attempts++;
      if (attempts > 40) {
        setPhase("error");
        setErrorMsg("Timed out");
        return clearInterval(interval);
      }
      const { data } = await supabase.functions.invoke(`${activeGateway}-verify`, { body: { reference: orderRef } });
      if (data?.ok) {
        clearInterval(interval);
        setPhase("success");
        fetchBalance();
        fetchHistory();
      } else if (data?.error) {
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(data.error);
      } else if (data?.status && !["pending", "processing", "ongoing", "send_otp", "pay_offline"].includes(data.status.toLowerCase())) {
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(`Failed: ${data.status}`);
      }
    };
    interval = setInterval(check, 3000);
    return () => clearInterval(interval);
  }, [phase, orderRef]);

  return (
    <div className="space-y-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-soft">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center text-primary">
            <Wallet className="h-5 w-5" />
          </div>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Available Balance</h2>
        </div>
        
        <div className="flex items-end justify-between mt-4">
          <div className="text-4xl font-bold text-foreground tracking-tight">
            {loading ? <RefreshCcw className="animate-spin h-6 w-6 text-muted-foreground" /> : formatGHS(balance || 0)}
          </div>
          <Button onClick={() => setDepositOpen(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl h-11 px-6 font-bold shadow-sm">
            <Plus className="mr-2 h-4 w-4" /> Add Funds
          </Button>
        </div>
      </div>

      <div className="bg-card border border-border/60 rounded-2xl p-6 shadow-soft">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-foreground">History</h3>
          <div className="flex bg-secondary/50 p-1 rounded-xl border border-border/40">
            <button 
              onClick={() => setHistoryTab("transactions")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${historyTab === "transactions" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Transactions
            </button>
            <button 
              onClick={() => setHistoryTab("orders")}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${historyTab === "orders" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Orders
            </button>
          </div>
        </div>

        {loadingHistory ? (
          <div className="flex justify-center py-8"><RefreshCcw className="animate-spin h-6 w-6 text-muted-foreground" /></div>
        ) : historyTab === "transactions" ? (
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8 bg-secondary/30 rounded-lg border border-dashed border-border">
                No transactions yet.
              </div>
            ) : (
              transactions.map((tx) => {
                const isAddition = ['deposit', 'earning', 'refund', 'adjustment'].includes(tx.type);
                return (
                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${isAddition ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {isAddition ? <ArrowDownLeft className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground capitalize">{(tx.type || 'unknown').replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${isAddition ? "text-emerald-500" : "text-foreground"}`}>
                      {isAddition ? "+" : "-"}{formatGHS(tx.amount)}
                    </p>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase">{tx.status}</p>
                  </div>
                </div>
              )})
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {orders.length === 0 ? (
              <div className="text-sm text-muted-foreground text-center py-8 bg-secondary/30 rounded-lg border border-dashed border-border">
                No orders placed yet.
              </div>
            ) : (
              orders.map((ord) => (
                <div key={ord.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                      <Wallet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{ord.bundle?.size_label} - {ord.network?.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-xs text-muted-foreground font-mono">{ord.recipient_phone}</p>
                        {ord.payment_reference?.startsWith("WP-") && (
                          <span className="inline-flex items-center gap-0.5 rounded bg-primary/10 px-1 py-0.5 text-[8px] font-semibold text-primary uppercase tracking-wider">
                            <Wallet className="h-2 w-2" /> Wallet
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">{formatGHS(ord.sell_price)}</p>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      ord.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' :
                      ord.status === 'failed' ? 'bg-rose-500/10 text-rose-500' :
                      'bg-amber-500/10 text-amber-500'
                    }`}>
                      {ord.status}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <Dialog open={depositOpen} onOpenChange={(v) => { if (!v && phase !== 'polling') { setDepositOpen(false); setPhase("idle"); } }}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Fund Wallet</DialogTitle>
            <DialogDescription>Top up your balance instantly via Mobile Money.</DialogDescription>
          </DialogHeader>

          {phase === "idle" && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Amount to Deposit (GHS)</label>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="50.00" className="h-12 text-lg font-bold rounded-lg" />
              </div>

              {Number(amount) > 0 && (
                <div className="bg-secondary/30 p-3 rounded-lg border border-border space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Deposit Amount</span>
                    <span className="font-medium">GH₵{Number(amount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Payment Fee (3%)</span>
                    <span className="font-medium">GH₵{(Number(amount) * 0.03).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-border">
                    <span className="text-foreground">Total to Pay</span>
                    <span className="text-emerald-500">GH₵{(Number(amount) * 1.03).toFixed(2)}</span>
                  </div>
                </div>
              )}

                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">Mobile Money Number</label>
                  <div className="flex gap-2">
                    <select className="w-[90px] h-12 rounded-lg border border-border bg-background text-sm" value={momoNetwork} onChange={e => setMomoNetwork(e.target.value)}>
                      <option value="MTN">MTN</option>
                      <option value="TELECEL">Telecel</option>
                      <option value="AIRTELTIGO">AT</option>
                    </select>
                    <Input value={momoNumber} onChange={e => setMomoNumber(e.target.value)} placeholder="024 XXX XXXX" className="flex-1 h-12 rounded-lg" />
                  </div>
                </div>
              <Button
                onClick={initiateDeposit}
                disabled={!amount || Number(amount) < 1 || momoNumber.length < 9}
                className="w-full h-12 mt-2 rounded-lg"
              >
                Pay GH₵{(Number(amount || 0) * 1.03).toFixed(2)}
              </Button>
            </div>
          )}

          {(phase === "processing" || phase === "polling") && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <RefreshCcw className="h-10 w-10 animate-spin text-muted-foreground" />
              <p className="font-semibold text-foreground">{phase === "processing" ? "Initializing..." : "Waiting for authorization..."}</p>
            </div>
          )}

          {phase === "otp" && (
            <div className="py-6 text-center animate-in fade-in zoom-in duration-300">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 border border-primary/20">
                <Lock className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground">Verification Required</h3>
              <p className="mt-1 text-sm font-medium text-muted-foreground max-w-[260px] mx-auto">
                Enter the OTP sent to {momoNumber}
              </p>

              <div className="mt-6 max-w-[260px] mx-auto space-y-4">
                <div className="flex justify-center pb-2">
                  <InputOTP
                    maxLength={6}
                    value={otp}
                    onChange={(val) => {
                      setOtp(val);
                      if (val.length === 6 && phase === "otp") {
                        submitOtp(val);
                      }
                    }}
                  >
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-12 w-10 rounded-lg border border-border bg-background text-lg font-bold shadow-soft transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex items-center justify-between px-1 pt-1">
                  <Button
                    variant="ghost"
                    onClick={() => { setPhase("idle"); setOtp(""); }}
                    className="h-auto p-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    Cancel
                  </Button>
                  {otpTimer > 0 ? (
                    <span className="text-xs text-muted-foreground">Resend in {otpTimer}s</span>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={resendDepositOtp}
                      className="h-auto p-0 text-xs text-primary font-semibold hover:underline"
                    >
                      Resend OTP
                    </Button>
                  )}
                </div>

                {/* Visible submit button to allow manual submission */}
                <div className="mt-6">
                  <Button
                    id="btn-wallet-otp-submit"
                    onClick={() => submitOtp()}
                    disabled={otp.length < 4}
                    className="w-full h-12 rounded-xl"
                  >
                    Verify OTP
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500" />
              <div>
                <h3 className="font-bold text-xl text-foreground">Deposit Successful!</h3>
                <p className="text-muted-foreground mt-1">Your wallet balance has been updated.</p>
              </div>
              <Button onClick={() => { setDepositOpen(false); setPhase("idle"); }} variant="outline" className="mt-4">Close</Button>
            </div>
          )}

          {phase === "error" && (
            <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive font-bold text-2xl">!</div>
              <div>
                <h3 className="font-bold text-xl text-foreground">Deposit Failed</h3>
                <p className="text-destructive mt-1 font-medium">{errorMsg}</p>
              </div>
              <Button onClick={() => setPhase("idle")} variant="outline" className="mt-4">Try Again</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
