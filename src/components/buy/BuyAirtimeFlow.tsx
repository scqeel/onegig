import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { Confetti } from "@/components/Confetti";
import { ArrowRight, CheckCircle2, Lock, RefreshCcw, Zap, ChevronDown, Smartphone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const isSamePhoneNumber = (num1: string, num2: string) => {
  const clean1 = num1.replace(/\D/g, "");
  const clean2 = num2.replace(/\D/g, "");
  if (!clean1 || !clean2) return false;
  return clean1.slice(-9) === clean2.slice(-9);
};

type Phase = "select" | "processing" | "polling" | "delivering" | "success" | "error";

interface Props {
  agentSlug?: string;
  defaultPhone?: string;
  brandColor?: string;
  onSuccess?: () => void;
}

export function BuyAirtimeFlow({ agentSlug, defaultPhone = "", brandColor, onSuccess }: Props) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();
  
  const [phase, setPhase] = useState<Phase>("select");
  const [network, setNetwork] = useState<"MTN" | "TELECEL" | "AT">("MTN");
  const [phone, setPhone] = useState(defaultPhone);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "momo">("momo");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [payWithSameNumber, setPayWithSameNumber] = useState(true);

  const activeGateway = settings?.active_gateway || "paystack";

  useEffect(() => {
    if (user) {
      fetchWalletBalance();
      setPaymentMethod("wallet");
    } else {
      setPaymentMethod("momo");
    }
  }, [user]);

  useEffect(() => {
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233") && num.length > 9) {
      num = "0" + num.slice(3);
    } else if (num.startsWith("00233") && num.length > 11) {
      num = "0" + num.slice(5);
    } else if (!num.startsWith("0") && num.length === 9) {
      num = "0" + num;
    }
    
    if (num.length >= 3) {
      const pfx = num.substring(0, 3);
      let detected: "MTN" | "TELECEL" | "AT" | null = null;
      if (["024", "054", "055", "059", "025", "053"].includes(pfx)) detected = "MTN";
      if (["020", "050"].includes(pfx)) detected = "TELECEL";
      if (["027", "057", "026", "056"].includes(pfx)) detected = "AT";
      
      if (detected && detected !== network) {
        setNetwork(detected);
      }
    }
  }, [phone, network]);

  useEffect(() => {
    if (network) {
      setMomoNetwork(network);
    }
  }, [network]);

  useEffect(() => {
    const num = momoNumber.replace(/\D/g, "");
    if (num.length >= 10 && checkoutOpen && paymentMethod === "momo" && !payWithSameNumber) {
      setAccountName(null);
      setIsVerifying(true);
      const timer = setTimeout(async () => {
        try {
          const { data } = await supabase.functions.invoke("paystack-resolve", {
            body: { momo_number: num, momo_network: momoNetwork }
          });
          if (data?.ok && data?.account_name) {
            setAccountName(data.account_name);
          } else {
            setAccountName(data?.error ? "Account not found" : "Unknown Account");
          }
        } catch (e) {
          setAccountName("Unknown Account");
        } finally {
          setIsVerifying(false);
        }
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setAccountName(null);
      setIsVerifying(false);
    }
  }, [momoNumber, momoNetwork, checkoutOpen, paymentMethod]);

  const fetchWalletBalance = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.rpc("get_wallet_balance", { _user_id: user.id });
      if (!error) {
        setWalletBalance(Number(data || 0));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartCheckout = () => {
    const rawPhone = phone.replace(/\D/g, "");
    if (rawPhone.length < 9) {
      toast({ title: "Invalid recipient number", description: "Please enter a valid Ghanaian phone number.", variant: "destructive" });
      return;
    }
    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", description: "Please enter a positive amount to top up.", variant: "destructive" });
      return;
    }

    if (paymentMethod === "wallet" && walletBalance !== null && walletBalance < amt) {
      toast({ title: "Insufficient Balance", description: `Your wallet balance is GHS ${walletBalance.toFixed(2)}. Airtime cost is GHS ${amt.toFixed(2)}.`, variant: "destructive" });
      return;
    }

    setCheckoutOpen(true);
  };

  const executeCheckout = async () => {
    setCheckoutOpen(false);
    setPhase("processing");
    setErrorMsg(null);

    const rawPhone = phone.replace(/\D/g, "");
    const amt = Number(amount);

    if (paymentMethod === "wallet") {
      setAuthMessage("Processing wallet purchase...");
      const { data, error } = await supabase.functions.invoke("wallet-pay", {
        body: {
          type: "airtime",
          recipient_phone: rawPhone,
          amount: amt,
          network_code: network,
          agent_slug: agentSlug ?? null,
        },
      });

      if (error || !data?.ok) {
        setErrorMsg(data?.error || error?.message || "Wallet payment failed");
        setPhase("error");
        return;
      }

      setOrderRef(data.reference || null);
      window.dispatchEvent(new Event('wallet-updated'));
      setPhase("delivering");
      setTimeout(() => {
        setPhase("success");
        if (onSuccess) onSuccess();
      }, 3000);
      return;
    }

    // Direct mobile money checkout
    setAuthMessage("Initializing secure payment prompt...");
    const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
      body: {
        purpose: "order",
        type: "airtime",
        recipient_phone: rawPhone,
        amount: amt,
        network_code: network,
        agent_slug: agentSlug ?? null,
        momo_number: momoNumber.replace(/\D/g, ""),
        momo_network: momoNetwork === "TELECEL" ? "VDF" : (momoNetwork === "AT" ? "ATL" : "MTN"),
      },
    });

    if (error || data?.error) {
      setPhase("error");
      setErrorMsg(data?.error || error?.message || "Payment initialization failed");
      return;
    }

    setOrderRef(data.reference);
    setAuthMessage(data?.message || "Please check your phone for the mobile money prompt to authorize payment.");
    setPhase("polling");
  };

  // Status Polling for Mobile Money Payment
  useEffect(() => {
    if (phase !== "polling" || !orderRef) return;

    let interval: any;
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;
      if (attempts > 40) {
        setPhase("error");
        setErrorMsg("Payment validation timed out. Please verify your transaction status in your wallet or retry.");
        return clearInterval(interval);
      }

      const { data, error } = await supabase.functions.invoke(`${activeGateway}-verify`, {
        body: { reference: orderRef }
      });

      if (error) {
        setAuthMessage("Network issue while validating status. Retrying...");
      } else if (data) {
        if (data.ok) {
          setPhase("success");
          if (onSuccess) onSuccess();
          clearInterval(interval);
        } else if (["pending", "processing", "ongoing", "pay_offline"].includes(data.status?.toLowerCase())) {
          setAuthMessage(data.message || "Please authorize the mobile money prompt on your phone...");
        } else {
          setPhase("error");
          setErrorMsg(data.message || data.error || "Mobile money transaction failed.");
          clearInterval(interval);
        }
      }
    };

    interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [phase, orderRef]);

  if (phase === "success") {
    return (
      <div className="glass-panel text-center py-12 px-6 max-w-md mx-auto animate-fade-in relative overflow-hidden">
        <Confetti />
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 mb-6 border border-emerald-500/30">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-white">Purchase Successful!</h2>
        <p className="text-muted-foreground mb-6">
          Your top-up of <span className="text-white font-semibold">{formatGHS(Number(amount))}</span> airtime to <span className="text-white font-semibold">{phone}</span> is completed.
        </p>
        {orderRef && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 mb-6 inline-block font-mono text-xs text-slate-400">
            Receipt: {orderRef}
          </div>
        )}
        <Button 
          onClick={() => {
            setAmount("");
            setPhone(defaultPhone);
            setPhase("select");
          }}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg"
        >
          Buy More Airtime
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="glass-panel text-center py-12 px-6 max-w-md mx-auto animate-fade-in border border-rose-500/20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mb-6 border border-rose-500/20 animate-pulse">
          <Zap className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-3 text-white">Transaction Failed</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
          {errorMsg || "An error occurred while processing your airtime purchase. Please try again."}
        </p>
        <Button 
          onClick={() => setPhase("select")}
          className="w-full bg-gradient-to-r from-rose-500 to-orange-600 hover:from-rose-600 hover:to-orange-700 text-white shadow-lg"
        >
          Try Again
        </Button>
      </div>
    );
  }

  if (phase === "processing" || phase === "polling" || phase === "delivering") {
    return (
      <div className="glass-panel text-center py-16 px-6 max-w-md mx-auto animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-emerald-500/10" />
          <div className="absolute inset-0 rounded-full border-4 border-t-emerald-500 animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-emerald-400">
            <RefreshCcw className="w-8 h-8 animate-pulse" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {phase === "processing" ? "Processing payment..." : phase === "polling" ? "Awaiting authorization..." : "Delivering airtime..."}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {authMessage || "This will take just a few moments. Please do not close this window."}
        </p>
      </div>
    );
  }

  const getFocusRingColor = () => {
    if (network === "MTN") return "focus:border-[#ffd700]/70 focus:ring-[#ffd700]/15";
    if (network === "TELECEL") return "focus:border-red-500/70 focus:ring-red-500/15";
    if (network === "AT") return "focus:border-indigo-500/70 focus:ring-indigo-500/15";
    return "focus:border-emerald-500/70 focus:ring-emerald-500/15";
  };

  return (
    <div className="border border-white/15 bg-slate-950/50 backdrop-blur-2xl p-6 sm:p-8 max-w-md mx-auto rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] relative overflow-hidden animate-fade-in">
      {/* Background glowing blobs */}
      <div className="absolute -top-10 -right-10 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/20 to-orange-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]">
          <Zap className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight leading-tight">Buy Airtime</h2>
          <p className="text-xs text-white/60 mt-0.5 font-semibold">Instant airtime reload to all networks</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Network Selector */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2.5 ml-1">Select Network</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "MTN", label: "MTN", activeClass: "bg-gradient-to-br from-[#ffd700] to-[#ffa500] text-slate-950 shadow-[0_0_20px_rgba(255,215,0,0.35)] border-transparent scale-105" },
              { id: "TELECEL", label: "Telecel", activeClass: "bg-gradient-to-br from-[#ff3b30] to-[#cc0000] text-white shadow-[0_0_20px_rgba(255,59,48,0.35)] border-transparent scale-105" },
              { id: "AT", label: "AirtelTigo", activeClass: "bg-gradient-to-br from-[#6366f1] to-[#4338ca] text-white shadow-[0_0_20px_rgba(99,102,241,0.35)] border-transparent scale-105" }
            ].map((net) => (
              <button
                key={net.id}
                type="button"
                onClick={() => setNetwork(net.id as any)}
                className={cn(
                  "py-3 rounded-2xl border text-center font-extrabold text-xs transition-all duration-300",
                  network === net.id 
                    ? net.activeClass
                    : "border-white/10 bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                )}
              >
                {net.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient Phone */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2 ml-1">Recipient Number</label>
          <div className="relative">
            <Input
              type="tel"
              placeholder="e.g. 0241234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={cn(
                "bg-white/[0.02] border-white/10 text-white placeholder:text-white/40 pr-10 rounded-2xl h-12 font-semibold tracking-wide focus:bg-white/[0.05] transition-all duration-300",
                getFocusRingColor()
              )}
            />
          </div>
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2 ml-1">Amount (GHS)</label>
          <Input
            type="number"
            min="1"
            step="1"
            placeholder="Min 1 GHS"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={cn(
              "bg-white/[0.02] border-white/10 text-white placeholder:text-white/40 rounded-2xl h-12 font-semibold focus:bg-white/[0.05] transition-all duration-300",
              getFocusRingColor()
            )}
          />
        </div>

        {/* Payment Method (If logged in) */}
        {user && walletBalance !== null && (
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2.5 ml-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("wallet")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-300",
                  paymentMethod === "wallet" 
                    ? "bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border-transparent scale-102" 
                    : "border-white/10 bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                )}
              >
                <span className="text-xs font-black">API Wallet</span>
                <span className={cn("text-[10px] mt-1.5 font-bold", paymentMethod === "wallet" ? "text-white/80" : "text-white/50")}>
                  Bal: {formatGHS(walletBalance)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("momo")}
                className={cn(
                  "p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all duration-300",
                  paymentMethod === "momo" 
                    ? "bg-gradient-to-br from-[#10b981] to-[#059669] text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] border-transparent scale-102" 
                    : "border-white/10 bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                )}
              >
                <span className="text-xs font-black">Mobile Money</span>
                <span className={cn("text-[10px] mt-1.5 font-bold", paymentMethod === "momo" ? "text-white/80" : "text-white/50")}>
                  Momo prompt
                </span>
              </button>
            </div>
          </div>
        )}

        <Button
          onClick={handleStartCheckout}
          disabled={!phone || !amount}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white py-6 rounded-2xl text-base font-black tracking-wide shadow-[0_0_25px_rgba(16,185,129,0.25)] hover:shadow-[0_0_35px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] mt-4 transition-all duration-300"
        >
          <span>Continue</span>
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="bg-slate-950/95 border border-white/10 backdrop-blur-2xl text-white max-w-sm rounded-[2rem] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center text-white">Confirm Top-Up</DialogTitle>
            <DialogDescription className="text-center text-slate-400 text-sm">
              Please double check the details below. This transaction is irreversible.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 my-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Network:</span>
              <span className="font-semibold text-white">{network}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Recipient Phone:</span>
              <span className="font-mono font-semibold text-white">{phone}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-white/5 pt-3">
              <span className="text-slate-400">Total Price:</span>
              <span className="font-bold text-emerald-400 text-base">{formatGHS(Number(amount))}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Paying with:</span>
              <span className="font-semibold text-slate-300">
                {paymentMethod === "wallet" ? "API Wallet Balance" : `${activeGateway === "theteller" ? "theTeller" : "Paystack"} Mobile Money`}
              </span>
            </div>
          </div>

          {paymentMethod === "momo" && (
            <div className="space-y-3 pt-0.5 mb-4 animate-in fade-in duration-300">
              {/* Toggle for same number vs different number */}
              <div className="flex items-center justify-between pb-1 border-b border-white/[0.04]">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  MoMo Payment Number
                </span>
                <div className="flex gap-1.5 bg-slate-900/60 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setPayWithSameNumber(true);
                      setMomoNumber("");
                    }}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-300",
                      payWithSameNumber
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-400"
                    )}
                  >
                    Same Number
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPayWithSameNumber(false);
                      setMomoNetwork(network);
                    }}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all duration-300",
                      !payWithSameNumber
                        ? "bg-slate-800 text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-400"
                    )}
                  >
                    Different
                  </button>
                </div>
              </div>

              {payWithSameNumber ? (
                <div className="text-[11px] font-bold text-slate-400 bg-white/[0.02] p-3 rounded-xl border border-white/[0.04] flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-emerald-400 shrink-0" />
                  <span>Request prompt on recipient number: <span className="font-mono text-white">{phone}</span></span>
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    <div className="relative w-[90px] shrink-0">
                      <select 
                        className="w-full h-11 rounded-xl border border-white/[0.08] bg-slate-900/60 pl-3 pr-7 text-xs font-semibold shadow-inner outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all cursor-pointer appearance-none text-white"
                        value={momoNetwork}
                        onChange={(e) => setMomoNetwork(e.target.value as any)}
                      >
                        <option value="MTN" className="bg-slate-900 text-white">MTN</option>
                        <option value="TELECEL" className="bg-slate-900 text-white">Telecel</option>
                        <option value="AT" className="bg-slate-900 text-white">AT</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative flex-1 group">
                      <Input
                        inputMode="tel"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        placeholder="e.g. 024 123 4567"
                        className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/60 pl-3 pr-8 text-xs font-semibold shadow-sm transition-all duration-300 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 text-white"
                      />
                      {isVerifying && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <span className="block h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-emerald-500 animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {accountName && !isVerifying && (
                    <div className="mt-1.5 text-[10px] font-bold px-3 py-1.5 bg-emerald-950/30 text-emerald-400 rounded-xl border border-emerald-900/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="truncate">{accountName}</span>
                    </div>
                  )}

                  {isSamePhoneNumber(phone, momoNumber) && (
                    <div className="mt-1.5 text-[10px] font-bold px-3 py-1.5 bg-red-950/30 text-red-400 rounded-xl border border-red-900/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="shrink-0 text-red-500">⚠️</span>
                      <span className="leading-tight">Recipient number cannot be the same as the paying MoMo number. Please use a different number to pay.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} className="flex-1 rounded-xl border-white/10 bg-transparent hover:bg-white/5 hover:text-white text-slate-300">
              Cancel
            </Button>
            <Button 
              onClick={executeCheckout} 
              disabled={
                paymentMethod === "momo" && !payWithSameNumber && (
                  momoNumber.replace(/\D/g, "").length < 9 || 
                  isVerifying || 
                  isSamePhoneNumber(phone, momoNumber) || 
                  accountName === "Unknown Account" || 
                  accountName === "Account not found"
                )
              }
              className="flex-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow-lg"
            >
              Confirm & Pay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
