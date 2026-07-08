import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { Confetti } from "@/components/Confetti";
import { ArrowRight, CheckCircle2, Lock, RefreshCcw, Tv, AlertTriangle, ChevronDown, Smartphone } from "lucide-react";
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

type Phase = "select" | "lookup" | "processing" | "polling" | "delivering" | "success" | "error";

interface Props {
  agentSlug?: string;
  onSuccess?: () => void;
}

export function PayBillsFlow({ agentSlug, onSuccess }: Props) {
  const { user } = useAuth();
  const { settings } = useSettings();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("select");
  const [billType, setBillType] = useState<"DSTV" | "GOTV" | "STARTIMES" | "ECG">("DSTV");
  const [accountNumber, setAccountNumber] = useState("");
  const [amount, setAmount] = useState("");
  
  // Verification states
  const [isValidating, setIsValidating] = useState(false);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [validatedAmount, setValidatedAmount] = useState<number | null>(null);
  const [receiptPhone, setReceiptPhone] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "momo">("momo");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [payWithSameNumber, setPayWithSameNumber] = useState(true);

  const [savedMeters, setSavedMeters] = useState<any[]>([]);
  const [meterAlias, setMeterAlias] = useState("");
  const [isSavingMeter, setIsSavingMeter] = useState(false);

  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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
  const fetchSavedMeters = async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase
        .from("saved_meters")
        .select("*")
        .eq("provider", billType)
        .order("alias", { ascending: true });
      if (!error && data) {
        setSavedMeters(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSavedMeters();
  }, [user, billType]);

  const handleSaveMeter = async () => {
    if (!user || !accountNumber || !meterAlias) return;
    setIsSavingMeter(true);
    try {
      const { error } = await supabase.from("saved_meters").insert({
        user_id: user.id,
        meter_number: accountNumber,
        alias: meterAlias,
        provider: billType,
        customer_name: customerName
      });

      if (error) {
        toast({ title: "Error saving account", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Account Saved!", description: `"${meterAlias}" has been added to your favorites.` });
        setMeterAlias("");
        fetchSavedMeters();
      }
    } catch (e: any) {
      toast({ title: "Error saving account", description: e.message, variant: "destructive" });
    } finally {
      setIsSavingMeter(false);
    }
  };
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

  const resetLookup = () => {
    setCustomerName(null);
    setValidatedAmount(null);
  };

  const handleValidateAccount = async () => {
    if (!accountNumber) {
      toast({ title: "Account Number Required", variant: "destructive" });
      return;
    }

    setIsValidating(true);
    setErrorMsg(null);
    resetLookup();

    try {
      const isEcg = billType === "ECG";
      const { data, error } = await supabase.functions.invoke("payment-lookup", {
        body: isEcg 
          ? { action: "ecg_lookup", accountNumber }
          : { action: "validate", customerNumber: accountNumber, billType }
      });

      if (error || !data || data.success === false) {
        toast({ 
          title: "Account Lookup Failed", 
          description: data?.error || error?.message || "Verify your card/meter number and try again.", 
          variant: "destructive" 
        });
      } else {
        setCustomerName(data.customerName || "VALIDATED ACCOUNT");
        if (data.validatedAmount !== undefined && data.validatedAmount > 0) {
          setValidatedAmount(Number(data.validatedAmount));
          setAmount(String(data.validatedAmount));
        } else {
          setValidatedAmount(null);
        }
      }
    } catch (e: any) {
      toast({ title: "Lookup Error", description: e.message, variant: "destructive" });
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartCheckout = () => {
    if (!customerName) {
      toast({ title: "Account Not Verified", description: "Please verify your account/meter number first.", variant: "destructive" });
      return;
    }

    const amt = Number(amount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid Amount", description: "Please enter a positive payment amount.", variant: "destructive" });
      return;
    }

    const rawReceiptPhone = receiptPhone.replace(/\D/g, "");
    if (rawReceiptPhone.length < 9) {
      toast({ title: "Receipt Phone Required", description: "Provide a valid phone number to receive confirmation SMS.", variant: "destructive" });
      return;
    }

    if (paymentMethod === "wallet" && walletBalance !== null && walletBalance < amt) {
      toast({ title: "Insufficient Balance", description: `Your wallet balance is GHS ${walletBalance.toFixed(2)}. Bill cost is GHS ${amt.toFixed(2)}.`, variant: "destructive" });
      return;
    }

    setCheckoutOpen(true);
  };

  const executeCheckout = async () => {
    setCheckoutOpen(false);
    setPhase("processing");
    setErrorMsg(null);

    const amt = Number(amount);
    const rawReceiptPhone = receiptPhone.replace(/\D/g, "");

    if (paymentMethod === "wallet") {
      setAuthMessage("Processing bill payment via wallet...");
      const { data, error } = await supabase.functions.invoke("wallet-pay", {
        body: {
          type: "bill",
          recipient_phone: accountNumber, // meter or card number
          amount: amt,
          bill_type: billType,
          sender_name: customerName,
          agent_slug: agentSlug ?? null,
          // Extra payload details
          customer_phone: rawReceiptPhone,
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

    const payingPhone = payWithSameNumber ? receiptPhone : momoNumber;
    if (paymentMethod === "momo" && (!payingPhone || payingPhone.replace(/\D/g, "").length < 9)) {
      toast({ title: "Enter mobile money number", variant: "destructive" });
      setPhase("error");
      setErrorMsg("Mobile money number is required.");
      return;
    }

    const detectNetwork = (p: string) => {
      let num = p.replace(/\D/g, "");
      if (num.startsWith("233")) num = "0" + num.substring(3);
      const pfx = num.substring(0, 3);
      if (["024", "054", "055", "059", "025", "053"].includes(pfx)) return "MTN";
      if (["020", "050"].includes(pfx)) return "TELECEL";
      if (["027", "057", "026", "056"].includes(pfx)) return "AT";
      return "MTN";
    };

    const resolvedMomoNetwork = payWithSameNumber ? detectNetwork(receiptPhone) : momoNetwork;
    const resolvedMomoNumber = payWithSameNumber ? rawReceiptPhone : momoNumber.replace(/\D/g, "");

    // Direct Mobile Money Payment
    setAuthMessage("Initializing secure payment prompt...");
    const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
      body: {
        purpose: "order",
        type: "bill",
        recipient_phone: accountNumber, // card or meter
        amount: amt,
        bill_type: billType,
        sender_name: customerName,
        agent_slug: agentSlug ?? null,
        momo_number: resolvedMomoNumber,
        momo_network: resolvedMomoNetwork === "TELECEL" ? "VDF" : (resolvedMomoNetwork === "AT" ? "ATL" : "MTN"),
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
        <h2 className="text-2xl font-bold mb-2 text-white">Payment Completed!</h2>
        <p className="text-muted-foreground mb-6">
          Your utility payment of <span className="text-white font-semibold">{formatGHS(Number(amount))}</span> for <span className="text-white font-semibold">{billType} ({accountNumber})</span> is processing successfully.
        </p>
        {orderRef && (
          <div className="bg-slate-900/60 border border-slate-800 rounded-lg p-3 mb-6 inline-block font-mono text-xs text-slate-400">
            Receipt: {orderRef}
          </div>
        )}
        <Button 
          onClick={() => {
            setAmount("");
            setAccountNumber("");
            setReceiptPhone("");
            resetLookup();
            setPhase("select");
          }}
          className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-lg"
        >
          Pay Another Bill
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="glass-panel text-center py-12 px-6 max-w-md mx-auto animate-fade-in border border-rose-500/20">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-rose-500/10 text-rose-400 mb-6 border border-rose-500/20 animate-pulse">
          <Tv className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-3 text-white">Payment Failed</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
          {errorMsg || "An error occurred while processing your utility payment. Please try again."}
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
          {phase === "processing" ? "Processing payment..." : phase === "polling" ? "Awaiting authorization..." : "Completing billing..."}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {authMessage || "This will take just a few moments. Please check your phone for prompt approval."}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-white/15 bg-slate-950/50 backdrop-blur-2xl p-6 sm:p-8 max-w-md mx-auto rounded-[2rem] shadow-[0_8px_32px_0_rgba(0,0,0,0.6)] relative overflow-hidden animate-fade-in">
      <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-36 h-36 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-400/20 to-violet-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)]">
          <Tv className="w-6 h-6 animate-pulse" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white leading-tight">Pay Bills</h2>
          <p className="text-xs text-white/60 mt-0.5 font-semibold">DSTV, GOTV, StarTimes & ECG Prepaid</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Bill Type Selector */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2.5 ml-1">Select Provider</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: "DSTV", label: "DSTV", activeClass: "bg-gradient-to-br from-sky-400 to-blue-600 text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] border-transparent" },
              { id: "GOTV", label: "GOTV", activeClass: "bg-gradient-to-br from-emerald-400 to-green-600 text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] border-transparent" },
              { id: "STARTIMES", label: "StarTimes", activeClass: "bg-gradient-to-br from-orange-400 to-rose-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.3)] border-transparent" },
              { id: "ECG", label: "ECG Prepaid", activeClass: "bg-gradient-to-br from-yellow-400 to-amber-500 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.3)] border-transparent" }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setBillType(p.id as any);
                  resetLookup();
                }}
                className={cn(
                  "py-2.5 px-1 rounded-2xl border text-center font-extrabold text-xs transition-all duration-150",
                  billType === p.id 
                    ? p.activeClass
                    : "border-white/10 bg-white/[0.03] text-white/80 hover:text-white hover:bg-white/[0.08] hover:border-white/20"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Saved Accounts list */}
        {savedMeters.length > 0 && (
          <div className="pb-1 animate-in fade-in duration-300">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/50 block mb-1.5 ml-1">Saved Accounts</label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {savedMeters.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setAccountNumber(m.meter_number);
                    setCustomerName(m.customer_name || "");
                  }}
                  className="py-1.5 px-3 rounded-xl border border-white/[0.08] bg-white/[0.02] text-white/80 hover:text-white hover:bg-white/[0.05] hover:border-white/20 text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5"
                >
                  <span className="text-[10px]">⭐</span>
                  <span>{m.alias}</span>
                  <span className="text-[10px] text-white/40">({m.meter_number})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card/Meter Number Input */}
        <div>
          <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2 ml-1">
            {billType === "ECG" ? "Meter Number" : "Smartcard / IUC Number"}
          </label>
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder={billType === "ECG" ? "e.g. 70013245710" : "e.g. 8226349986"}
              value={accountNumber}
              onChange={(e) => {
                setAccountNumber(e.target.value);
                resetLookup();
              }}
              className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/40 flex-1 font-mono rounded-2xl h-12 font-semibold focus:border-indigo-500/70 focus:ring-indigo-500/15 focus:bg-white/[0.05] transition-all duration-300"
            />
            <Button
              type="button"
              onClick={handleValidateAccount}
              disabled={isValidating || !accountNumber}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs px-4 rounded-2xl h-12 shadow-lg shadow-indigo-950/20"
            >
              {isValidating ? (
                <RefreshCcw className="w-4 h-4 animate-spin" />
              ) : (
                "Verify"
              )}
            </Button>
          </div>
        </div>

        {/* Validated Information Card */}
        {customerName && (
          <div className="bg-white/[0.02] border border-white/10 rounded-2xl p-4 space-y-2 animate-fade-in">
            <div className="text-xs text-white/80 flex justify-between">
              <span>Customer Name:</span>
              <span className="font-bold text-white uppercase">{customerName}</span>
            </div>
            {validatedAmount !== null && (
              <div className="text-xs text-white/80 flex justify-between">
                <span>Account Balance:</span>
                <span className="font-bold text-indigo-400">{formatGHS(validatedAmount)}</span>
              </div>
            )}
          </div>
        )}

        {customerName && user && !savedMeters.some(m => m.meter_number === accountNumber) && (
          <div className="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-3 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Save Account?</span>
              <button
                type="button"
                onClick={handleSaveMeter}
                disabled={isSavingMeter || !meterAlias}
                className="text-[10px] font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-900 disabled:text-slate-650 text-white py-1.5 px-2.5 rounded-lg transition-all"
              >
                {isSavingMeter ? "Saving..." : "Save Now"}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Name/Alias e.g. Home Meter, Shop DSTV"
                value={meterAlias}
                onChange={(e) => setMeterAlias(e.target.value)}
                className="bg-slate-900/60 border-white/5 text-white placeholder:text-white/30 h-8 text-xs font-semibold rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Amount Input */}
        {customerName && (
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2 ml-1">Payment Amount (GHS)</label>
            <Input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/40 rounded-2xl h-12 font-semibold focus:border-indigo-500/70 focus:ring-indigo-500/15 focus:bg-white/[0.05] transition-all duration-300"
            />
          </div>
        )}

        {/* Receipt Phone Number */}
        {customerName && (
          <div>
            <label className="text-[11px] font-black uppercase tracking-widest text-white/80 block mb-2 ml-1">SMS Notification Phone Number</label>
            <Input
              type="tel"
              placeholder="e.g. 0241234567"
              value={receiptPhone}
              onChange={(e) => setReceiptPhone(e.target.value)}
              className="bg-white/[0.02] border-white/10 text-white placeholder:text-white/40 rounded-2xl h-12 font-semibold focus:border-indigo-500/70 focus:ring-indigo-500/15 focus:bg-white/[0.05] transition-all duration-300"
            />
          </div>
        )}

        {/* Payment Method Selector */}
        {customerName && user && walletBalance !== null && (
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

        {customerName ? (
          <Button
            onClick={handleStartCheckout}
            disabled={!amount || !receiptPhone}
            className="w-full bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-750 text-white py-6 rounded-2xl text-base font-black tracking-wide shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:shadow-[0_0_35px_rgba(99,102,241,0.45)] hover:scale-[1.02] active:scale-[0.98] mt-2 transition-all duration-300"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        ) : (
          <div className="p-4 bg-white/[0.02] border border-white/10 rounded-2xl flex items-start gap-2.5 mt-2">
            <Tv className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/70 leading-normal font-medium">
              Enter your Smartcard or Meter Number and click <span className="font-black text-white">Verify</span> to retrieve owner details before making a payment.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="bg-slate-950/95 border border-white/10 backdrop-blur-2xl text-white max-w-sm rounded-[2rem] p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center text-white">Confirm Bill Payment</DialogTitle>
            <DialogDescription className="text-center text-slate-400 text-sm">
              Verify your utility payment details before executing.
            </DialogDescription>
          </DialogHeader>

          <div className="bg-white/[0.03] border border-white/5 rounded-2xl p-4 my-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Provider:</span>
              <span className="font-semibold text-white">{billType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Card / Meter #:</span>
              <span className="font-mono font-semibold text-white">{accountNumber}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Owner Name:</span>
              <span className="font-semibold text-white uppercase text-xs">{customerName}</span>
            </div>
            <div className="flex justify-between text-sm border-t border-white/5 pt-3">
              <span className="text-slate-400">Total Price:</span>
              <span className="font-bold text-indigo-400 text-base">{formatGHS(Number(amount))}</span>
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
                  <Smartphone className="h-4 w-4 text-indigo-400 shrink-0" />
                  <span>Request prompt on notification number: <span className="font-mono text-white">{receiptPhone}</span></span>
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    <div className="relative w-[90px] shrink-0">
                      <select 
                        className="w-full h-11 rounded-xl border border-white/[0.08] bg-slate-900/60 pl-3 pr-7 text-xs font-semibold shadow-inner outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all cursor-pointer appearance-none text-white"
                        value={momoNetwork}
                        onChange={(e) => setMomoNetwork(e.target.value)}
                      >
                        <option value="MTN" className="bg-slate-900 text-white">MTN</option>
                        <option value="TELECEL" className="bg-slate-900 text-white">Telecel</option>
                        <option value="AIRTELTIGO" className="bg-slate-900 text-white">AT</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    </div>
                    <div className="relative flex-1 group">
                      <Input
                        inputMode="tel"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        placeholder="e.g. 024 123 4567"
                        className="h-11 w-full rounded-xl border border-white/[0.08] bg-slate-900/60 pl-3 pr-8 text-xs font-semibold shadow-sm transition-all duration-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 text-white"
                      />
                      {isVerifying && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <span className="block h-3.5 w-3.5 rounded-full border-2 border-slate-300 border-t-indigo-500 animate-spin" />
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

                  {isSamePhoneNumber(receiptPhone, momoNumber) && (
                    <div className="mt-1.5 text-[10px] font-bold px-3 py-1.5 bg-red-950/30 text-red-400 rounded-xl border border-red-900/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="shrink-0 text-red-500">⚠️</span>
                      <span className="leading-tight">Notification number cannot be the same as the paying MoMo number. Please use a different number to pay.</span>
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
                  isSamePhoneNumber(receiptPhone, momoNumber) || 
                  accountName === "Unknown Account" || 
                  accountName === "Account not found"
                )
              }
              className="flex-1 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white font-semibold shadow-lg"
            >
              Pay Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
