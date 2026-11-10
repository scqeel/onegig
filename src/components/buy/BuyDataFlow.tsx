import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNetworks, useBundles, BundleRow, NetworkRow } from "@/hooks/useNetworksAndBundles";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS, isSamePhoneNumber, parseEdgeFunctionError } from "@/lib/format";
import { Confetti } from "@/components/Confetti";
import { ArrowRight, CheckCircle2, Lock, RefreshCcw, Zap, ChevronDown, Smartphone, CreditCard } from "lucide-react";
import { VerifiedPhoneInput } from "@/components/VerifiedPhoneInput";
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
import { BundleCard, NetworkTag } from "@/components/buy/BundleCard";
import { PaymentFailed, PaymentOtp, PaymentProgress, PaymentReceipt } from "@/components/checkout/PaymentScreens";
import { CheckoutSheet, MomoNumberFields, PaymentMethodPicker, VerifiedName } from "@/components/checkout/CheckoutSheet";
import { CompleteAccountModal } from "@/components/auth/CompleteAccountModal";
import { isAccountIncomplete } from "@/lib/accountCheck";

type Phase = "select" | "processing" | "otp" | "polling" | "delivering" | "success" | "error";

interface Props {
  agentSlug?: string;
  priceOverrides?: Record<string, number>;
  defaultPhone?: string;
  brandColor?: string;
  onSuccess?: () => void;
}

function getNetStyle(code: string) {
  const c = code.toUpperCase();
  if (c === "MTN")
    return {
      idle: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:border-amber-500/60 hover:bg-amber-500/15",
      active: "border-amber-500 bg-amber-500 text-amber-950 font-bold shadow-soft",
      activeRing: "ring-2 ring-amber-500/40",
      cardIdle: "border-amber-500/25 bg-amber-500/5 text-amber-900 dark:text-amber-200 hover:bg-amber-500/10 transition-colors",
      cardActive: "border-amber-500 bg-amber-500 text-amber-950 shadow-soft ring-2 ring-amber-500/40",
    };
  if (c === "TELECEL")
    return {
      idle: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 hover:border-red-500/60 hover:bg-red-500/15",
      active: "border-red-500 bg-red-600 text-white font-bold shadow-soft",
      activeRing: "ring-2 ring-red-500/40",
      cardIdle: "border-red-500/25 bg-red-500/5 text-red-900 dark:text-red-200 hover:bg-red-500/10 transition-colors",
      cardActive: "border-red-500 bg-red-600 text-white shadow-soft ring-2 ring-red-500/40",
    };
  if (c === "AIRTELTIGO" || c === "AT")
    return {
      idle: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 hover:border-blue-500/60 hover:bg-blue-500/15",
      active: "border-blue-500 bg-blue-600 text-white font-bold shadow-soft",
      activeRing: "ring-2 ring-blue-500/40",
      cardIdle: "border-blue-500/25 bg-blue-500/5 text-blue-900 dark:text-blue-200 hover:bg-blue-500/10 transition-colors",
      cardActive: "border-blue-500 bg-blue-600 text-white shadow-soft ring-2 ring-blue-500/40",
    };

  return {
    idle: "border-border bg-secondary text-foreground hover:border-primary/40 hover:bg-primary/5",
    active: "border-primary bg-primary text-primary-foreground font-bold shadow-soft",
    activeRing: "ring-2 ring-primary/40",
    cardIdle: "border-border bg-secondary text-foreground hover:bg-primary/5 transition-colors",
    cardActive: "border-primary bg-primary text-primary-foreground shadow-soft ring-2 ring-primary/40",
  };
}

