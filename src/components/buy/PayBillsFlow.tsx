import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS, isSamePhoneNumber } from "@/lib/format";
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
import { OrderSummary } from "@/components/buy/OrderSummary";

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
      <div className="rounded-[1.75rem] border border-border bg-card text-center py-12 px-6 max-w-md mx-auto animate-fade-in relative overflow-hidden">
        <Confetti />
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 mb-6">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <h2 className="text-2xl font-bold mb-2 text-foreground">Payment Completed!</h2>
        <p className="text-muted-foreground mb-6">
          Your utility payment of <span className="text-foreground font-semibold">{formatGHS(Number(amount))}</span> for <span className="text-foreground font-semibold">{billType} ({accountNumber})</span> is processing successfully.
        </p>
        {orderRef && (
          <div className="bg-background border border-border rounded-lg p-3 mb-6 inline-block font-mono text-xs text-muted-foreground">
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
          className="w-full"
        >
          Pay Another Bill
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-[1.75rem] border border-destructive/20 bg-card text-center py-12 px-6 max-w-md mx-auto animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-6">
          <Tv className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-3 text-foreground">Payment Failed</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
          {errorMsg || "An error occurred while processing your utility payment. Please try again."}
        </p>
        <Button onClick={() => setPhase("select")} variant="outline" className="w-full">
          Try Again
        </Button>
      </div>
    );
  }

  if (phase === "processing" || phase === "polling" || phase === "delivering") {
    return (
      <div className="rounded-[1.75rem] border border-border bg-card text-center py-16 px-6 max-w-md mx-auto animate-fade-in">
        <div className="relative w-20 h-20 mx-auto mb-8">
          <div className="absolute inset-0 rounded-full border-4 border-primary/15" />
          <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-primary">
            <RefreshCcw className="w-8 h-8" />
          </div>
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {phase === "processing" ? "Processing payment..." : phase === "polling" ? "Awaiting authorization..." : "Completing billing..."}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {authMessage || "This will take just a few moments. Please check your phone for prompt approval."}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6 sm:p-8 max-w-md mx-auto rounded-[1.75rem] relative overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Tv className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground leading-tight">Pay Bills</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-semibold">DSTV, GOTV, StarTimes & ECG Prepaid</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Bill Type Selector */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2.5 ml-1">Select Provider</label>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: "DSTV", label: "DSTV" },
              { id: "GOTV", label: "GOTV" },
              { id: "STARTIMES", label: "StarTimes" },
              { id: "ECG", label: "ECG Prepaid" }
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setBillType(p.id as any);
                  resetLookup();
                }}
                className={cn(
                  "py-2.5 px-1 rounded-xl border text-center font-semibold text-xs transition-colors duration-150",
                  billType === p.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
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
            <label className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground block mb-1.5 ml-1">Saved Accounts</label>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {savedMeters.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setAccountNumber(m.meter_number);
                    setCustomerName(m.customer_name || "");
                  }}
                  className="py-1.5 px-3 rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-accent text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5"
                >
                  <span className="text-[10px]">⭐</span>
                  <span>{m.alias}</span>
                  <span className="text-[10px] text-muted-foreground/70">({m.meter_number})</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Card/Meter Number Input */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2 ml-1">
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
              className="flex-1 font-mono rounded-xl h-12 font-semibold"
            />
            <Button
              type="button"
              onClick={handleValidateAccount}
              disabled={isValidating || !accountNumber}
              className="text-xs px-4 rounded-xl h-12"
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
          <div className="bg-background border border-border rounded-xl p-4 space-y-2 animate-fade-in">
            <div className="text-xs text-muted-foreground flex justify-between">
              <span>Customer Name:</span>
              <span className="font-semibold text-foreground uppercase">{customerName}</span>
            </div>
            {validatedAmount !== null && (
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Account Balance:</span>
                <span className="font-semibold text-primary">{formatGHS(validatedAmount)}</span>
              </div>
            )}
          </div>
        )}

        {customerName && user && !savedMeters.some(m => m.meter_number === accountNumber) && (
          <div className="bg-background border border-border rounded-xl p-3 space-y-2 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Save Account?</span>
              <button
                type="button"
                onClick={handleSaveMeter}
                disabled={isSavingMeter || !meterAlias}
                className="text-[10px] font-semibold uppercase tracking-wider bg-primary hover:bg-primary/90 disabled:bg-secondary disabled:text-muted-foreground text-primary-foreground py-1.5 px-2.5 rounded-lg transition-colors"
              >
                {isSavingMeter ? "Saving..." : "Save Now"}
              </button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Name/Alias e.g. Home Meter, Shop DSTV"
                value={meterAlias}
                onChange={(e) => setMeterAlias(e.target.value)}
                className="h-8 text-xs font-semibold rounded-lg"
              />
            </div>
          </div>
        )}

        {/* Amount Input */}
        {customerName && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2 ml-1">Payment Amount (GHS)</label>
            <Input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-xl h-12 font-semibold"
            />
          </div>
        )}

        {/* Receipt Phone Number */}
        {customerName && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2 ml-1">SMS Notification Phone Number</label>
            <Input
              type="tel"
              placeholder="e.g. 0241234567"
              value={receiptPhone}
              onChange={(e) => setReceiptPhone(e.target.value)}
              className="rounded-xl h-12 font-semibold"
            />
          </div>
        )}

        {/* Payment Method Selector */}
        {customerName && user && walletBalance !== null && (
          <div>
            <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2.5 ml-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("wallet")}
                className={cn(
                  "p-3.5 rounded-xl border text-left flex flex-col justify-between transition-colors duration-300",
                  paymentMethod === "wallet"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xs font-semibold">API Wallet</span>
                <span className={cn("text-[10px] mt-1.5 font-medium", paymentMethod === "wallet" ? "opacity-80" : "opacity-70")}>
                  Bal: {formatGHS(walletBalance)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("momo")}
                className={cn(
                  "p-3.5 rounded-xl border text-left flex flex-col justify-between transition-colors duration-300",
                  paymentMethod === "momo"
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                <span className="text-xs font-semibold">Mobile Money</span>
                <span className={cn("text-[10px] mt-1.5 font-medium", paymentMethod === "momo" ? "opacity-80" : "opacity-70")}>
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
            size="lg"
            className="w-full rounded-xl mt-2"
          >
            <span>Proceed to Payment</span>
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>
        ) : (
          <div className="p-4 bg-background border border-border rounded-xl flex items-start gap-2.5 mt-2">
            <Tv className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-normal font-medium">
              Enter your Smartcard or Meter Number and click <span className="font-semibold text-foreground">Verify</span> to retrieve owner details before making a payment.
            </p>
          </div>
        )}
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="bg-card border border-border max-w-sm rounded-[1.75rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center text-foreground">Confirm Bill Payment</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              Verify your utility payment details before executing.
            </DialogDescription>
          </DialogHeader>

          <OrderSummary
            className="my-2"
            rows={[
              { label: "Provider", value: billType },
              { label: "Card / Meter #", value: accountNumber },
              { label: "Owner Name", value: <span className="uppercase">{customerName}</span> },
              { label: "Total Price", value: formatGHS(Number(amount)), emphasis: true },
            ]}
          />

          {paymentMethod === "momo" && (
            <div className="space-y-3 pt-0.5 mb-4 animate-in fade-in duration-300">
              {/* Toggle for same number vs different number */}
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                  MoMo Payment Number
                </span>
                <div className="flex gap-1.5 bg-secondary p-1 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      setPayWithSameNumber(true);
                      setMomoNumber("");
                    }}
                    className={cn(
                      "px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-md transition-colors duration-300",
                      payWithSameNumber
                        ? "bg-background text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground"
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
                      "px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider rounded-md transition-colors duration-300",
                      !payWithSameNumber
                        ? "bg-background text-foreground shadow-soft"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Different
                  </button>
                </div>
              </div>

              {payWithSameNumber ? (
                <div className="text-[11px] font-semibold text-muted-foreground bg-background p-3 rounded-xl border border-border flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-primary shrink-0" />
                  <span>Request prompt on notification number: <span className="font-mono text-foreground">{receiptPhone}</span></span>
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    <div className="relative w-[90px] shrink-0">
                      <select
                        className="w-full h-11 rounded-xl border border-border bg-background pl-3 pr-7 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer appearance-none"
                        value={momoNetwork}
                        onChange={(e) => setMomoNetwork(e.target.value)}
                      >
                        <option value="MTN">MTN</option>
                        <option value="TELECEL">Telecel</option>
                        <option value="AIRTELTIGO">AT</option>
                      </select>
                      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    </div>
                    <div className="relative flex-1 group">
                      <Input
                        inputMode="tel"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        placeholder="e.g. 024 123 4567"
                        className="h-11 w-full rounded-xl border border-border bg-background pl-3 pr-8 text-xs font-semibold transition-all duration-300 focus:border-primary focus:ring-4 focus:ring-primary/10"
                      />
                      {isVerifying && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <span className="block h-3.5 w-3.5 rounded-full border-2 border-border border-t-primary animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>

                  {accountName && !isVerifying && (
                    <div className="mt-1.5 text-[10px] font-semibold px-3 py-1.5 bg-emerald-500/5 text-emerald-500 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="truncate">{accountName}</span>
                    </div>
                  )}

                  {isSamePhoneNumber(receiptPhone, momoNumber) && (
                    <div className="mt-1.5 text-[10px] font-semibold px-3 py-1.5 bg-destructive/5 text-destructive rounded-xl border border-destructive/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="shrink-0">⚠️</span>
                      <span className="leading-tight">Notification number cannot be the same as the paying MoMo number. Please use a different number to pay.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setCheckoutOpen(false)} className="flex-1 rounded-xl">
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
              className="flex-1 rounded-xl"
            >
              Pay Now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
