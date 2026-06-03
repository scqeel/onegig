import { useState, useEffect } from "react";
import { Wallet, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatGHS } from "@/lib/format";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface CustomerWalletProps {
  userId: string | null;
  agentSlug?: string | null;
  onBalanceChange?: (newBalance: number) => void;
  loadHistory?: () => void;
}

export function CustomerWallet({ userId, agentSlug, onBalanceChange, loadHistory }: CustomerWalletProps) {
  const [balance, setBalance] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");

  const [phase, setPhase] = useState<"idle" | "processing" | "otp" | "polling" | "success" | "error">("idle");
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);
  const { data: settings } = useSettings();
  const activeGateway = settings?.active_payment_gateway || "paystack";
  console.log("[CustomerWallet] activeGateway resolved to:", activeGateway);

  const loadBalance = async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    try {
      const { data } = await supabase.from("profiles").select("wallet_balance").eq("id", userId).maybeSingle();
      if (data) {
        setBalance(Number(data.wallet_balance));
        onBalanceChange?.(Number(data.wallet_balance));
      }
    } catch (e) {
      console.error("Error loading wallet balance:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBalance();

    const handleUpdate = () => {
      loadBalance();
    };

    window.addEventListener('wallet-updated', handleUpdate);
    return () => {
      window.removeEventListener('wallet-updated', handleUpdate);
    };
  }, [userId]);

  const initiateDeposit = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount < 1) {
      toast({ title: "Invalid amount", description: "Minimum top-up is GHS 1", variant: "destructive" });
      return;
    }
    if (momoNumber.length < 9) {
      toast({ title: "Invalid number", description: "Enter a valid mobile money number", variant: "destructive" });
      return;
    }

    setPhase("processing");
    try {


      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
        body: {
          purpose: "wallet_deposit",
          amount: numAmount,
          momo_number: momoNumber,
          momo_network: momoNetwork,
          email: "customer@mtopup.shop", // Generic fallback email
        }
      });
      
      if (error || data?.error) {
        const rawErr = data?.error ?? error?.message ?? "Top-up failed";
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
          email: "customer@mtopup.shop",
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
        loadBalance();
        window.dispatchEvent(new Event('wallet-updated'));
        if (loadHistory) loadHistory();
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

  if (!userId) return null;
  if (isLoading) return <div className="h-8 w-24 bg-white/10 animate-pulse rounded-md"></div>;

  return (
    <>
      <div 
        onClick={() => setIsTopupOpen(true)}
        className="flex items-center gap-2 bg-gradient-to-r from-emerald-500/20 to-emerald-600/20 border border-emerald-500/30 px-4 py-2 rounded-xl cursor-pointer hover:bg-emerald-500/30 transition-all hover:scale-105 active:scale-95"
      >
        <Wallet className="w-4 h-4 text-emerald-400" />
        <span className="font-bold text-emerald-50">{formatGHS(balance)}</span>
        <Plus className="w-3 h-3 text-emerald-400 opacity-70" />
      </div>

      <Dialog open={isTopupOpen} onOpenChange={(v) => { if (!v && phase !== 'polling') { setIsTopupOpen(false); setPhase("idle"); } }}>
        <DialogContent className="sm:max-w-md bg-slate-900 border-slate-800 text-white rounded-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-400" />
              Top up Wallet
            </DialogTitle>
            <p className="text-sm text-slate-400">Top up your balance instantly via Mobile Money.</p>
          </DialogHeader>
          
          {phase === "idle" && (
            <div className="space-y-4 py-4">
              <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 text-center">
                <p className="text-slate-400 text-sm mb-1">Current Balance</p>
                <h3 className="text-3xl font-bold text-white">{formatGHS(balance)}</h3>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Amount to Deposit (GHS)</label>
                <Input
                  type="number"
                  placeholder="e.g. 50"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="bg-slate-950 border-slate-800 h-12 text-lg focus:ring-emerald-500 focus:border-emerald-500"
                />
                <p className="text-xs text-slate-500">A 3% Paystack processing fee will be applied.</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-300">Mobile Money Number</label>
                <div className="flex gap-2">
                  <select 
                    className="w-[100px] h-12 rounded-lg border-slate-800 bg-slate-950 text-sm text-white px-3 border outline-none focus:ring-emerald-500 focus:border-emerald-500" 
                    value={momoNetwork} 
                    onChange={e => setMomoNetwork(e.target.value)}
                  >
                    <option value="MTN">MTN</option>
                    <option value="TELECEL">Telecel</option>
                    <option value="AIRTELTIGO">AT</option>
                  </select>
                  <Input 
                    value={momoNumber} 
                    onChange={e => setMomoNumber(e.target.value)} 
                    placeholder="024 XXX XXXX" 
                    className="flex-1 bg-slate-950 border-slate-800 h-12 focus:ring-emerald-500 focus:border-emerald-500" 
                  />
                </div>
              </div>
              
              <Button 
                onClick={initiateDeposit} 
                disabled={!amount || momoNumber.length < 9}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-lg mt-2"
              >
                Pay GH₵{(Number(amount || 0) * 1.03).toFixed(2)}
              </Button>
            </div>
          )}

          {(phase === "processing" || phase === "polling") && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-10 w-10 animate-spin text-slate-400" />
              <p className="font-semibold text-slate-300">{phase === "processing" ? "Initializing..." : "Waiting for authorization prompt..."}</p>
            </div>
          )}

          {phase === "otp" && (
            <div className="py-6 text-center animate-in fade-in zoom-in duration-300">
              <h3 className="text-xl font-black text-white">Verification Required</h3>
              <p className="mt-1 text-sm font-medium text-slate-400 max-w-[260px] mx-auto">
                Enter the OTP sent to {momoNumber}
              </p>
              
              <div className="mt-6 max-w-[260px] mx-auto space-y-4">
                <Input 
                  value={otp} 
                  onChange={(e) => {
                    setOtp(e.target.value);
                    if (e.target.value.length >= 4) {
                      // Note: usually 6 digits, but depending on provider could be different. We wait for user to hit verify.
                    }
                  }}
                  placeholder="Enter OTP"
                  className="h-12 bg-slate-950 border-slate-800 text-center text-xl tracking-[0.5em] font-black focus:ring-emerald-500 focus:border-emerald-500"
                />
                
                <div className="flex items-center justify-between px-1 pt-1">
                  <Button
                    variant="ghost"
                    onClick={() => { setPhase("idle"); setOtp(""); }}
                    className="h-auto p-0 text-xs font-bold text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </Button>
                  {otpTimer > 0 ? (
                    <span className="text-xs text-slate-500">Resend in {otpTimer}s</span>
                  ) : (
                    <Button
                      variant="ghost"
                      onClick={resendDepositOtp}
                      className="h-auto p-0 text-xs text-emerald-500 font-bold hover:text-emerald-400"
                    >
                      Resend OTP
                    </Button>
                  )}
                </div>
                
                <div className="mt-6">
                  <Button 
                    onClick={() => submitOtp()} 
                    disabled={otp.length < 4}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  >
                    Verify OTP
                  </Button>
                </div>
              </div>
            </div>
          )}

          {phase === "success" && (
            <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="h-16 w-16 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold text-2xl">✓</div>
              <div>
                <h3 className="font-bold text-xl text-white">Deposit Successful!</h3>
                <p className="text-slate-400 mt-1">Your wallet balance has been updated.</p>
              </div>
              <Button onClick={() => { setIsTopupOpen(false); setPhase("idle"); }} variant="outline" className="mt-4 border-slate-700 hover:bg-slate-800">Close</Button>
            </div>
          )}

          {phase === "error" && (
            <div className="py-10 flex flex-col items-center justify-center space-y-4 text-center">
              <div className="h-16 w-16 rounded-full bg-rose-500/20 flex items-center justify-center text-rose-500 font-bold text-2xl">!</div>
              <div>
                <h3 className="font-bold text-xl text-white">Deposit Failed</h3>
                <p className="text-rose-400 mt-1 font-medium">{errorMsg}</p>
              </div>
              <Button onClick={() => setPhase("idle")} variant="outline" className="mt-4 border-slate-700 hover:bg-slate-800">Try Again</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
