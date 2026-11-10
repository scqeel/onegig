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
import { NetworkTag } from "@/components/buy/BundleCard";
import { PaymentFailed, PaymentProgress, PaymentReceipt } from "@/components/checkout/PaymentScreens";
import { CheckoutSheet, MomoNumberFields } from "@/components/checkout/CheckoutSheet";
import { CompleteAccountModal } from "@/components/auth/CompleteAccountModal";
import { isAccountIncomplete } from "@/lib/accountCheck";

type Phase = "select" | "processing" | "polling" | "delivering" | "success" | "error";

interface Props {
  agentSlug?: string;
  defaultPhone?: string;
  brandColor?: string;
  onSuccess?: () => void;
}

export function BuyAirtimeFlow({ agentSlug, defaultPhone = "", brandColor, onSuccess }: Props) {
  const { user, profile } = useAuth();
  const { data: settings } = useSettings();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("select");
  const [network, setNetwork] = useState<"MTN" | "TELECEL" | "AT">("MTN");
  const [phone, setPhone] = useState(defaultPhone);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "momo">("momo");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [payWithSameNumber, setPayWithSameNumber] = useState(true);

  const activeGateway = settings?.active_payment_gateway || "paystack";

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

    if (user && isAccountIncomplete(user, profile)) {
      setCompleteModalOpen(true);
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
      <PaymentReceipt
        title="Purchase Successful"
        lead={<>Airtime top-up to <span className="font-semibold text-foreground">{phone}</span> is complete.</>}
        amount={formatGHS(Number(amount))}
        rows={[{ label: "Network", value: network }]}
        reference={orderRef}
        primary={{
          label: "Buy More Airtime",
          onClick: () => {
            setAmount("");
            setPhone(defaultPhone);
            setPhase("select");
          },
        }}
      />
    );
  }

  if (phase === "error") {
    return (
      <PaymentFailed
        title="Transaction Failed"
        message={errorMsg || "An error occurred while processing your airtime purchase. Please try again."}
        networkCode={paymentMethod === "momo" ? momoNetwork : null}
        onRetry={() => setPhase("select")}
      />
    );
  }

  if (phase === "processing" || phase === "polling" || phase === "delivering") {
    return <PaymentProgress stage={phase} message={authMessage} networkCode={momoNetwork} deliveringLabel="Delivering airtime" showApprovalHelp={paymentMethod === "momo"} />;
  }

  return (
    <div className="border border-border bg-card p-6 sm:p-8 max-w-md mx-auto rounded-2xl shadow-soft relative overflow-hidden animate-fade-in">
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

      {/* Checkout */}
      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        title="Confirm Top-Up"
        description="Please double check the details below. This transaction is irreversible."
        productLabel="Airtime"
        productName={formatGHS(Number(amount))}
        productTag={<NetworkTag code={network} />}
        rows={[
          { label: "Recipient Phone", value: phone },
          { label: "Paying with", value: paymentMethod === "wallet" ? "Wallet Balance" : "Mobile Money" },
        ]}
        total={formatGHS(Number(amount))}
        payLabel="Confirm & Pay"
        onPay={executeCheckout}
        payDisabled={
          paymentMethod === "momo" && !payWithSameNumber && (
            momoNumber.replace(/\D/g, "").length < 9 ||
            isVerifying ||
            isSamePhoneNumber(phone, momoNumber) ||
            accountName === "Unknown Account" ||
            accountName === "Account not found"
          )
        }
      >
        {paymentMethod === "momo" && (
          <MomoNumberFields
            sameNumber={payWithSameNumber}
            onSameNumberChange={(same) => {
              setPayWithSameNumber(same);
              if (same) setMomoNumber("");
              else setMomoNetwork(network);
            }}
            promptPhone={phone}
            network={momoNetwork}
            onNetworkChange={(value) => setMomoNetwork(value as typeof momoNetwork)}
            number={momoNumber}
            onNumberChange={setMomoNumber}
            atValue="AT"
            isVerifying={isVerifying}
            accountName={accountName}
            error={isSamePhoneNumber(phone, momoNumber) ? "Recipient number cannot be the same as the paying MoMo number. Please use a different number to pay." : null}
          />
        )}
      </CheckoutSheet>

      <CompleteAccountModal
        isOpen={completeModalOpen}
        onClose={() => setCompleteModalOpen(false)}
        onComplete={() => {
          setCompleteModalOpen(false);
          setCheckoutOpen(true);
        }}
      />
    </div>
  );
}
