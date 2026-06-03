import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettings } from "@/hooks/useSettings";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { formatGHS } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Sparkles, Store, TrendingUp, Zap, CheckCircle2, RefreshCcw, ShieldCheck } from "lucide-react";

type Phase = "select" | "processing" | "polling" | "success" | "error" | "otp";

export function BecomeAgent({ onClose }: { onClose: () => void }) {
  const { data: settings } = useSettings();
  const activeGateway = settings?.active_payment_gateway || "paystack";
  console.log("[BecomeAgent] activeGateway resolved to:", activeGateway);
  const { isAgent, profile, refresh } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  
  const [checkoutOpen, setCheckoutOpen] = useState(true);
  const [momoNumber, setMomoNumber] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("MTN");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [phase, setPhase] = useState<Phase>("select");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderRef, setOrderRef] = useState<string | null>(null);
  const [otp, setOtp] = useState("");
  const [isSubmittingOtp, setIsSubmittingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  useEffect(() => {
    if (otpTimer <= 0) return;
    const interval = setInterval(() => {
      setOtpTimer(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [otpTimer]);

  const refSlug = localStorage.getItem("agent_ref");
  
  const { data: parentAgent } = useQuery({
    queryKey: ["become-agent-parent", refSlug],
    enabled: !!refSlug,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("store_name, store_logo_url, store_brand_color")
        .eq("store_slug", refSlug)
        .maybeSingle();
      return data;
    },
  });

  const brandColor = parentAgent?.store_brand_color || "#7c3aed";
  const storeName = parentAgent?.store_name || "Data Platform";

  const activate = async () => {
    if (!settings) {
      toast({ title: "Loading settings", description: "Payment configuration is still loading. Please try again in a moment.", variant: "destructive" });
      return;
    }
    
    if (!momoNumber || momoNumber.replace(/\D/g, "").length < 9) {
      toast({ title: "Enter mobile money number", variant: "destructive" });
      return;
    }

    setPhase("processing");

    const { error, data } = await supabase.functions.invoke(`${activeGateway}-process`, {
      body: {
        purpose: "agent_activation",
        momo_number: momoNumber,
        momo_network: momoNetwork,
        email: profile?.email || "guest@mtopup.shop",
        ref_slug: refSlug || undefined,
      },
    });

    if (error || data?.error) {
      const errPayload = data?.error ?? error?.message ?? "Payment initialization failed";
      const errMsg = typeof errPayload === "object" ? JSON.stringify(errPayload) : errPayload;
      setErrorMsg(errMsg);
      setPhase("error");
      return;
    }

    if (data?.status === "send_otp") {
      setOrderRef(data.reference);
      setOtpTimer(60);
      setErrorMsg(data.message || "Please enter the OTP sent to your phone.");
      setPhase("otp");
      return;
    }

    setOrderRef(data.reference);
    setPhase("polling");
  };

  const resendActivationOtp = async () => {
    if (otpTimer > 0) return;
    setPhase("processing");
    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
        body: {
          purpose: "agent_activation",
          momo_number: momoNumber,
          momo_network: momoNetwork,
          email: profile?.email || "guest@mtopup.shop",
          ref_slug: refSlug || undefined,
        },
      });

      if (error || data?.error) {
        setErrorMsg(data?.error || error?.message || "Failed to resend OTP");
        setPhase("error");
        return;
      }

      if (data?.status === "send_otp") {
        setOrderRef(data.reference);
        setOtpTimer(60);
        setPhase("otp");
        toast({ title: "OTP Resent", description: "A new OTP has been sent." });
      } else {
        setOrderRef(data.reference);
        setPhase("polling");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to resend OTP");
      setPhase("error");
    }
  };

  const submitOtp = async (overrideOtp?: string | React.MouseEvent) => {
    const finalOtp = typeof overrideOtp === 'string' ? overrideOtp : otp;
    if (!finalOtp || !orderRef) return;
    setIsSubmittingOtp(true);
    setPhase("processing");
    
    try {
      const { data, error } = await supabase.functions.invoke(`${activeGateway}-process`, {
        body: { action: "submit_otp", otp: finalOtp, reference: orderRef }
      });
      setIsSubmittingOtp(false);
      
      if (error || data?.error) {
        setErrorMsg(data?.error ?? error?.message ?? "OTP verification failed");
        setPhase("error");
        return;
      }
      
      if (data?.status === "success") {
        setPhase("success");
      } else {
        setPhase("polling");
      }
    } catch (e) {
      setIsSubmittingOtp(false);
      setErrorMsg("An unexpected error occurred");
      setPhase("error");
    }
  };

  const reset = () => {
    setPhase("select");
    setOrderRef(null);
    setErrorMsg(null);
    setOtp("");
    setCheckoutOpen(false);
  };

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

  useEffect(() => {
    if (phase !== "polling" || !orderRef) return;
    
    let interval: any;
    let attempts = 0;

    const checkStatus = async () => {
      attempts++;
      if (attempts > 40) {
        setPhase("error");
        setErrorMsg("Payment timed out. Please try again.");
        return clearInterval(interval);
      }

      const { data, error } = await supabase.functions.invoke(`${activeGateway}-verify`, {
        body: { reference: orderRef }
      });

      if (data?.ok) {
        clearInterval(interval);
        setPhase("success");
      } else if (data?.status === "send_otp") {
        clearInterval(interval);
        setPhase("otp");
        setErrorMsg(data.message || "Please enter the OTP sent to your phone.");
      } else if (data?.error) {
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(data.error);
      } else if (data?.status && !["pending", "processing", "vbv required", "ongoing", "pay_offline"].includes(data.status.toLowerCase())) {
        clearInterval(interval);
        setPhase("error");
        setErrorMsg(`Payment failed: ${data.status}`);
      }
    };

    interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [phase, orderRef]);

  useEffect(() => {
    if (phase === "success") {
      const timer = setTimeout(async () => {
        // Re-fetch roles from DB so AuthContext knows we're an agent now
        await refresh();
        onClose();
        if (parentAgent || refSlug) {
          nav("/sub-agent", { replace: true });
        } else {
          nav("/agent", { replace: true });
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [phase, nav, onClose, refresh, parentAgent, refSlug]);

  if (isAgent) {
    return (
      <div className="text-center py-6">
        <div className="mx-auto h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-success" />
        </div>
        <p className="mt-4 text-lg font-semibold">You're already an agent</p>
        <Button onClick={() => { onClose(); nav("/agent"); }} className="mt-4 rounded-2xl gradient-primary" style={parentAgent ? { backgroundColor: brandColor, backgroundImage: 'none' } : {}}>Open Dashboard</Button>
      </div>
    );
  }

  const fee = settings?.agent_activation_fee ?? 50;

  if (phase === "success") {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
          <CheckCircle2 className="h-10 w-10 text-success" />
        </div>
        <h3 className="mt-4 text-2xl font-bold">Activation Successful!</h3>
        <p className="mt-2 text-muted-foreground">Your agent store is now active.</p>
        <Button 
          onClick={() => { onClose(); nav("/agent"); }} 
          className="mt-6 rounded-2xl w-full h-12 text-white font-bold"
          style={parentAgent ? { backgroundColor: brandColor, backgroundImage: 'none', boxShadow: `0 10px 20px -5px ${brandColor}` } : { backgroundColor: 'var(--primary)' }}
        >
          Open Dashboard
        </Button>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="text-center py-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <RefreshCcw className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-destructive">Activation Failed</h3>
        <p className="mt-2 text-sm text-muted-foreground">{errorMsg}</p>
        <Button onClick={reset} className="mt-6 rounded-2xl w-full h-12" variant="outline">
          Try Again
        </Button>
      </div>
    );
  }

  if (phase === "processing" || phase === "polling") {
    return (
      <div className="py-12 text-center">
        <div 
          className="mx-auto flex h-20 w-20 animate-float-pulse items-center justify-center rounded-full shadow-glow"
          style={parentAgent ? { backgroundColor: brandColor, boxShadow: `0 10px 25px -5px ${brandColor}` } : { backgroundColor: 'var(--primary)' }}
        >
          <Zap className="h-10 w-10 text-white animate-pulse" />
        </div>
        <h3 className="mt-6 text-xl font-bold">
          {phase === "processing" ? "Initiating..." : "Awaiting Authorization"}
        </h3>
        {phase === "polling" && (
          <p className="mt-2 text-sm font-medium text-primary" style={parentAgent ? { color: brandColor } : {}}>
            Please check your phone ({momoNumber}) to authorize payment.
          </p>
        )}
      </div>
    );
  }

  if (phase === "otp") {
    return (
      <div className="py-8 text-center space-y-4 animate-in fade-in zoom-in-95 duration-300">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary" style={parentAgent ? { backgroundColor: `${brandColor}1A`, color: brandColor } : {}}>
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h3 className="text-xl font-bold">Verification Required</h3>
        <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
          {errorMsg || "Please enter the OTP sent to your phone to authorize the payment."}
        </p>
        <div className="pt-4 max-w-[240px] mx-auto space-y-4">
          <Input 
            placeholder="Enter OTP code" 
            value={otp} 
            onChange={e => {
              const val = e.target.value;
              setOtp(val);
              if (val.length === 6 && phase === "otp") {
                submitOtp(val);
              }
            }}
            className="text-center text-lg tracking-widest font-mono h-12"
            maxLength={6}
          />
          <div className="flex items-center justify-between px-1 text-xs">
            <Button
              variant="ghost"
              onClick={reset}
              className="h-auto p-0 text-slate-500 hover:text-slate-700 font-bold"
            >
              Cancel
            </Button>
            {otpTimer > 0 ? (
              <span className="text-slate-500 font-bold">Resend in {otpTimer}s</span>
            ) : (
              <Button
                variant="ghost"
                onClick={resendActivationOtp}
                className="h-auto p-0 text-primary font-bold hover:underline"
                style={parentAgent ? { color: brandColor } : {}}
              >
                Resend OTP
              </Button>
            )}
          </div>
          <Button 
            id="btn-activation-otp-submit"
            onClick={() => submitOtp()} 
            disabled={otp.length < 4 || isSubmittingOtp}
            className="w-full h-12 rounded-xl text-white font-bold"
            style={parentAgent ? { backgroundColor: brandColor, backgroundImage: 'none' } : { backgroundColor: 'var(--primary)' }}
          >
            {isSubmittingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Verify Payment"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div 
        className="rounded-3xl p-6 border"
        style={parentAgent ? { borderColor: `${brandColor}33`, backgroundColor: `${brandColor}0D` } : { borderColor: 'var(--border)', backgroundColor: 'var(--card)' }}
      >
        <Sparkles className="h-8 w-8 text-primary" style={parentAgent ? { color: brandColor } : {}} />
        <h3 className="mt-3 text-xl font-semibold">
          {parentAgent ? `Earn with ${storeName}` : "Earn with OneGig"}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {parentAgent 
            ? "Get your own reseller data store. Set your prices. Profit on every sale." 
            : "Get your own data store. Set your prices. Profit on every sale."}
        </p>
      </div>

      <div className="space-y-3">
        <Benefit 
          icon={<Store className="h-5 w-5" style={parentAgent ? { color: brandColor } : {}} />} 
          title="Your own mini store" 
          desc="A clean reseller storefront link to share with customers." 
          parentAgent={parentAgent}
          brandColor={brandColor}
        />
        <Benefit 
          icon={<TrendingUp className="h-5 w-5" style={parentAgent ? { color: brandColor } : {}} />} 
          title="Set your own prices" 
          desc="Profit auto-credited to your reseller wallet on every order." 
          parentAgent={parentAgent}
          brandColor={brandColor}
        />
        <Benefit 
          icon={<Sparkles className="h-5 w-5" style={parentAgent ? { color: brandColor } : {}} />} 
          title="Withdraw to MoMo" 
          desc={`Cash out your earnings anytime above ${formatGHS(settings?.min_withdrawal ?? 50)}.`} 
          parentAgent={parentAgent}
          brandColor={brandColor}
        />
      </div>

      <div className="space-y-3">
        <label className="text-xs font-semibold text-foreground">
          Mobile Money Payment Number
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
          <div className="mt-2 text-xs text-primary flex items-center gap-2" style={parentAgent ? { color: brandColor } : {}}>
            <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" style={parentAgent ? { borderColor: brandColor, borderTopColor: 'transparent' } : {}} />
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

      <div className="rounded-3xl border border-border/60 p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Activation fee (one-time)</p>
          <p className="text-2xl font-bold">{formatGHS(fee)}</p>
        </div>
        <Button
          onClick={activate}
          disabled={momoNumber.replace(/\D/g, "").length < 9 || isVerifying || phase === "processing"}
          className="h-14 rounded-2xl px-6 text-white font-bold shadow-float"
          style={parentAgent ? { backgroundColor: brandColor, backgroundImage: 'none', boxShadow: `0 12px 30px -10px ${brandColor}` } : { backgroundColor: 'var(--primary)' }}
        >
          Pay & Activate
        </Button>
      </div>
    </div>
  );
}

function Benefit({ icon, title, desc, parentAgent, brandColor }: { icon: React.ReactNode; title: string; desc: string; parentAgent: any; brandColor: string }) {
  return (
    <div className="flex gap-3 items-start">
      <div 
        className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0"
        style={parentAgent ? { backgroundColor: `${brandColor}1A`, color: brandColor } : {}}
      >
        {icon}
      </div>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}