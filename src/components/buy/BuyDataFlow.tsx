import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useNetworks, useBundles, BundleRow, NetworkRow } from "@/hooks/useNetworksAndBundles";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useSettings";
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
                    : "border-2 border-border bg-background dark:bg-slate-900 text-muted-foreground"
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

  useEffect(() => {
    if (!network && networks.length) setNetwork(networks[0]);
    if (network && network.code) setMomoNetwork(network.code);
  }, [networks, network]);

  useEffect(() => {
    const num = momoNumber.replace(/\D/g, "");
    if (num.length >= 10 && checkoutOpen && !payWithWallet) {
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
    const num = phone.replace(/\D/g, "");
    setRecipientNetworkError(null);
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
    if (!payWithWallet && (!momoNumber || momoNumber.replace(/\D/g, "").length < 9)) {
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
        momo_number: momoNumber,
        momo_network: momoNetwork,
        email: profile?.email || "guest@mtopup.shop",
      },
    });

    if (error) {
      setPhase("error");
      setErrorMsg(error?.message || "Payment initialization failed");
      return;
    }

    if (data?.error) {
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
        
        {/* Premium Receipt Card */}
        <div className="bg-white dark:bg-slate-900 rounded-[2rem] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] border border-slate-100 dark:border-slate-800 overflow-hidden relative">
          <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-400 bg-[length:200%_auto] animate-gradient"></div>
          
          <div className="p-8 pb-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10 mb-5 ring-[10px] ring-emerald-50/50 dark:ring-emerald-500/5">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Payment Successful</h3>
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
              Your <span className="font-bold text-slate-700 dark:text-slate-300">{bundle?.size_label}</span> is on its way to
            </p>
            <div className="mt-2 inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-slate-100 dark:bg-slate-800 text-lg font-black text-slate-800 dark:text-slate-200">
              {phone}
            </div>
          </div>
          
          <div className="px-8 pb-8">
            <div className="pt-6 border-t border-dashed border-slate-200 dark:border-slate-700 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Payment Method</span>
                <span className="text-sm font-bold flex items-center gap-1.5 text-slate-700 dark:text-slate-200">
                  {payWithWallet ? (
                    <><div className="h-2 w-2 rounded-full bg-primary" /> Wallet</>
                  ) : (
                    <><div className="h-2 w-2 rounded-full bg-yellow-500" /> MoMo ({momoNetwork})</>
                  )}
                </span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Amount Paid</span>
                <span className="text-sm font-black text-slate-800 dark:text-slate-100">{formatGHS(finalPrice)}</span>
              </div>
              
              {orderRef && (
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">Transaction Ref</span>
                  <span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">{orderRef.split('-')[0] + '...'}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs font-semibold text-muted-foreground/80">
          Delivery usually takes 10 - 60 minutes.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 max-w-sm mx-auto">
          <Button variant="outline" className="h-14 rounded-2xl font-bold border-2" onClick={reset}>
            Buy Again
          </Button>
          <Button
            className="h-14 rounded-2xl font-bold bg-slate-900 text-white hover:bg-slate-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
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
      <div className="py-14 text-center space-y-8 animate-in fade-in duration-300">
        <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
          {/* Glowing background ring */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 animate-spin [animation-duration:3s] blur-md opacity-35"></div>
          {/* Inner glass/bg circle */}
          <div className="absolute inset-1 rounded-full bg-slate-50 dark:bg-[#0c1224] flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-inner"></div>
          {/* Pulse center icon */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 shadow-lg shadow-purple-500/30 animate-float-pulse">
            <Zap className="h-7 w-7 text-white" />
          </div>
        </div>
        
        <div className="space-y-3">
          <h3 className="text-xl font-extrabold tracking-tight text-slate-800 dark:text-slate-100 flex items-center justify-center gap-2">
            {phase === "processing" && (
              <>
                <span className="bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent">Initiating Payment</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-purple-500 animate-ping" />
              </>
            )}
            {phase === "polling" && (
              <>
                <span className="bg-gradient-to-r from-blue-500 to-indigo-500 bg-clip-text text-transparent">Awaiting Authorization</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping" />
              </>
            )}
            {phase === "delivering" && (
              <>
                <span className="bg-gradient-to-r from-emerald-500 to-teal-500 bg-clip-text text-transparent">Sending Data Bundle</span>
                <span className="flex h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping" />
              </>
            )}
          </h3>

          {phase === "polling" && (
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 px-5 py-2.5 rounded-full border border-indigo-100 dark:border-indigo-900/40 shadow-sm max-w-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                {authMessage || `Please check your phone (${momoNumber}) to authorize...`}
              </div>
            </div>
          )}

          {phase === "delivering" && (
            <div className="flex flex-col items-center animate-pulse">
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-5 py-2.5 rounded-full border border-emerald-100 dark:border-emerald-900/40 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Connecting to {network?.name} network...
              </div>
            </div>
          )}

          <p className="text-xs font-medium text-slate-400 dark:text-slate-500">
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
        
        <div className="mt-7 flex flex-col gap-3 max-w-[280px] mx-auto">
          {activeGateway !== "theteller" && (
            <Button
              className="h-13 rounded-2xl w-full bg-blue-600 hover:bg-blue-700 text-white font-black shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2"
              onClick={payWithRedirect}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2" ry="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
              Pay via Secure Web Page
            </Button>
          )}
          <Button
            className="h-13 rounded-2xl w-full font-bold border-2"
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
        <DialogContent className="w-[94vw] max-w-md rounded-[2rem] border-0 bg-background p-0 overflow-hidden shadow-[0_20px_50px_-12px_rgba(0,0,0,0.25)]">
          {/* Header */}
          <div className="flex flex-col items-center justify-center pt-8 pb-4 px-6 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 shadow-inner">
              {network ? (
                <span className={cn("text-2xl font-black", netStyle.cardActive.replace("border-black", "").replace("shadow-float", "").replace("ring-2", ""))}>
                  {network.name[0]}
                </span>
              ) : (
                <Zap className="h-8 w-8 text-primary" />
              )}
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
              Confirm Payment
            </DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">
              You are purchasing data for a {network?.name} number.
            </DialogDescription>
          </div>

          <div className="px-6 space-y-5 pb-8">
            {/* Order summary */}
            {bundle && network && (
              <div className="flex flex-col rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">{network.name} Bundle</span>
                    <span className="text-xl font-black leading-none text-foreground">{bundle.size_label}</span>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Total</span>
                    <span className="text-xl font-black leading-none text-primary">{formatGHS(finalPrice)}</span>
                  </div>
                </div>
                
                <div className="flex justify-between items-center text-xs font-medium border-t border-slate-200 dark:border-slate-800 pt-3">
                  <span className="text-muted-foreground">Price</span>
                  <span className="text-foreground">{formatGHS(basePrice)}</span>
                </div>
                {!payWithWallet && (
                  <div className="flex justify-between items-center text-xs font-medium pt-2">
                    <span className="text-muted-foreground">Processing Fee (3%)</span>
                    <span className="text-foreground">{formatGHS(paymentFee)}</span>
                  </div>
                )}
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              {/* Recipient Input */}
              <div>
                <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Data Recipient
                </label>
                <div className="relative">
                  <Input
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 024 123 4567"
                    className={cn(
                      "h-14 w-full rounded-2xl border-0 bg-slate-50 dark:bg-slate-900 px-4 text-lg font-semibold shadow-inner transition-all focus-visible:bg-white focus-visible:ring-2",
                      recipientNetworkError ? "ring-2 ring-destructive/50" : "focus-visible:ring-primary/30"
                    )}
                  />
                  {isVerifyingRecipient && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <span className="block h-5 w-5 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                    </div>
                  )}
                </div>
                
                {recipientNetworkError ? (
                  <p className="mt-2 text-xs font-bold text-destructive flex items-center gap-1.5 px-1">
                    <RefreshCcw className="h-3.5 w-3.5" />
                    {recipientNetworkError}
                  </p>
                ) : null}
                
                {recipientAccountName && !isVerifyingRecipient && !recipientNetworkError && (
                  <div className="mt-2 text-xs font-bold px-4 py-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {recipientAccountName}
                  </div>
                )}
              </div>

              {/* Momo inputs are hidden if paying with wallet */}
              {!payWithWallet && (
                <div className="pt-2">
                  <label className="mb-2 block text-xs font-bold text-slate-700 dark:text-slate-300">
                    Payment Number (MoMo)
                  </label>
                  <div className="flex gap-2.5">
                    <select 
                      className="w-[110px] h-14 rounded-2xl border-0 text-base font-semibold bg-slate-50 dark:bg-slate-900 px-4 shadow-inner outline-none focus:ring-2 focus:ring-primary/30 transition-all cursor-pointer"
                      value={momoNetwork}
                      onChange={(e) => setMomoNetwork(e.target.value)}
                    >
                      <option value="MTN">MTN</option>
                      <option value="TELECEL">Telecel</option>
                      <option value="AIRTELTIGO">AT</option>
                    </select>
                    <div className="relative flex-1">
                      <Input
                        inputMode="tel"
                        value={momoNumber}
                        onChange={(e) => setMomoNumber(e.target.value)}
                        placeholder="e.g. 024 123 4567"
                        className="h-14 w-full rounded-2xl border-0 bg-slate-50 dark:bg-slate-900 px-4 text-lg font-semibold shadow-inner transition-colors focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-primary/30"
                      />
                      {isVerifying && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <span className="block h-5 w-5 rounded-full border-2 border-slate-300 border-t-primary animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {accountName && !isVerifying && (
                    <div className="mt-2 text-xs font-bold px-4 py-2.5 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400 rounded-xl flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {accountName}
                    </div>
                  )}
                </div>
              )}

              {profile && bundle && (
                <div 
                  className={cn(
                    "mt-4 cursor-pointer rounded-2xl border-2 p-4 transition-all",
                    payWithWallet 
                      ? "border-primary bg-primary/5 shadow-sm" 
                      : "border-slate-100 dark:border-slate-800 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-900",
                    walletBalance < finalPrice && "opacity-50 cursor-not-allowed border-dashed"
                  )}
                  onClick={() => {
                    if (walletBalance >= finalPrice) {
                      setPayWithWallet(!payWithWallet);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all",
                        payWithWallet ? "border-primary bg-primary" : "border-slate-300 dark:border-slate-600"
                      )}>
                        {payWithWallet && <CheckCircle2 className="h-3 w-3 text-white" />}
                      </div>
                      <div className="flex flex-col">
                        <span className={cn("text-sm font-bold", payWithWallet ? "text-primary" : "text-foreground")}>
                          Pay with Wallet
                        </span>
                        {agentSlug && finalPrice > Number(bundle.base_price) ? (
                          <span className="text-[10px] font-semibold text-muted-foreground mt-0.5 flex flex-col gap-0.5">
                            <span>Available Balance: <span className="text-primary font-bold">{formatGHS(walletBalance)}</span></span>
                            <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded inline-block w-fit mt-1 font-bold">
                              Pay {formatGHS(finalPrice)} upfront, instantly earn {formatGHS(finalPrice - Number(bundle.base_price))} commission!
                            </span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                            Available Balance: <span className="text-foreground font-bold">{formatGHS(walletBalance)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    {walletBalance < finalPrice && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-md">
                        Insufficient
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4">
                <Button
                  onClick={buy}
                  disabled={
                    !bundle ||
                    phone.replace(/\D/g, "").length < 9 ||
                    !!recipientNetworkError ||
                    (!payWithWallet && (momoNumber.replace(/\D/g, "").length < 9 || isVerifying || accountName === "Unknown Account" || accountName === "Account not found"))
                  }
                  className={cn(
                    "h-14 w-full rounded-2xl text-base font-black tracking-wide shadow-lg transition-all active:scale-[0.98]",
                    payWithWallet ? "bg-foreground text-background hover:bg-foreground/90" : "bg-primary text-primary-foreground hover:opacity-90"
                  )}
                >
                  {payWithWallet ? (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Pay {formatGHS(finalPrice)} Securely
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Pay {formatGHS(finalPrice)}
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>

              {!payWithWallet && (
                <div className="text-center pt-1.5 animate-in fade-in duration-300">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Issues with phone prompts? </span>
                  <button 
                    type="button"
                    onClick={payWithRedirect}
                    className="text-[11px] font-extrabold text-blue-600 hover:text-blue-700 hover:underline dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  >
                    Pay via Web Page instead
                  </button>
                </div>
              )}

              {/* Trust strip */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest pt-3">
                <Lock className="h-3 w-3" />
                Secured Payments · PCI-DSS
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
