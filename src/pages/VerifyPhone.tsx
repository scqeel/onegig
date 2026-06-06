import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ShieldCheck, ArrowLeft, Loader2, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/hooks/useSettings";

export default function VerifyPhonePage() {
  const nav = useNavigate();
  const loc = useLocation();
  const { session, loading, refresh } = useAuth();
  const { toast } = useToast();
  const { data: settings, isLoading: settingsLoading } = useSettings();

  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [timer, setTimer] = useState(60);

  const authClient = supabase.auth as any;

  const refSlug = localStorage.getItem("agent_ref");
  
  const { data: parentAgent } = useQuery({
    queryKey: ["verify-parent-agent", refSlug],
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

  // Protect route
  useEffect(() => {
    if (!loading && !settingsLoading) {
      if (!session) {
        nav("/auth", { replace: true });
        return;
      }
      const isOtpRequired = settings?.sms_otp_enabled ?? true;
      if (!isOtpRequired || (session.user.phone && session.user.phone_confirmed_at)) {
        nav("/dashboard", { replace: true });
        return;
      }
    }
  }, [session, loading, settingsLoading, settings, nav]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const verifyOtp = async (codeToVerify?: string) => {
    const finalOtp = codeToVerify || otp;
    if (!finalOtp || finalOtp.length !== 6) {
      toast({ title: "Enter the full 6-digit code", variant: "destructive" });
      return;
    }

    const unconfirmedPhone = session?.user?.new_phone || session?.user?.phone;

    if (!unconfirmedPhone) {
      toast({ title: "Phone number missing", description: "Please enter your phone number first.", variant: "destructive" });
      nav("/auth?tab=signup", { replace: true });
      return;
    }

    setBusy(true);
    try {
      const { error } = await authClient.verifyOtp({ 
        phone: unconfirmedPhone, 
        token: finalOtp.trim(), 
        type: "phone_change" 
      });

      if (error) {
        toast({ title: "Verification failed", description: error.message, variant: "destructive" });
        return;
      }

      toast({ title: "Phone verified", description: "Your account is now fully secured!" });
      
      // Try to automatically lookup and complete their profile name using Paystack
      try {
        const detectNetwork = (phone: string) => {
          let num = phone.replace(/\D/g, "");
          if (num.startsWith("233")) {
            num = "0" + num.substring(3);
          }
          const pfx = num.substring(0, 3);
          if (["024", "054", "055", "059", "025", "053"].includes(pfx)) return "MTN";
          if (["020", "050"].includes(pfx)) return "TELECEL";
          if (["027", "057", "026", "056"].includes(pfx)) return "AIRTELTIGO";
          return "MTN";
        };

        const cleanedNum = unconfirmedPhone.replace(/\D/g, "");
        const network = detectNetwork(cleanedNum);
        
        const { data: resolveRes } = await supabase.functions.invoke("paystack-resolve", {
          body: { momo_number: cleanedNum, momo_network: network }
        });

        if (resolveRes?.ok && resolveRes?.account_name) {
          const resolvedName = resolveRes.account_name;
          
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("full_name")
            .eq("id", session?.user.id)
            .maybeSingle();

          const nameToUpdate = currentProfile?.full_name?.trim();
          if (!nameToUpdate || nameToUpdate === "" || nameToUpdate.toLowerCase().includes("user") || nameToUpdate.toLowerCase().includes("agent")) {
            await supabase
              .from("profiles")
              .update({ full_name: resolvedName })
              .eq("id", session?.user.id);

            await supabase.auth.updateUser({
              data: { full_name: resolvedName }
            });

            localStorage.setItem("show_profile_completion_prompt", "true");
            localStorage.setItem("resolved_profile_name", resolvedName);
          }
        }
      } catch (err) {
        console.error("Auto name lookup failed:", err);
      }

      // Refresh auth context so it picks up phone_confirmed_at
      await refresh();
      
      const intent = new URLSearchParams(loc.search).get("intent");
      nav(intent === "agent" ? "/dashboard/agent" : "/dashboard/customer", { replace: true });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "An unexpected error occurred.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resendCode = async () => {
    const unconfirmedPhone = session?.user?.new_phone || session?.user?.phone;
    if (timer > 0 || !unconfirmedPhone) return;
    
    setBusy(true);
    try {
      const { error } = await authClient.updateUser({ phone: unconfirmedPhone });
      if (error) {
        toast({ title: "Failed to resend code", description: error.message, variant: "destructive" });
      } else {
        setTimer(60);
        toast({ title: "Code resent", description: "A new verification code has been sent to your phone." });
      }
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-50 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const displayPhone = session?.user?.new_phone || session?.user?.phone;
  const phoneMasked = displayPhone 
    ? displayPhone.replace(/(\+?\d{3})(\d{2})(\d{3})(\d{4})/, "$1 *** *** $4")
    : "your phone";

  return (
    <div className="flex min-h-dvh bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div 
          className="absolute -top-40 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-[100%] blur-[100px]" 
          style={{ backgroundColor: parentAgent ? `${brandColor}1F` : 'rgba(124, 58, 237, 0.1)' }}
        />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        
        {/* Card Container */}
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8">
             <Link to="/auth?tab=signup" className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors">
               <ArrowLeft className="mr-2 h-4 w-4" /> Change phone number
             </Link>
          </div>

          <div className="rounded-3xl border border-slate-200/60 bg-white/80 p-8 shadow-xl shadow-slate-200/50 backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/80 dark:shadow-none relative overflow-hidden">
            
            {/* Top decorative line using brandColor */}
            <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: brandColor }} />
            
            <div className="flex justify-center mb-6">
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" style={parentAgent ? { backgroundColor: `${brandColor}33` } : {}} />
                <div 
                  className="relative flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg"
                  style={{ 
                    backgroundColor: brandColor, 
                    boxShadow: `0 10px 20px -5px ${brandColor}`
                  }}
                >
                  <KeyRound className="h-7 w-7 text-white" />
                </div>
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-black tracking-tight text-foreground mb-2">Verify Your Phone</h1>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To secure your account, please enter the 6-digit code we just sent to <span className="font-bold text-foreground">{phoneMasked}</span>
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <InputOTP 
                maxLength={6} 
                value={otp} 
                onChange={(val) => {
                  setOtp(val);
                  if (val.length === 6 && !busy) {
                    setTimeout(() => verifyOtp(val), 50);
                  }
                }}
              >
                <InputOTPGroup className="gap-2 sm:gap-3">
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot 
                      key={i} 
                      index={i} 
                      className="h-12 w-10 sm:h-14 sm:w-12 rounded-[12px] border-2 border-slate-200 bg-white text-xl sm:text-2xl font-black text-foreground shadow-sm transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 dark:border-slate-800 dark:bg-slate-950/50" 
                      style={otp.length > i && parentAgent ? { borderColor: brandColor } : {}}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>

            <Button 
              onClick={() => verifyOtp()} 
              disabled={busy || otp.length < 6} 
              className="h-12 w-full rounded-[14px] text-sm font-black transition-all disabled:opacity-50 text-white"
              style={{ backgroundColor: brandColor, boxShadow: `0 10px 20px -5px ${brandColor}` }}
            >
              {busy ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
              {busy ? "Verifying..." : "Verify & Continue"}
            </Button>

            <div className="mt-8 text-center">
              {timer > 0 ? (
                <p className="text-sm font-medium text-muted-foreground">
                  Resend code in <span className="text-foreground">{timer}s</span>
                </p>
              ) : (
                <button 
                  onClick={resendCode} 
                  disabled={busy}
                  className="text-sm font-bold hover:underline transition-all"
                  style={{ color: brandColor }}
                >
                  Didn't receive the code? Resend
                </button>
              )}
            </div>
          </div>
          
          <p className="mt-8 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Secured by 256-bit encryption
          </p>
        </div>
      </div>
    </div>
  );
}
