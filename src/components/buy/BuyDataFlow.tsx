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

function getApprovalInstructions(netCode: string) {
  const code = String(netCode || "MTN").toUpperCase();
  if (code === "MTN") {
    return {
      shortcode: "*170#",
      steps: "Dial *170# > Option 6 (My Wallet) > Option 3 (Approvals) to approve."
    };
  }
  if (code === "TELECEL" || code === "VODAFONE" || code === "VODA") {
    return {
      shortcode: "*110#",
      steps: "Dial *110# > Option 4 (Make Payment) > Option 2 (My Approvals) to approve."
    };
  }
  return {
    shortcode: "*110#",
    steps: "Dial *110# and check your Approvals menu to authorize the payment."
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
                    ? "border-2 border-primary bg-primary/10 text-primary"
                    : "border-2 border-border bg-background text-muted-foreground"
                )}
              >
                {done ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-primary" : done ? "text-foreground" : "text-muted-foreground"
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
  const { profile } = useAuth();
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
        const found = networks.find(n => n.code.toUpperCase() === pfxNet || (pfxNet === "AT" && n.code.toUpperCase() === "AIRTELTIGO") || (pfxNet === "AIRTELTIGO" && n.code.toUpperCase() === "AT"));
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
        if (pfxNet !== expectedNet && !(pfxNet === "AIRTELTIGO" && expectedNet === "AT") && !(pfxNet === "AT" && expectedNet === "AIRTELTIGO")) {
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
      <div className="relative py-8 px-4 w-full max-w-md mx-auto animate-in fade-in zoom-in duration-500">
        <Confetti />
        
        {/* Receipt Card */}
        <div className="bg-card rounded-[1.75rem] border border-border overflow-hidden relative">
          <div className="p-8 pb-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10 mb-5">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-bold text-foreground tracking-tight">Payment Successful</h3>
            <p className="mt-3 text-sm font-medium text-muted-foreground">
              Your <span className="font-semibold text-foreground">{bundle?.size_label}</span> is on its way to
            </p>
            <div className="mt-2 inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-secondary text-lg font-bold text-foreground">
              {phone}
            </div>
          </div>

          <div className="px-8 pb-8">
            <div className="pt-6 border-t border-dashed border-border space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-medium">Payment Method</span>
                <span className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                  {payWithWallet ? (
                    <><div className="h-2 w-2 rounded-full bg-primary" /> Wallet</>
                  ) : (
                    <><div className="h-2 w-2 rounded-full bg-yellow-500" /> MoMo ({momoNetwork})</>
                  )}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground font-medium">Amount Paid</span>
                <span className="text-sm font-bold text-foreground">{formatGHS(finalPrice)}</span>
              </div>

              {orderRef && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-medium">Transaction Ref</span>
                  <span className="font-mono text-xs font-semibold text-muted-foreground uppercase">{orderRef.split('-')[0] + '...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-muted-foreground/80">
          Delivery usually takes 10 - 60 minutes.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <Button variant="outline" className="h-14 rounded-2xl" onClick={reset}>
            Buy Again
          </Button>
          <Button
            className="h-14 rounded-2xl"
            onClick={() => {
              if (onSuccess) onSuccess();
              else nav(`/track?ref=${orderRef}`);
            }}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ── OTP state ──
  if (phase === "otp") {
    return (
      <div className="py-10 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4 border border-primary/20">
          <Lock className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-2xl font-bold text-foreground">Verification Required</h3>
        <p className="mt-2 text-sm font-medium text-muted-foreground max-w-[280px] mx-auto">
          Please enter the OTP or Voucher Code sent to your mobile number ({momoNumber}).
        </p>

        {errorMsg && (
          <p className="mt-3 text-xs font-semibold text-destructive">{errorMsg}</p>
        )}

        <div className="mt-8 max-w-[280px] mx-auto space-y-5">
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
                    className="h-14 w-12 rounded-xl border border-border bg-background text-xl font-bold shadow-soft transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20"
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          <div className="flex items-center justify-between px-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }}
              className="h-auto p-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Cancel Order
            </Button>
            <Button
              variant="ghost"
              onClick={buy}
              className="h-auto p-0 text-xs text-primary font-semibold hover:underline"
            >
              Try again
            </Button>
          </div>
          {/* Visible submit button to allow manual submission */}
          <div className="mt-6">
            <Button
              id="btn-buy-otp-submit"
              onClick={() => submitOtp()}
              disabled={otp.length < 4}
              className="w-full h-12 rounded-xl"
            >
              Verify OTP
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Processing state ──
  if (phase === "processing" || phase === "polling" || phase === "delivering") {
    return (
      <div className="py-14 text-center space-y-8 animate-in fade-in duration-300">
        <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin [animation-duration:1.2s]" />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Zap className="h-7 w-7 text-primary" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold tracking-tight text-foreground flex items-center justify-center gap-2">
            {phase === "processing" && <span>Initiating Payment</span>}
            {phase === "polling" && <span>Awaiting Authorization</span>}
            {phase === "delivering" && <span>Sending Data Bundle</span>}
          </h3>

          {phase === "processing" && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-primary bg-primary/5 px-5 py-2.5 rounded-full border border-primary/20 max-w-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                A payment prompt is being sent to your phone. Please check your screen and enter PIN.
              </div>
            </div>
          )}

          {phase === "polling" && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-primary bg-primary/5 px-5 py-2.5 rounded-full border border-primary/20 max-w-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
                {authMessage || `Please check your phone (${momoNumber}) to authorize...`}
              </div>
            </div>
          )}

          {phase === "delivering" && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-500 bg-emerald-500/5 px-5 py-2.5 rounded-full border border-emerald-500/20">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Connecting to {network?.name} network...
              </div>
            </div>
          )}

          <p className="text-xs font-medium text-muted-foreground">
            Do not close this window. Your bundle will be delivered automatically.
          </p>
        </div>

        {(phase === "polling" || phase === "delivering") && (
          <div className="flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-primary/40 animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    );
  }

  // ── Error state ──
  if (phase === "error") {
    return (
      <div className="py-10 text-center animate-in fade-in zoom-in duration-300">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <RefreshCcw className="h-8 w-8 text-destructive animate-spin [animation-duration:10s]" />
        </div>
        <p className="mt-4 font-semibold text-destructive px-4 max-w-sm mx-auto">{errorMsg}</p>

        {/* USSD Manual Approval Alert */}
        <div className="mt-6 mx-auto max-w-sm rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 text-left">
          <div className="flex gap-3">
            <Smartphone className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-semibold text-amber-500 uppercase tracking-wider">Didn't receive the prompt?</h4>
              <p className="text-xs text-muted-foreground font-medium leading-relaxed">
                Sometimes telecom networks delay push notifications. You can manually authorize your payment:
              </p>
              <div className="mt-2 bg-background rounded-lg p-2.5 font-mono text-[11px] font-semibold text-foreground border border-border">
                {getApprovalInstructions(momoNetwork).steps}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-7 flex flex-col gap-3 max-w-[280px] mx-auto">
          <Button
            className="h-12 rounded-xl w-full flex items-center justify-center gap-2"
            onClick={payWithRedirect}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" ry="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            Pay via Secure Web Page
          </Button>
          <Button
            className="h-12 rounded-xl w-full"
            variant="outline"
            onClick={() => setPhase("select")}
          >
            Try Again
          </Button>
        </div>
      </div>
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
                      <button
                        type="button"
                        key={b.id}
                        onClick={() => {
                          setBundle(b);
                          setCheckoutOpen(true);
                        }}
                        className={cn(
                          "relative flex flex-col items-start rounded-2xl border px-4 py-4 text-left transition-all",
                          active ? netStyle.cardActive : netStyle.cardIdle
                        )}
                      >
                        {/* Badges */}
                        {isPopular && !active && (
                          <span className="absolute -top-2 left-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-primary-foreground z-10">
                            Popular
                          </span>
                        )}
                        {isBestValue && !active && (
                          <span className="absolute -top-2 left-3 rounded-full bg-success px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-success-foreground z-10">
                            Best Value
                          </span>
                        )}

                        <div className="flex w-full justify-between items-start mb-5">
                          <span className="text-[10px] font-bold uppercase opacity-70">{network?.name}</span>
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                          </div>
                        </div>

                        <span className="text-3xl font-bold leading-none tracking-tight">
                          {b.size_label}
                        </span>
                        <span className={cn("mt-1 text-xs font-medium opacity-80")}>
                          {network?.name} Bundle
                        </span>

                        <div className="mt-6 flex w-full items-end justify-between">
                          <span className={cn("text-xl font-bold tracking-tight")}>
                            {formatGHS(priceFor(b))}
                          </span>
                          <span className="text-[10px] font-semibold opacity-75">
                            1-5 min
                          </span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            )}
          </>
        )}
      </section>

      {/* ── Checkout Dialog ── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="w-[92vw] max-w-[370px] rounded-[1.75rem] border border-border bg-card p-0 overflow-hidden">
          {/* Header */}
          <div className="flex flex-col items-center justify-center pt-7 pb-3 px-5 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              {network ? (
                <span className="text-2xl">{network.logo_emoji}</span>
              ) : (
                <Zap className="h-5 w-5 text-primary" />
              )}
            </div>
            <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
              Confirm Payment
            </DialogTitle>
            <DialogDescription className="text-xs font-semibold text-muted-foreground mt-1">
              You are purchasing data for a <span className="text-primary font-semibold">{network?.name}</span> number.
            </DialogDescription>
          </div>

          <div className="px-5 space-y-4 pb-7">
            {/* Order summary */}
            {bundle && network && (
              <OrderSummary
                heading={{ eyebrow: `${network.name} Bundle`, title: bundle.size_label }}
                rows={[
                  { label: "Price", value: formatGHS(basePrice) },
                  ...(!payWithWallet ? [{ label: "Processing Fee (3%)", value: formatGHS(paymentFee) }] : []),
                  { label: "Total", value: formatGHS(finalPrice), emphasis: true },
                ]}
              />
            )}

            {/* Form */}
            <div className="space-y-3.5">
              {/* Recipient Input with Active DataHub Verification */}
              <VerifiedPhoneInput
                value={phone}
                onChange={setPhone}
                networkCode={network?.code}
                label="Data Recipient"
              />
                
              {recipientAccountName && !isVerifyingRecipient && !recipientNetworkError && (
                <div className="mt-1.5 text-[11px] font-semibold px-3 py-2 bg-emerald-500/5 text-emerald-500 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate">{recipientAccountName}</span>
                </div>
              )}

              {/* Momo inputs are hidden if paying with wallet */}
              {!payWithWallet && (
                <div className="space-y-3 pt-0.5 animate-in fade-in duration-300">
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
                          if (network?.code) setMomoNetwork(network.code);
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
                        <div className="relative w-[95px] shrink-0">
                          <select
                            className="w-full h-12 rounded-xl border border-border bg-background pl-3.5 pr-7 text-xs font-semibold outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer appearance-none"
                            value={momoNetwork}
                            onChange={(e) => setMomoNetwork(e.target.value)}
                          >
                            <option value="MTN">MTN</option>
                            <option value="TELECEL">Telecel</option>
                            <option value="AIRTELTIGO">AT</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                        </div>
                        <div className="relative flex-1 group">
                          <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground group-hover:text-primary group-focus-within:text-primary transition-colors duration-300" />
                          <Input
                            inputMode="tel"
                            value={momoNumber}
                            onChange={(e) => setMomoNumber(e.target.value)}
                            placeholder="e.g. 024 123 4567"
                            className="h-12 w-full rounded-xl border border-border bg-background pl-10 pr-4 text-sm font-semibold transition-all duration-300 focus:border-primary focus:ring-4 focus:ring-primary/10"
                          />
                          {isVerifying && (
                            <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                              <span className="block h-4 w-4 rounded-full border-2 border-border border-t-primary animate-spin" />
                            </div>
                          )}
                        </div>
                      </div>

                      {accountName && !isVerifying && (
                        <div className="mt-1.5 text-[11px] font-semibold px-3 py-2 bg-emerald-500/5 text-emerald-500 rounded-xl border border-emerald-500/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                          <span className="truncate">{accountName}</span>
                        </div>
                      )}

                      {isSamePhoneNumber(phone, momoNumber) && (
                        <div className="mt-1.5 text-[10px] font-semibold px-3 py-2 bg-destructive/5 text-destructive rounded-xl border border-destructive/20 flex items-center gap-1.5 animate-in slide-in-from-top-1 duration-200">
                          <span className="shrink-0">⚠️</span>
                          <span className="leading-tight">Recipient number cannot be the same as the paying MoMo number. Please use a different number to pay.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {profile && bundle && (
                <div
                  className={cn(
                    "mt-2 cursor-pointer rounded-2xl border border-border p-4 transition-colors duration-300 active:scale-[0.98]",
                    payWithWallet
                      ? "border-primary bg-primary/5"
                      : "bg-background hover:bg-accent",
                    walletBalance < finalPrice && "opacity-50 cursor-not-allowed border-dashed"
                  )}
                  onClick={() => {
                    if (walletBalance >= finalPrice) {
                      setPayWithWallet(!payWithWallet);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all shrink-0 duration-300",
                        payWithWallet ? "border-primary bg-primary" : "border-border"
                      )}>
                        {payWithWallet && <CheckCircle2 className="h-3.5 w-3.5 text-primary-foreground" />}
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className={cn("text-xs font-semibold", payWithWallet ? "text-primary" : "text-foreground")}>
                          Pay with Wallet
                        </span>
                        {agentSlug && finalPrice > Number(bundle.base_price) ? (
                          <div className="text-[9px] font-semibold text-muted-foreground flex flex-col gap-1 mt-1">
                            <span>Balance: <span className="text-primary font-bold">{formatGHS(walletBalance)}</span></span>
                            <span className="text-emerald-500 bg-emerald-500/5 px-1.5 py-0.5 rounded-md border border-emerald-500/20 inline-block w-fit font-semibold">
                              Earn {formatGHS(finalPrice - Number(bundle.base_price))} commission!
                            </span>
                          </div>
                        ) : (
                          <span className="text-[9px] font-semibold text-muted-foreground mt-0.5">
                            Balance: <span className="text-foreground font-semibold">{formatGHS(walletBalance)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {walletBalance < finalPrice && (
                      <span className="text-[9px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-md shrink-0">
                        Insufficient
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-2">
                <Button
                  onClick={buy}
                  disabled={
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
                  className="h-12 w-full rounded-xl text-xs tracking-wider uppercase flex items-center justify-center gap-1.5"
                >
                  {payWithWallet ? (
                    <>
                      <Lock className="h-4 w-4" />
                      Pay {formatGHS(finalPrice)} Securely
                    </>
                  ) : (
                    <>
                      <Zap className="h-4 w-4" />
                      Pay {formatGHS(finalPrice)}
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {!payWithWallet && activeGateway !== "theteller" && (
                <div className="text-center pt-0.5 animate-in fade-in duration-300">
                  <span className="text-[10px] font-semibold text-muted-foreground">Issues with prompts? </span>
                  <button
                    type="button"
                    onClick={payWithRedirect}
                    className="text-[10px] font-semibold text-primary hover:underline transition-colors"
                  >
                    Pay via Web Page instead
                  </button>
                </div>
              )}

              {/* Trust strip */}
              <div className="flex items-center justify-center gap-1 text-[9px] font-semibold text-muted-foreground uppercase tracking-widest pt-3.5 border-t border-border">
                <Lock className="h-3 w-3 text-emerald-500/80" />
                Secured Payments · PCI-DSS
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
