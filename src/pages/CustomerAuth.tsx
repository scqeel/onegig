import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { Phone, Lock, Loader2, ArrowLeft, ShieldCheck, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function CustomerAuthPage() {
  const { slug } = useParams<{ slug: string }>();
  const nav = useNavigate();
  const { toast } = useToast();
  const { session, loading: authLoading } = useAuth();

  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [authType, setAuthType] = useState<"login" | "signup">("login");
  const [otp, setOtp] = useState("");
  const [phase, setPhase] = useState<"phone" | "otp">("phone");
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && session) {
      nav(`/store/${slug}`, { replace: true });
    }
  }, [session, authLoading, nav, slug]);

  // Fetch Agent Profile for branding
  const { data: agent, isLoading: loadingAgent } = useQuery({
    queryKey: ["auth-store-profile", slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data } = await supabase
        .from("agent_profiles")
        .select("store_name, store_logo_url, store_brand_color")
        .eq("store_slug", slug!)
        .maybeSingle();
      return data;
    },
  });

  const brandColor = agent?.store_brand_color || "#10b981"; // default to emerald
  const storeName = agent?.store_name || "Store";

  const handleSendOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (authType === "signup" && !fullName.trim()) {
      return toast({ title: "Name required", description: "Please enter your full name to create an account", variant: "destructive" });
    }
    if (!phone || phone.length < 9) {
      return toast({ title: "Invalid phone", description: "Please enter a valid phone number", variant: "destructive" });
    }
    
    setBusy(true);
    try {
      let formattedPhone = phone.trim();
      if (formattedPhone.startsWith("0")) formattedPhone = "+233" + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith("+")) formattedPhone = "+233" + formattedPhone;

      const options = authType === "signup" ? { data: { full_name: fullName.trim() } } : undefined;
      const { error } = await supabase.auth.signInWithOtp({
        phone: formattedPhone,
        options,
      });

      if (error) throw error;
      
      setPhase("otp");
      setCountdown(60);
      toast({ title: "OTP Sent!", description: "Check your phone for the verification code." });
    } catch (e: any) {
      toast({ title: "Failed to send OTP", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const handleVerifyOtp = async (overrideOtp?: string) => {
    const finalOtp = overrideOtp || otp;
    if (!finalOtp || finalOtp.length < 6) return;
    
    setBusy(true);
    try {
      let formattedPhone = phone.trim();
      if (formattedPhone.startsWith("0")) formattedPhone = "+233" + formattedPhone.substring(1);
      else if (!formattedPhone.startsWith("+")) formattedPhone = "+233" + formattedPhone;

      const { error } = await supabase.auth.verifyOtp({
        phone: formattedPhone,
        token: finalOtp,
        type: 'sms'
      });

      if (error) throw error;
      
      toast({ title: "Verified successfully!", description: "You are now securely logged in." });
      nav(`/store/${slug}`, { replace: true });
    } catch (e: any) {
      toast({ title: "Verification Failed", description: e.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (loadingAgent || authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh bg-background relative overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">

        {/* Card Container */}
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-8 flex items-center justify-between">
            <button 
              onClick={() => nav(`/store/${slug}`)}
              className="inline-flex items-center text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to store
            </button>
            {agent?.store_logo_url ? (
               <img src={agent.store_logo_url} alt={storeName} className="h-8 w-8 rounded-lg object-cover shadow-sm" />
            ) : (
               <div className="flex h-8 w-8 items-center justify-center rounded-lg font-bold text-white text-xs shadow-sm" style={{ backgroundColor: brandColor }}>
                 {storeName?.[0]?.toUpperCase()}
               </div>
            )}
          </div>

          <div className="rounded-[1.75rem] border border-border bg-card p-8 relative overflow-hidden">

            {/* Top brand line */}
            <div className="absolute top-0 inset-x-0 h-1" style={{ backgroundColor: brandColor }} />

            <div className="flex justify-center mb-6 pt-2">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl border border-border"
                style={{
                  backgroundColor: `${brandColor}15`,
                  color: brandColor
                }}
              >
                {phase === "phone" ? <Wallet className="h-9 w-9" /> : <Lock className="h-9 w-9" />}
              </div>
            </div>

            <div className="text-center mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
                {phase === "phone" ? (authType === "login" ? "Secure Your Wallet" : "Create Account") : "Verify Phone"}
              </h1>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">
                {phase === "phone"
                  ? (authType === "login" ? `Sign in with your phone number to access your secure wallet at ${storeName}.` : `Sign up to create your secure wallet at ${storeName}.`)
                  : `We've sent a 6-digit security code to ${phone}.`
                }
              </p>
            </div>

            {phase === "phone" && (
              <div className="mb-6 flex rounded-xl bg-secondary p-1.5">
                <button
                  type="button"
                  onClick={() => setAuthType("login")}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-300 ${authType === "login" ? "bg-background shadow-soft text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  style={authType === "login" ? { color: brandColor } : {}}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setAuthType("signup")}
                  className={`flex-1 rounded-lg py-2.5 text-xs font-semibold transition-all duration-300 ${authType === "signup" ? "bg-background shadow-soft text-primary" : "text-muted-foreground hover:text-foreground"}`}
                  style={authType === "signup" ? { color: brandColor } : {}}
                >
                  Create Account
                </button>
              </div>
            )}

            {phase === "phone" ? (
              <form onSubmit={handleSendOtp} className="space-y-6">
                {authType === "signup" && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                      Full Name
                    </label>
                    <Input
                      autoFocus
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Kwame Mensah"
                      className="h-14 rounded-xl bg-background border-border text-lg font-semibold focus-visible:ring-4 transition-all"
                      style={{ '--tw-ring-color': `${brandColor}33` } as React.CSSProperties}
                      required
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pl-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      autoFocus={authType === "login"}
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="024 XXX XXXX"
                      className="h-14 pl-12 rounded-xl bg-background border-border text-lg font-semibold tracking-wider focus-visible:ring-4 transition-all"
                      style={{ '--tw-ring-color': `${brandColor}33` } as React.CSSProperties}
                      required
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={busy || phone.length < 9}
                  className="w-full h-14 rounded-xl text-white font-semibold text-lg transition-all hover:-translate-y-0.5"
                  style={{ backgroundColor: brandColor }}
                >
                  {busy ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Continue to Verify"}
                </Button>
              </form>
            ) : (
              <div className="space-y-8">
                <div className="flex justify-center">
                  <InputOTP 
                    maxLength={6} 
                    value={otp} 
                    onChange={(val) => {
                      setOtp(val);
                      if (val.length === 6 && !busy) {
                        handleVerifyOtp(val);
                      }
                    }}
                  >
                    <InputOTPGroup className="gap-2 sm:gap-3">
                      {[0, 1, 2, 3, 4, 5].map((i) => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-12 w-10 sm:h-14 sm:w-12 rounded-xl border border-border bg-background text-xl sm:text-2xl font-bold text-foreground shadow-soft transition-all focus-visible:ring-4"
                          style={{
                            ...(otp.length > i ? { borderColor: brandColor } : {}),
                            '--tw-ring-color': `${brandColor}33`
                          } as React.CSSProperties}
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <div className="flex flex-col gap-3">
                  <Button
                    onClick={() => handleVerifyOtp()}
                    disabled={otp.length < 6 || busy}
                    className="w-full h-14 rounded-xl text-white font-semibold text-lg transition-all"
                    style={{ backgroundColor: brandColor }}
                  >
                    {busy ? <Loader2 className="animate-spin h-5 w-5 mr-2" /> : "Verify & Login"}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => handleSendOtp()}
                    disabled={countdown > 0 || busy}
                    className="w-full h-12 rounded-xl text-muted-foreground font-semibold hover:bg-accent"
                  >
                    {countdown > 0 ? `Resend Code in ${countdown}s` : "Resend Security Code"}
                  </Button>

                  <Button
                    variant="ghost"
                    onClick={() => { setPhase("phone"); setOtp(""); }}
                    className="w-full h-12 rounded-xl text-muted-foreground font-semibold hover:bg-accent"
                  >
                    Change Phone Number
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground/70 flex items-center justify-center gap-1.5 font-medium">
            <ShieldCheck className="h-4 w-4" style={{ color: brandColor }} />
            Secured by AES-256 bit encryption
          </p>
        </div>
      </div>
    </div>
  );
}
