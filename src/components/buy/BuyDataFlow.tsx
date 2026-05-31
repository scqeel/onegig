import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNetworks, useBundles, BundleRow, NetworkRow } from "@/hooks/useNetworksAndBundles";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";
import { Confetti } from "@/components/Confetti";
import { ArrowRight, CheckCircle2, Lock, RefreshCcw, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

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
      idle: "border-yellow-200 bg-yellow-50 hover:border-yellow-400 hover:bg-yellow-100/80",
      active: "border-yellow-400 bg-yellow-400/90 text-yellow-950 shadow-float",
      activeRing: "ring-2 ring-yellow-400/40",
      badge: "bg-yellow-500 text-yellow-950",
      cardIdle: "border-[#f2c000] bg-[#ffcc00] text-black hover:bg-[#e6b800] transition-colors",
      cardActive: "border-black bg-[#e6b800] text-black shadow-float ring-2 ring-black",
      dot: "bg-yellow-400",
      tagBg: "bg-yellow-100 text-yellow-800 border border-yellow-200",
    };
  if (c === "TELECEL")
    return {
      idle: "border-red-200 bg-red-50 hover:border-red-400 hover:bg-red-100/80",
      active: "border-red-500 bg-red-500/90 text-white shadow-float",
      activeRing: "ring-2 ring-red-400/40",
      badge: "bg-red-600 text-white",
      cardIdle: "border-[#b30000] bg-[#cc0000] text-white hover:bg-[#b30000] transition-colors",
      cardActive: "border-black bg-[#b30000] text-white shadow-float ring-2 ring-black",
      dot: "bg-red-500",
      tagBg: "bg-red-100 text-red-800 border border-red-200",
    };
  if (c === "AIRTELTIGO" || c === "AT")
    return {
      idle: "border-purple-200 bg-purple-50 hover:border-purple-400 hover:bg-purple-100/80",
      active: "border-purple-500 bg-purple-500/90 text-white shadow-float",
      activeRing: "ring-2 ring-purple-400/40",
      badge: "bg-purple-600 text-white",
      cardIdle: "border-[#380b6b] bg-[#4a148c] text-white hover:bg-[#380b6b] transition-colors",
      cardActive: "border-black bg-[#380b6b] text-white shadow-float ring-2 ring-black",
      dot: "bg-purple-500",
      tagBg: "bg-purple-100 text-purple-800 border border-purple-200",
    };
  
  return {
    idle: "border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100/80",
    active: "border-blue-500 bg-blue-500/90 text-white shadow-float",
    activeRing: "ring-2 ring-blue-400/40",
    badge: "bg-blue-600 text-white",
    cardIdle: "border-blue-600 bg-blue-600 text-white hover:bg-blue-700 transition-colors",
    cardActive: "border-black bg-blue-700 text-white shadow-float ring-2 ring-black",
    dot: "bg-blue-500",
    tagBg: "bg-blue-100 text-blue-800 border border-blue-200",
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
                    : "border-2 border-border bg-white text-muted-foreground"
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
  const { toast } = useToast();
  const { data: networks = [] } = useNetworks();
  const [network, setNetwork] = useState<NetworkRow | null>(null);
  const { data: bundles = [] } = useBundles(network?.id ?? null);
  const [bundle, setBundle] = useState<BundleRow | null>(null);
  const [phone, setPhone] = useState(defaultPhone || profile?.phone || "");
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

  useEffect(() => {
    if (!network && networks.length) setNetwork(networks[0]);
    if (network && network.code) setMomoNetwork(network.code);
  }, [networks, network]);

  useEffect(() => {
    const num = momoNumber.replace(/\D/g, "");
    if (num.length >= 10 && checkoutOpen) {
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
  }, [momoNumber, momoNetwork, checkoutOpen]);

  const priceFor = (b: BundleRow) =>
    priceOverrides && priceOverrides[b.id] != null
      ? priceOverrides[b.id]
      : Number(b.user_price ?? b.base_price);

  const basePrice = bundle ? priceFor(bundle) : 0;
  const paymentFee = basePrice * 0.03;
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
    if (!bundle || !phone || phone.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter recipient phone", variant: "destructive" });
      return;
    }
    if (!momoNumber || momoNumber.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter mobile money number", variant: "destructive" });
      return;
    }

    setCheckoutOpen(false);
    setPhase("processing");
    const { data, error } = await supabase.functions.invoke("paystack-process", {
      body: {
        purpose: "order",
        recipient_phone: phone.replace(/\D/g, ""),
        bundle_id: bundle.id,
        agent_slug: agentSlug ?? null,
        momo_number: momoNumber,
        momo_network: momoNetwork,
        email: profile?.email || "guest@mtopup.shop",
      },
    });

    if (error) {
      console.error(error);
      setPhase("error");
      setErrorMsg(error?.message || "Payment initialization failed");
      return;
    }

    if (data?.error) {
      console.error(data.error);
      setPhase("error");
      const errMsg = typeof data.error === "object" ? JSON.stringify(data.error) : data.error;
      setErrorMsg(errMsg);
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
    
    const { data, error } = await supabase.functions.invoke("paystack-process", {
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

      const { data, error } = await supabase.functions.invoke("paystack-verify", {
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
      <div className="relative py-10 text-center">
        <Confetti />
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </div>
        <h3 className="mt-5 text-xl font-bold">Purchase Successful! 🎉</h3>
        <p className="mt-2 text-muted-foreground">
          Your {bundle?.size_label} will be delivered to{" "}
          <span className="font-semibold text-foreground">{phone}</span>
          <br/>within 10 - 60 mins.
        </p>
        {orderRef && (
          <p className="mt-1 text-xs text-muted-foreground">Ref: {orderRef}</p>
        )}
        <div className="mx-auto mt-7 grid max-w-xs grid-cols-2 gap-3">
          <Button variant="outline" className="h-12 rounded-2xl" onClick={reset}>
            Buy Again
          </Button>
          <Button
            className="h-12 rounded-2xl gradient-primary"
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
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 mb-4 border border-primary/20 shadow-lg">
          <Lock className="h-10 w-10 text-primary" />
        </div>
        <h3 className="text-2xl font-black text-foreground">Verification Required</h3>
        <p className="mt-2 text-sm font-medium text-muted-foreground max-w-[280px] mx-auto">
          Please enter the OTP or Voucher Code sent to your mobile number ({momoNumber}).
        </p>
        
        {errorMsg && (
          <p className="mt-3 text-xs font-bold text-destructive">{errorMsg}</p>
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
                    className="h-14 w-12 rounded-[14px] border border-border bg-background text-xl font-black shadow-sm transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20" 
                  />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          
          <div className="flex items-center justify-between px-2 pt-2">
            <Button
              variant="ghost"
              onClick={() => { setPhase("select"); setOtp(""); setAuthMessage(null); }}
              className="h-auto p-0 text-xs font-bold text-muted-foreground hover:text-foreground"
            >
              Cancel Order
            </Button>
            <Button
              variant="ghost"
              onClick={buy}
              className="h-auto p-0 text-xs text-primary font-bold hover:underline"
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
              className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold"
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
      <div className="py-14 text-center">
        <div className="mx-auto flex h-24 w-24 animate-float-pulse items-center justify-center rounded-full gradient-primary shadow-glow">
          <Zap className="h-10 w-10 text-white animate-pulse" />
        </div>
        <h3 className="mt-6 text-xl font-bold text-foreground">
          {phase === "processing" && "Initiating Payment..."}
          {phase === "polling" && "Awaiting Authorization"}
          {phase === "delivering" && "Payment Received! Sending Data..."}
        </h3>
        {phase === "polling" && (
          <p className="mt-2 text-sm font-medium text-primary max-w-sm mx-auto">
            {authMessage || `Please check your phone (${momoNumber}) to authorize the payment.`}
          </p>
        )}
        {phase === "delivering" && (
          <p className="mt-2 text-sm font-medium text-primary">
            Connecting to {network?.name} network to deliver your bundle.
          </p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">
          Do not close this window. Your bundle will be delivered automatically.
        </p>
        
        {(phase === "polling" || phase === "delivering") && (
          <div className="mt-8 flex items-center justify-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce" />
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.2s]" />
            <span className="h-2 w-2 rounded-full bg-primary animate-bounce [animation-delay:0.4s]" />
          </div>
        )}
      </div>
    );
  }

  // ── Error state ──
  if (phase === "error") {
    return (
      <div className="py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <RefreshCcw className="h-8 w-8 text-destructive" />
        </div>
        <p className="mt-4 font-semibold text-destructive">{errorMsg}</p>
        <Button
          className="mt-5 h-11 rounded-xl px-6"
          variant="outline"
          onClick={() => setPhase("select")}
        >
          Try Again
        </Button>
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
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {bundles.map((b, i) => {
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
                    <span className="absolute -top-2 left-3 rounded-full bg-primary px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary-foreground shadow-soft z-10">
                      Popular
                    </span>
                  )}
                  {isBestValue && !active && (
                    <span className="absolute -top-2 left-3 rounded-full bg-success px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-success-foreground shadow-soft z-10">
                      Best Value
                    </span>
                  )}

                  <div className="flex w-full justify-between items-start mb-5">
                    {network?.code.toUpperCase() === 'MTN' ? (
                      <div className="flex items-center justify-center rounded-full border-[1.5px] border-black px-2 py-0.5 h-6">
                        <span className="text-[10px] font-black">MTN</span>
                      </div>
                    ) : network?.code.toUpperCase() === 'TELECEL' ? (
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-[#cc0000]">
                          <span className="text-[10px] font-bold text-white">t</span>
                        </div>
                      </div>
                    ) : (network?.code.toUpperCase() === 'AIRTELTIGO' || network?.code.toUpperCase() === 'AT') ? (
                      <div className="flex h-6 w-8 items-center justify-center rounded-md bg-gradient-to-r from-red-500 to-blue-500">
                        <span className="text-[10px] font-black text-white">AT</span>
                      </div>
                    ) : (
                      <div className="flex h-6 items-center justify-center">
                        <span className="text-[10px] font-black uppercase">{network?.name}</span>
                      </div>
                    )}
                    
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-black/10">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                  </div>

                  <span className="text-3xl font-black leading-none tracking-tight">
                    {b.size_label}
                  </span>
                  <span className={cn("mt-1 text-xs font-medium opacity-80")}>
                    {network?.name} Bundle
                  </span>
                  
                  <div className="mt-6 flex w-full items-end justify-between">
                    <span className={cn("text-xl font-black tracking-tight")}>
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
      </section>

      {/* ── Checkout Dialog ── */}
      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="w-[94vw] max-w-sm rounded-3xl border-border/60 p-0 overflow-hidden">
          {/* Header strip */}
          <div className="gradient-primary px-6 py-5 text-primary-foreground">
            <DialogHeader>
              <DialogTitle className="text-left text-lg font-bold text-white">
                Confirm your order
              </DialogTitle>
              <DialogDescription className="text-left text-xs text-white/70">
                Review details before proceeding to checkout.
              </DialogDescription>
            </DialogHeader>

            {/* Order summary */}
            {bundle && network && (
              <div className="mt-4 flex flex-col gap-2 rounded-2xl bg-white/15 px-4 py-3 backdrop-blur-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/70">{network.name} bundle</p>
                    <p className="text-xl font-extrabold leading-tight text-white">
                      {bundle.size_label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-white/70">Price</p>
                    <p className="text-xl font-extrabold text-white">{formatGHS(basePrice)}</p>
                  </div>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-white/10 pt-2">
                  <span className="text-white/70">Payment Fee (3%)</span>
                  <span className="text-white font-medium">{formatGHS(paymentFee)}</span>
                </div>
                <div className="flex justify-between items-center text-sm font-bold border-t border-white/20 pt-2 mt-1">
                  <span className="text-white">Total to Pay</span>
                  <span className="text-emerald-400 text-lg">{formatGHS(finalPrice)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Form */}
          <div className="space-y-4 px-6 py-5">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Recipient Phone (Who is receiving the data?)
              </label>
              <Input
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 123 4567"
                className="h-12 rounded-xl border-border/70 text-base"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                Data will be sent to this number.
              </p>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-foreground">
                Payment Mobile Money Number (Who is paying?)
              </label>
              <div className="flex gap-2">
                <select 
                  className="w-[100px] h-12 rounded-xl border border-border/70 text-sm bg-background px-3 outline-none focus:ring-2 focus:ring-primary/20"
                  value={momoNetwork}
                  onChange={(e) => setMomoNetwork(e.target.value)}
                >
                  <option value="MTN">MTN</option>
                  <option value="TELECEL">Telecel</option>
                  <option value="AIRTELTIGO">AT</option>
                </select>
                <Input
                  inputMode="tel"
                  value={momoNumber}
                  onChange={(e) => setMomoNumber(e.target.value)}
                  placeholder="024 123 4567"
                  className="flex-1 h-12 rounded-xl border-border/70 text-base"
                />
              </div>
              <p className="mt-1 text-[10px] text-muted-foreground">
                The prompt will be sent to this number.
              </p>
              {isVerifying && (
                <div className="mt-2 text-xs text-primary flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                  Verifying account...
                </div>
              )}
              {accountName && !isVerifying && (
                <div className="mt-2 text-xs font-semibold px-3 py-2 bg-success/10 text-success rounded-lg flex items-center gap-2 border border-success/20">
                  <CheckCircle2 className="h-4 w-4" />
                  {accountName}
                </div>
              )}
            </div>

            <Button
              onClick={buy}
              disabled={
                !bundle ||
                phone.replace(/\D/g, "").length < 9 ||
                momoNumber.replace(/\D/g, "").length < 9 ||
                isVerifying
              }
              className="h-12 w-full rounded-xl text-sm font-semibold gradient-primary shadow-float"
            >
              <Zap className="mr-1.5 h-4 w-4" />
              Pay {bundle ? formatGHS(finalPrice) : ""}
              <ArrowRight className="ml-1.5 h-4 w-4" />
            </Button>

            {/* Paystack trust strip */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
              <Lock className="h-3 w-3" />
              Secured Payments · PCI-DSS certified
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
