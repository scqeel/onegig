import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS, isSamePhoneNumber } from "@/lib/format";
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
import { OrderSummary } from "@/components/buy/OrderSummary";

type Phase = "select" | "processing" | "polling" | "delivering" | "success" | "error";

interface Props {
  agentSlug?: string;
  defaultPhone?: string;
  brandColor?: string;
  onSuccess?: () => void;
}

export function BuyAirtimeFlow({ agentSlug, defaultPhone = "", brandColor, onSuccess }: Props) {
  const { user } = useAuth();
  const { data: settings } = useSettings();
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

    const payingPhone = payWithSameNumber ? phone : momoNumber;
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

    const resolvedMomoNetwork = payWithSameNumber ? detectNetwork(phone) : momoNetwork;
    const resolvedMomoNumber = payWithSameNumber ? rawPhone : momoNumber.replace(/\D/g, "");

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
        <h2 className="text-2xl font-bold mb-2 text-foreground">Purchase Successful!</h2>
        <p className="text-muted-foreground mb-6">
          Your top-up of <span className="text-foreground font-semibold">{formatGHS(Number(amount))}</span> airtime to <span className="text-foreground font-semibold">{phone}</span> is completed.
        </p>
        {orderRef && (
          <div className="bg-background border border-border rounded-lg p-3 mb-6 inline-block font-mono text-xs text-muted-foreground">
            Receipt: {orderRef}
          </div>
        )}
        <Button
          onClick={() => {
            setAmount("");
            setPhone(defaultPhone);
            setPhase("select");
          }}
          className="w-full"
        >
          Buy More Airtime
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="rounded-[1.75rem] border border-destructive/20 bg-card text-center py-12 px-6 max-w-md mx-auto animate-fade-in">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-destructive/10 text-destructive mb-6">
          <Zap className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold mb-3 text-foreground">Transaction Failed</h2>
        <p className="text-muted-foreground text-sm mb-6 max-w-xs mx-auto">
          {errorMsg || "An error occurred while processing your airtime purchase. Please try again."}
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
          {phase === "processing" ? "Processing payment..." : phase === "polling" ? "Awaiting authorization..." : "Delivering airtime..."}
        </h3>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {authMessage || "This will take just a few moments. Please do not close this window."}
        </p>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6 sm:p-8 max-w-md mx-auto rounded-[1.75rem] relative overflow-hidden animate-fade-in">
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Zap className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight leading-tight">Buy Airtime</h2>
          <p className="text-xs text-muted-foreground mt-0.5 font-semibold">Instant airtime reload to all networks</p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Network Selector */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2.5 ml-1">Select Network</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "MTN", label: "MTN" },
              { id: "TELECEL", label: "Telecel" },
              { id: "AT", label: "AirtelTigo" }
            ].map((net) => (
              <button
                key={net.id}
                type="button"
                onClick={() => setNetwork(net.id as any)}
                className={cn(
                  "py-3 rounded-xl border text-center font-semibold text-xs transition-colors duration-300",
                  network === net.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border bg-secondary text-muted-foreground hover:text-foreground"
                )}
              >
                {net.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recipient Phone */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2 ml-1">Recipient Number</label>
          <Input
            type="tel"
            placeholder="e.g. 0241234567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-xl h-12 font-semibold tracking-wide"
          />
        </div>

        {/* Amount Input */}
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground block mb-2 ml-1">Amount (GHS)</label>
          <Input
            type="number"
            min="1"
            step="1"
            placeholder="Min 1 GHS"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="rounded-xl h-12 font-semibold"
          />
        </div>

        {/* Payment Method (If logged in) */}
        {user && walletBalance !== null && (
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

        <Button
          onClick={handleStartCheckout}
          disabled={!phone || !amount}
          size="lg"
          className="w-full rounded-xl mt-4"
        >
          <span>Continue</span>
          <ArrowRight className="w-5 h-5 ml-2" />
        </Button>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="bg-card border border-border max-w-sm max-h-[90dvh] overflow-y-auto rounded-[1.75rem] p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-center text-foreground">Confirm Top-Up</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm">
              Please double check the details below. This transaction is irreversible.
            </DialogDescription>
          </DialogHeader>

          <OrderSummary
            className="my-2"
            rows={[
              { label: "Network", value: network },
              { label: "Recipient Phone", value: phone },
              { label: "Paying with", value: paymentMethod === "wallet" ? "API Wallet Balance" : `${activeGateway === "theteller" ? "theTeller" : "Paystack"} Mobile Money` },
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
                      setMomoNetwork(network);
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
                  <span>Request prompt on recipient number: <span className="font-mono text-foreground">{phone}</span></span>
                </div>
              ) : (
                <div className="space-y-1.5 pt-0.5 animate-in slide-in-from-top-2 duration-300">
                  <div className="flex gap-2">
                    <div className="relative w-[90px] shrink-0">
                      <select
                        className="w-full h-11 rounded-xl border border-border bg-background pl-3 pr-7 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer appearance-none"
                        value={momoNetwork}
                        onChange={(e) => setMomoNetwork(e.target.value as any)}
                      >
                        <option value="MTN">MTN</option>
                        <option value="TELECEL">Telecel</option>
                        <option value="AT">AT</option>
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

                  {isSamePhoneNumber(phone, momoNumber) && (
                    <div className="mt-1.5 text-[10px] font-semibold px-3 py-1.5 bg-destructive/5 text-destructive rounded-xl border border-destructive/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                      <span className="shrink-0">⚠️</span>
                      <span className="leading-tight">Recipient number cannot be the same as the paying MoMo number. Please use a different number to pay.</span>
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
                  isSamePhoneNumber(phone, momoNumber) ||
                  accountName === "Unknown Account" ||
                  accountName === "Account not found"
                )
              }
              className="flex-1 rounded-xl"
            >
              Confirm & Pay
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