// Step indicator
function StepBar({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Network", "Bundle", "Pay"];
  return (
    <div className="mb-7 flex items-center gap-0">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all",
                  done
                    ? "bg-primary text-primary-foreground"
                    : active
                    ? "border-2 border-primary bg-primary/10 text-foreground"
                    : "border-2 border-border bg-background text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-foreground" : done ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div
                className={cn(
                  "mb-4 h-px flex-1 mx-2 transition-all",
                  done ? "bg-primary" : "bg-border"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export function BuyDataFlow({
  agentSlug,
  priceOverrides,
  defaultPhone,
  brandColor,
  onSuccess,
}: Props) {
  const nav = useNavigate();
  const { user, profile } = useAuth();
  const { data: settings } = useSettings();
  const activeGateway = settings?.active_payment_gateway || "paystack";
  console.log("[BuyDataFlow] activeGateway resolved to:", activeGateway);
  const { toast } = useToast();
  const { data: networks = [] } = useNetworks();
  const [network, setNetwork] = useState<NetworkRow | null>(null);
  const { data: bundles = [] } = useBundles(network?.id ?? null);
  const [bundle, setBundle] = useState<BundleRow | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "non-expiry" | "monthly">("all");
  const [phone, setPhone] = useState(defaultPhone || "");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState<string>("MTN");
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completeModalOpen, setCompleteModalOpen] = useState(false);
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [walletBalance, setWalletBalance] = useState(0);
  const [payWithWallet, setPayWithWallet] = useState(false);
  const [payWithSameNumber, setPayWithSameNumber] = useState(true);

  // Recipient Validation States
  const [recipientAccountName, setRecipientAccountName] = useState<string | null>(null);
  const [isVerifyingRecipient, setIsVerifyingRecipient] = useState(false);
  const [recipientNetworkError, setRecipientNetworkError] = useState<string | null>(null);

  const getNetworkFromPrefix = (num: string) => {
    const pfx = num.substring(0, 3);
    if (["024", "054", "055", "059", "025", "053"].includes(pfx)) return "MTN";
    if (["020", "050"].includes(pfx)) return "TELECEL";
    if (["027", "057", "026", "056"].includes(pfx)) return "AIRTELTIGO";
    return null;
  };

  useEffect(() => {
    if (checkoutOpen && profile?.id) {
      supabase.rpc("get_wallet_balance", { _user_id: profile.id }).then(({ data }) => {
        setWalletBalance(Number(data || 0));
      });
    }
  }, [checkoutOpen, profile?.id]);

  // Pre-select network from URL query string
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlNet = params.get("network");
    if (networks.length && !network) {
      if (urlNet) {
        const foundNet = networks.find(n => n.code.toUpperCase() === urlNet.toUpperCase());
        if (foundNet) {
          setNetwork(foundNet);
          return;
        }
      }
      setNetwork(networks[0]);
    }
  }, [networks, network]);

  // Pre-select bundle from URL query string once loaded
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlBundle = params.get("bundleLabel");
    if (urlBundle && bundles.length && !bundle) {
      const foundBundle = bundles.find(b => 
        b.size_label.toLowerCase().includes(urlBundle.toLowerCase()) ||
        urlBundle.toLowerCase().includes(b.size_label.toLowerCase())
      );
      if (foundBundle) {
        setBundle(foundBundle);
        setCheckoutOpen(true);
      }
    }
  }, [bundles, bundle]);

  useEffect(() => {
    if (network && network.code) setMomoNetwork(network.code);
  }, [network]);

  useEffect(() => {
    const num = momoNumber.replace(/\D/g, "");
    if (num.length >= 10 && checkoutOpen && !payWithWallet && !payWithSameNumber) {
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
  }, [momoNumber, momoNetwork, checkoutOpen, payWithWallet]);

  // Recipient Validation Logic
  useEffect(() => {
    let num = phone.replace(/\D/g, "");
    if (num.startsWith("233") && num.length > 9) {
      num = "0" + num.slice(3);
    } else if (num.startsWith("00233") && num.length > 11) {
      num = "0" + num.slice(5);
    } else if (!num.startsWith("0") && num.length === 9) {
      num = "0" + num;
    }

    setRecipientNetworkError(null);
    if (num.length >= 3) {
      const pfxNet = getNetworkFromPrefix(num);
      if (pfxNet && networks.length) {
        const found = networks.find(n => n.code.toUpperCase() === pfxNet || ((pfxNet as string) === "AT" && n.code.toUpperCase() === "AIRTELTIGO") || (pfxNet === "AIRTELTIGO" && n.code.toUpperCase() === "AT"));
        if (found && (!network || network.id !== found.id)) {
          setNetwork(found);
          setBundle(null);
        }
      }
    }

    if (num.length >= 3 && network) {
      const pfxNet = getNetworkFromPrefix(num);
      const expectedNet = network.code.toUpperCase();
      if (pfxNet) {
        if (pfxNet !== expectedNet && !(pfxNet === "AIRTELTIGO" && expectedNet === "AT") && !((pfxNet as string) === "AT" && expectedNet === "AIRTELTIGO")) {
          setRecipientNetworkError(`Warning: ${pfxNet} number detected for ${network.name} bundle.`);
        }
      }
    }
    
    if (num.length >= 10 && checkoutOpen && network && !recipientNetworkError) {
      setRecipientAccountName(null);
      setIsVerifyingRecipient(true);
      const timer = setTimeout(async () => {
        try {
          const { data } = await supabase.functions.invoke("paystack-resolve", {
            body: { momo_number: num, momo_network: network.code }
          });
          if (data?.ok && data?.account_name) {
            setRecipientAccountName(data.account_name);
          }
        } catch (e) {
          // Ignore
        } finally {
          setIsVerifyingRecipient(false);
        }
      }, 600);
      return () => clearTimeout(timer);
    } else {
      setRecipientAccountName(null);
      setIsVerifyingRecipient(false);
    }
  }, [phone, network, checkoutOpen, recipientNetworkError]);

  const priceFor = (b: BundleRow) =>
    priceOverrides && priceOverrides[b.id] != null
      ? priceOverrides[b.id]
      : Number(b.user_price ?? b.base_price ?? 0);

  const basePrice = bundle ? priceFor(bundle) : 0;
  const paymentFee = payWithWallet ? 0 : basePrice * 0.03;
  const finalPrice = basePrice + paymentFee;

  const reset = () => {
    setBundle(null);
    setPhase("select");
    setOrderRef(null);
    setErrorMsg(null);
    setAuthMessage(null);
    setOtp("");
    setCheckoutOpen(false);
  };

  const buy = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (!bundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }

    if (!payWithWallet && activeGateway === "theteller") {
      return payWithRedirect();
    }

    const payingPhone = payWithSameNumber ? phone : momoNumber;
    if (!payWithWallet && (!payingPhone || payingPhone.replace(/\D/g, "").length < 9)) {
      toast({ title: "Enter mobile money number", variant: "destructive" });
      return;
    }

    setCheckoutOpen(false);
    setPhase("processing");

    if (payWithWallet) {
      const { data, error } = await supabase.functions.invoke("wallet-pay", {
        body: {
          bundle_id: bundle.id,
          recipient_phone: phone.replace(/\D/g, ""),
          agent_slug: agentSlug ?? null,
        },
      });

      if (error || !data?.ok) {
        const errPayload = data?.error || error?.message || "Wallet payment failed";
        const errMsg = typeof errPayload === "object" ? JSON.stringify(errPayload) : errPayload;
        setErrorMsg(errMsg);
        setPhase("error");
        return;
      }

      setOrderRef(data.reference || null);
      window.dispatchEvent(new Event('wallet-updated'));
      setPhase("delivering");
      setTimeout(() => setPhase("success"), 3000);
      return;
    }


    const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
      body: {
        purpose: "order",
        recipient_phone: phone.replace(/\D/g, ""),
        bundle_id: bundle.id,
        agent_slug: agentSlug ?? null,
        momo_number: payWithSameNumber ? phone.replace(/\D/g, "") : momoNumber.replace(/\D/g, ""),
        momo_network: payWithSameNumber ? (network?.code || "MTN") : momoNetwork,
        email: profile?.email || "guest@mtopup.shop",
      },
    });

    if (error || data?.error) {
      setPhase("error");
      const msg = await parseEdgeFunctionError(error, data);
      setErrorMsg(msg);
      return;
    }

    if (data?.status === "send_otp") {
      setOrderRef(data.reference);
      setAuthMessage(data?.message || null);
      setPhase("otp");
      return;
    }

    setOrderRef(data.reference);
    setAuthMessage(data?.message || null);
    setPhase("polling");
  };
  const submitOtp = async (overrideOtp?: string | React.MouseEvent) => {
    const finalOtp = typeof overrideOtp === 'string' ? overrideOtp : otp;
    if (!finalOtp || !orderRef) return;
    setPhase("processing");
    
    const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
      body: {
        action: "submit_otp",
        otp: finalOtp,
        reference: orderRef,
        purpose: "order",
        momo_number: "0",
        momo_network: "MTN"
      },
    });

    if (error || data?.error) {
      setPhase("error");
      setErrorMsg(data?.error || error?.message || "Failed to submit OTP");
      return;
    }

    if (data?.status === "send_otp") {
      setPhase("otp");
      setErrorMsg(data?.message || "Incorrect OTP, please try again.");
      return;
    }

    setPhase("polling");
  };

  const payWithRedirect = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    if (!bundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }

    setCheckoutOpen(false);
    setPhase("processing");
    setAuthMessage("Preparing secure checkout page...");

    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-initiate`, {
        body: {
          purpose: "order",
          recipient_phone: phone.replace(/\D/g, ""),
          bundle_id: bundle.id,
          agent_slug: agentSlug ?? null,
          email: profile?.email || "guest@mtopup.shop",
          return_url: window.location.origin + `/track`,
          momo_number: payWithSameNumber ? phone.replace(/\D/g, "") : momoNumber.replace(/\D/g, ""),
        },
      });

      if (error || !data?.ok) {
        setPhase("error");
        setErrorMsg(data?.error || error?.message || "Failed to initialize secure checkout page");
        return;
      }

      setAuthMessage(`Redirecting to ${activeGateway === "theteller" ? "theTeller" : "Paystack"}...`);
      window.location.href = data.authorization_url;
    } catch (e: any) {
      setPhase("error");
      setErrorMsg(e?.message || "An unexpected error occurred.");
    }
  };

  useEffect(() => {
    if (phase !== "polling" || !orderRef) return;
    
    let interval: any;
    let attempts = 0;
    let isTransitioning = false;
 
    const checkStatus = async () => {
      if (isTransitioning) return;
      attempts++;
      if (attempts > 40) {
        setPhase("error");
        setErrorMsg("Payment timed out. Please try again.");
        return clearInterval(interval);
      }

      const { data, error } = await supabase.functions.invoke(`${activeGateway}-verify`, {
        body: { reference: orderRef }
      });

      if (error) {
        setAuthMessage("Network issue while checking status...");
      } else if (data) {
        if (["pending", "processing", "ongoing", "pay_offline"].includes(data.status?.toLowerCase())) {
          setAuthMessage(`Please check your phone to authorize the payment...`);
        } else if (data.status === "send_otp") {
          setAuthMessage("OTP is required to authorize the payment...");
        } else {
          setAuthMessage(`Processing payment status: ${data.status || 'verified'}...`);
        }
      }

      if (data?.ok) {
        isTransitioning = true;
        clearInterval(interval);
        setPhase("delivering");
        setTimeout(() => {
          setPhase("success");
        }, 3000);
      } else if (data?.error) {
        isTransitioning = true;
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(data.error);
      } else if (data?.status && !["pending", "processing", "ongoing", "send_otp", "pay_offline"].includes(data.status.toLowerCase())) {
        isTransitioning = true;
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(`Payment Failed: ${data.status}`);
      }
    };

    interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [phase, orderRef]);

  const accent = brandColor ?? "hsl(var(--primary))";
  const netStyle = getNetStyle(network?.code ?? "");
  const currentStep: 1 | 2 | 3 = !network ? 1 : !bundle ? 2 : 3;

  // ── Success state ──
  if (phase === "success") {
    return (
      <PaymentReceipt
        lead={
          <>
            Your <span className="font-semibold text-foreground">{bundle?.size_label}</span> is on its way to{" "}
            <span className="font-semibold text-foreground">{phone}</span>.
          </>
        }
        amount={formatGHS(finalPrice)}
        showDelivery
        rows={[
          { label: "Network", value: network?.name },
          { label: "Paid with", value: payWithWallet ? "Wallet" : `MoMo (${momoNetwork})` },
        ]}
        reference={orderRef}
        note="Delivery usually takes 10 - 60 minutes."
        primary={{
          label: onSuccess ? "Done" : "Track Order",
          onClick: () => {
            if (onSuccess) onSuccess();
            else nav(`/track?ref=${orderRef || phone.replace(/\D/g, "")}`);
          },
        }}
        secondary={{ label: "Buy Again", onClick: reset }}
      />
    );
  }

  // ── OTP state ──
  if (phase === "otp") {
    return (
      <PaymentOtp
        phone={momoNumber}
        value={otp}
        onChange={(val) => {
          setOtp(val);
          if (val.length === 6 && phase === "otp") submitOtp(val);
        }}
        onSubmit={() => submitOtp()}
        onCancel={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }}
        onResend={buy}
        error={errorMsg}
        submitId="btn-buy-otp-submit"
      />
    );
  }

  // ── Processing state ──
  if (phase === "processing" || phase === "polling" || phase === "delivering") {
    return (
      <PaymentProgress
        stage={phase}
        message={phase === "polling" ? authMessage : undefined}
        networkCode={momoNetwork}
        deliveringLabel="Sending your data"
        showApprovalHelp={!payWithWallet}
      />
    );
  }

  // ── Error state ──
  if (phase === "error") {
    return (
      <PaymentFailed
        message={errorMsg}
        networkCode={payWithWallet ? null : momoNetwork}
        onPayOnline={payWithRedirect}
        onRetry={() => setPhase("select")}
      />
    );
  }

  // ── Main select state ──
  return (
    <div className="space-y-8">
      <StepBar step={currentStep} />

      {/* ── Step 1: Network ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
            1
          </span>
          <p className="text-sm font-semibold text-foreground">Choose your network</p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {networks.map((n) => {
            const s = getNetStyle(n.code);
            const active = network?.id === n.id;
            return (
              <button
                type="button"
                key={n.id}
                onClick={() => {
                  setNetwork(n);
                  setBundle(null);
                }}
                className={cn(
                  "relative flex flex-col items-center gap-2 rounded-2xl border px-3 py-4 transition-all",
                  active ? cn(s.active, s.activeRing) : s.idle
                )}
              >
                {active && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                    <CheckCircle2 className="h-3 w-3 text-primary-foreground" />
                  </span>
                )}
                <span className="text-2xl">{n.logo_emoji}</span>
                <span className="text-xs font-semibold">{n.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Step 2: Bundles ── */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <span
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold transition-all",
              network
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}
          >
            2
          </span>
          <p className="text-sm font-semibold text-foreground">
            Choose a bundle
            {network && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                — {network.name}
              </span>
            )}
          </p>
        </div>

        {bundles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            {network ? "No bundles available for this network." : "Select a network above."}
          </div>
        ) : (
          <>
            {/* Category Filter Sub-tabs */}
            <div className="mb-4 flex gap-1 p-1 bg-secondary rounded-xl max-w-sm">
              {[
                { id: "all", label: "All" },
                { id: "non-expiry", label: "Non-Expiry" },
                { id: "monthly", label: "Regular/Monthly" }
              ].map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategoryFilter(cat.id as any)}
                  className={cn(
                    "flex-1 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg transition-colors duration-200",
                    categoryFilter === cat.id
                      ? "bg-background text-foreground shadow-soft"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {bundles.filter(b => {
              const isNonExpiry = b.size_label.toLowerCase().includes("non-expiry") || b.size_label.toLowerCase().includes("no-expiry");
              if (categoryFilter === "non-expiry") return isNonExpiry;
              if (categoryFilter === "monthly") return !isNonExpiry;
              return true;
            }).length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                No bundles match the selected filter.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {bundles
                  .filter(b => {
                    const isNonExpiry = b.size_label.toLowerCase().includes("non-expiry") || b.size_label.toLowerCase().includes("no-expiry");
                    if (categoryFilter === "non-expiry") return isNonExpiry;
                    if (categoryFilter === "monthly") return !isNonExpiry;
                    return true;
                  })
                  .map((b, i) => {
                    const active = bundle?.id === b.id;
                    const isPopular = i === 1;
                    const isBestValue = i === bundles.length - 1 && bundles.length > 2;
                    return (
                      <BundleCard
                        key={b.id}
                        networkCode={network?.code}
                        networkName={network?.name}
                        sizeLabel={b.size_label}
                        price={formatGHS(priceFor(b))}
                        active={active}
                        badge={isPopular ? "popular" : isBestValue ? "best" : undefined}
                        onClick={() => {
                          setBundle(b);
                          if (user && isAccountIncomplete(user, profile)) {
                            setCompleteModalOpen(true);
                          } else {
                            setCheckoutOpen(true);
                          }
                        }}
                      />
                    );
                  })}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Checkout ── */}
      <CheckoutSheet
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        title="Confirm Payment"
        description={`You are purchasing data for a ${network?.name ?? ""} number.`}
        productLabel={`${network?.name ?? ""} bundle`}
        productName={bundle?.size_label}
        productTag={<NetworkTag code={network?.code} />}
        rows={[
          { label: "Price", value: formatGHS(basePrice) },
          ...(!payWithWallet ? [{ label: "Processing Fee (3%)", value: formatGHS(paymentFee) }] : []),
        ]}
        total={formatGHS(finalPrice)}
        payLabel={`Pay ${formatGHS(finalPrice)}`}
        payIcon={payWithWallet ? <Lock className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
        onPay={buy}
        payDisabled={
          !bundle ||
          phone.replace(/\D/g, "").length < 9 ||
          !!recipientNetworkError ||
          (!payWithWallet && !payWithSameNumber && (
            momoNumber.replace(/\D/g, "").length < 9 ||
            isVerifying ||
            accountName === "Unknown Account" ||
            accountName === "Account not found" ||
            isSamePhoneNumber(phone, momoNumber)
          ))
        }
        footerExtra={
          !payWithWallet && activeGateway !== "theteller" ? (
            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              Issues with prompts?{" "}
              <button type="button" onClick={payWithRedirect} className="font-semibold text-foreground hover:underline">
                Pay via Web Page instead
              </button>
            </p>
          ) : undefined
        }
      >
        <div>
          <VerifiedPhoneInput value={phone} onChange={setPhone} networkCode={network?.code} label="Data Recipient" />
          {recipientAccountName && !isVerifyingRecipient && !recipientNetworkError && (
            <div className="mt-2"><VerifiedName name={recipientAccountName} /></div>
          )}
        </div>

        {profile && bundle && (
          <PaymentMethodPicker
            payWithWallet={payWithWallet}
            onChange={setPayWithWallet}
            balanceLabel={formatGHS(walletBalance)}
            walletDisabled={walletBalance < finalPrice}
            walletHint={
              agentSlug && finalPrice > Number(bundle.base_price) ? (
                <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  Earn {formatGHS(finalPrice - Number(bundle.base_price))} commission!
                </p>
              ) : undefined
            }
          />
        )}

        {!payWithWallet && (
          <MomoNumberFields
            sameNumber={payWithSameNumber}
            onSameNumberChange={(same) => {
              setPayWithSameNumber(same);
              if (same) setMomoNumber("");
              else if (network?.code) setMomoNetwork(network.code);
            }}
            promptPhone={phone}
            network={momoNetwork}
            onNetworkChange={setMomoNetwork}
            number={momoNumber}
            onNumberChange={setMomoNumber}
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
