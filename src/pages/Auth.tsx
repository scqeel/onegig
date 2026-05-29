import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import { ArrowRight, BriefcaseBusiness, CheckCircle, Loader2, ShieldCheck, TrendingUp, Users, Eye, EyeOff } from "lucide-react";

const inputCls = "h-12 rounded-[14px] border border-slate-200 bg-white px-4 text-sm font-semibold text-foreground shadow-sm transition-all focus-visible:border-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/10 dark:border-slate-800 dark:bg-slate-950/50";

export default function AuthPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const authClient = supabase.auth as any;
  const { toast } = useToast();
  const { session, loading } = useAuth();
  const { data: settings } = useSettings();

  const from = (loc.state as { from?: string } | null)?.from;
  const tabParam = searchParams.get("tab");
  const intent = searchParams.get("intent");

  const isSignUp = tabParam === "signup" || intent === "agent";
  const switchTo = (t: "signin" | "signup") => setSearchParams({ tab: t }, { replace: true });

  const [accountType, setAccountType] = useState<"customer" | "agent">(intent === "agent" ? "agent" : "customer");
  const [busy, setBusy] = useState(false);
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [siMethod, setSiMethod] = useState<"email" | "phone">("email");
  const [siPhone, setSiPhone] = useState("");
  const [siOtp, setSiOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);

  const [suMethod, setSuMethod] = useState<"email" | "phone">("email");
  const [suFullName, setSuFullName] = useState("");
  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPhone, setSuPhone] = useState("");
  const [suPassword, setSuPassword] = useState("");
  const [suConfirmPassword, setSuConfirmPassword] = useState("");
  const [suOtpSent, setSuOtpSent] = useState(false);
  const [suOtp, setSuOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [siTimer, setSiTimer] = useState(0);
  const [suTimer, setSuTimer] = useState(0);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (siTimer > 0) {
      interval = setInterval(() => setSiTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [siTimer]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (suTimer > 0) {
      interval = setInterval(() => setSuTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [suTimer]);

  const formatPhone = (phone: string) => {
    let p = phone.replace(/[^0-9+]/g, "");
    if (p.startsWith("0")) p = "+233" + p.slice(1);
    else if (p.startsWith("233")) p = "+" + p;
    else if (!p.startsWith("+")) p = "+233" + p;
    return p;
  };

  useEffect(() => {
    if (!loading && session) nav(from || "/dashboard", { replace: true });
  }, [session, loading, nav, from]);

  const doSignIn = async () => {
    if (siMethod === "email") {
      if (!siEmail || !siPassword) return toast({ title: "Enter your email and password", variant: "destructive" });
      setBusy(true);
      const { error } = await authClient.signInWithPassword({ email: siEmail.trim().toLowerCase(), password: siPassword });
      setBusy(false);
      if (error) toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
    } else {
      if (!otpSent) {
        if (!siPhone) return toast({ title: "Enter your phone number", variant: "destructive" });
        setBusy(true);
        const formattedPhone = formatPhone(siPhone);
        const { error } = await authClient.signInWithOtp({ phone: formattedPhone });
        setBusy(false);
        if (error) {
          toast({ title: "Failed to send code", description: error.message, variant: "destructive" });
        } else {
          setOtpSent(true);
          setSiTimer(60);
          toast({ title: "Code sent", description: "Check your messages for the login code." });
        }
      } else {
        if (!siOtp) return toast({ title: "Enter the code", variant: "destructive" });
        setBusy(true);
        const formattedPhone = formatPhone(siPhone);
        const { error } = await authClient.verifyOtp({ phone: formattedPhone, token: siOtp.trim(), type: 'sms' });
        setBusy(false);
        if (error) toast({ title: "Invalid code", description: error.message, variant: "destructive" });
      }
    }
  };

  const doSignUp = async () => {
    if (!suFullName || !suUsername || !suPassword || !suConfirmPassword || !suEmail || !suPhone) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    
    if (suPassword !== suConfirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }
    
    if (suOtpSent) {
      if (!suOtp) return toast({ title: "Enter the verification code", variant: "destructive" });
      setBusy(true);
      const formattedPhone = formatPhone(suPhone);
      const { error } = await authClient.verifyOtp({ phone: formattedPhone, token: suOtp.trim(), type: 'sms' });
      setBusy(false);
      if (error) {
        toast({ title: "Invalid code", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Account verified", description: "Welcome to OneGig!" });
      nav(accountType === "agent" ? "/dashboard/agent" : "/dashboard/customer", { replace: true });
      return;
    }

    setBusy(true);
    try {
      const normalizedEmail = suEmail.trim().toLowerCase();
      const formattedPhone = formatPhone(suPhone);
      const options = { data: { full_name: suFullName.trim(), username: suUsername.toLowerCase().trim(), email_address: normalizedEmail } };
      
      const res = await authClient.signUp({ phone: formattedPhone, password: suPassword, options });

      if (res.error) { toast({ title: "Sign up failed", description: res.error.message, variant: "destructive" }); return; }
      
      if (res.data.session) {
        toast({ title: "Account created", description: "Welcome to OneGig!" });
        nav(accountType === "agent" ? "/dashboard/agent" : "/dashboard/customer", { replace: true });
        return;
      }
      
      setSuOtpSent(true);
      setSuTimer(60);
      toast({ title: "Verification required", description: "Please enter the code sent to your phone." });
      return;
      
      // Auto login attempt if no session returned immediately
      const signInRes = await authClient.signInWithPassword({ email: suEmail.trim().toLowerCase(), password: suPassword });
        
      if (signInRes.error) {
        toast({ title: "Account created", description: "Please sign in to continue." });
        switchTo("signin");
      } else {
        toast({ title: "Account created", description: "Welcome to OneGig!" });
        nav(accountType === "agent" ? "/dashboard/agent" : "/dashboard/customer", { replace: true });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error. Please try again.";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const resendSiOtp = async () => {
    if (siTimer > 0) return;
    setBusy(true);
    const formattedPhone = formatPhone(siPhone);
    const { error } = await authClient.signInWithOtp({ phone: formattedPhone });
    setBusy(false);
    if (error) {
      toast({ title: "Failed to resend code", description: error.message, variant: "destructive" });
    } else {
      setSiTimer(60);
      toast({ title: "Code resent", description: "A new code has been sent to your phone." });
    }
  };

  const resendSuOtp = async () => {
    if (suTimer > 0) return;
    setBusy(true);
    const formattedPhone = formatPhone(suPhone);
    const { error } = await authClient.resend({ type: 'sms', phone: formattedPhone });
    setBusy(false);
    if (error) {
      toast({ title: "Failed to resend code", description: error.message, variant: "destructive" });
    } else {
      setSuTimer(60);
      toast({ title: "Code resent", description: "A new code has been sent to your phone." });
    }
  };

  return (
    <div className="flex min-h-dvh">
      {/* ── Dark left panel ── */}
      <div className="relative hidden overflow-hidden bg-[#05080f] lg:flex lg:w-[460px] lg:flex-col xl:w-[520px]">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -left-20 h-96 w-96 rounded-full bg-violet-600/20 blur-[120px]" />
          <div className="absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-fuchsia-600/15 blur-3xl" />
          <div className="absolute inset-0 grid-pattern-dark opacity-50" />
        </div>

        <div className="relative flex flex-1 flex-col justify-between px-10 py-12 xl:px-14">
          {/* Logo */}
          <div>
            <div className="text-2xl font-bold font-display tracking-tight">
              <span className="gradient-text">One</span>
              <span className="text-white">Gig</span>
              <span className="ml-1 inline-block h-2 w-2 rounded-full bg-primary animate-float-pulse" />
            </div>
            <p className="mt-3 text-sm text-white/38 max-w-xs leading-relaxed">
              {settings?.platform_tagline ?? "Ghana's fastest wholesale data platform for agents and resellers."}
            </p>
          </div>

          {/* Feature cards */}
          <div className="my-10 space-y-3">
            {[
              {
                icon: TrendingUp,
                title: "Wholesale prices",
                desc: "Buy at base rates and keep 100% of your margin on every sale.",
                from: "from-violet-500", to: "to-purple-600",
              },
              {
                icon: Users,
                title: "Your own store link",
                desc: "Share your branded link. Customers order directly from you.",
                from: "from-blue-500", to: "to-cyan-600",
              },
              {
                icon: ShieldCheck,
                title: "Secure payouts",
                desc: "Track earnings and withdraw to MoMo at any time.",
                from: "from-green-500", to: "to-emerald-600",
              },
            ].map(({ icon: Icon, title, desc, from, to }) => (
              <div key={title} className="flex items-start gap-3.5 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 transition-colors hover:bg-white/[0.07]">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${from} ${to} shadow-sm`}>
                  <Icon className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-white/38">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom strip */}
          <div className="border-t border-white/[0.07] pt-6">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
              <p className="text-xs text-white/28">10,000+ active agents · Available 24/7</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── White right panel ── */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-white px-6 py-12 lg:px-14">
        {/* Mobile top glow */}
        <div className="pointer-events-none absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/6 blur-3xl lg:hidden" />

        <div className="relative w-full max-w-[460px]">
          {/* Top bar */}
          <div className="mb-8 flex items-center justify-between">
            <div className="lg:hidden text-xl font-bold font-display tracking-tight">
              <span className="gradient-text">One</span>
              <span className="text-foreground">Gig</span>
              <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-primary animate-float-pulse" />
            </div>
            <div className="hidden lg:block" />
            <Link to="/" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
              ← Back to homepage
            </Link>
          </div>

          {/* ── Sign In ── */}
          {!isSignUp && (
            <div className="animate-fade-up">
              <div className="mb-7">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  <Users className="h-3 w-3" /> Welcome Back
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">Sign in</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Access your dashboard, track orders, and manage your account.
                </p>
              </div>

              <div className="mb-6 flex rounded-[14px] bg-slate-100/80 p-1.5 shadow-inner dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => { setSiMethod("email"); setOtpSent(false); }}
                  className={`flex-1 rounded-[10px] py-2.5 text-xs font-extrabold transition-all duration-300 ${siMethod === "email" ? "bg-white text-primary shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setSiMethod("phone")}
                  className={`flex-1 rounded-[10px] py-2.5 text-xs font-extrabold transition-all duration-300 ${siMethod === "phone" ? "bg-white text-primary shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                  Phone Number
                </button>
              </div>

              <div className="space-y-4">
                {siMethod === "email" ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Email address</label>
                      <Input
                        autoFocus type="email" inputMode="email"
                        placeholder="you@example.com"
                        value={siEmail} onChange={(e) => setSiEmail(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground">Password</label>
                    <Link to="#" className="text-xs font-semibold text-primary hover:underline">Forgot password?</Link>
                  </div>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"} placeholder="Enter your password"
                      value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && doSignIn()}
                      className={`${inputCls} pr-10`}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Phone Number</label>
                      <Input
                        autoFocus={!otpSent} type="tel" inputMode="tel"
                        placeholder="0551234567"
                        disabled={otpSent}
                        value={siPhone} onChange={(e) => setSiPhone(e.target.value)}
                        className={inputCls}
                      />
                    </div>
                    {otpSent && (
                      <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                        <label className="text-xs font-semibold text-foreground text-center block">Verification Code</label>
                        <div className="flex justify-center pb-2">
                          <InputOTP 
                            maxLength={6} 
                            value={siOtp} 
                            onChange={(val) => {
                              setSiOtp(val);
                              if (val.length === 6 && !busy) {
                                setTimeout(() => document.getElementById("btn-signin-submit")?.click(), 50);
                              }
                            }}
                          >
                            <InputOTPGroup className="gap-2">
                              {[0, 1, 2, 3, 4, 5].map((i) => (
                                <InputOTPSlot 
                                  key={i} 
                                  index={i} 
                                  className="h-12 w-11 rounded-[12px] border border-slate-200 bg-white text-lg font-black shadow-sm transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 dark:border-slate-800 dark:bg-slate-950/50" 
                                />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <div className="flex items-center justify-between mt-3 px-1">
                          <button type="button" onClick={() => setOtpSent(false)} className="text-xs text-primary hover:underline font-semibold">Change number</button>
                          {siTimer > 0 ? (
                            <span className="text-xs text-muted-foreground font-medium">Resend in <span className="text-foreground">{siTimer}s</span></span>
                          ) : (
                            <button type="button" onClick={resendSiOtp} className="text-xs text-primary font-bold hover:underline">Try again</button>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button id="btn-signin-submit" onClick={doSignIn} disabled={busy} className="h-12 w-full rounded-[14px] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-violet-500/40">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                    {siMethod === "email" || otpSent ? "Sign in" : "Send Login Code"} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>}
                </Button>
              </div>

              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Need an agent account?{" "}
                  <button
                    type="button"
                    onClick={() => setSearchParams({ tab: "signup", intent: "agent" }, { replace: true })}
                    className="font-bold text-primary hover:text-primary/80"
                  >
                    Create one →
                  </button>
                </p>
                <p className="text-xs text-muted-foreground/60">
                  Just buying data? No account needed —{" "}
                  <Link to="/buy" className="underline hover:text-foreground">go to homepage</Link>.
                </p>
              </div>
            </div>
          )}

          {/* ── Sign Up ── */}
          {isSignUp && (
            <div className="animate-fade-up">
              <div className="mb-7">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                  {accountType === "agent" ? <><BriefcaseBusiness className="h-3 w-3" /> Agent Registration</> : <><Users className="h-3 w-3" /> Customer Registration</>}
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">Create account</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {accountType === "agent" ? "Set prices, manage your store, and earn on every sale." : "Track your purchases, easily reorder, and manage your account."}
                </p>
              </div>

              <div className="mb-6 flex rounded-[14px] bg-slate-100/80 p-1.5 shadow-inner dark:bg-slate-800/80">
                <button
                  type="button"
                  onClick={() => setAccountType("customer")}
                  className={`flex-1 rounded-[10px] py-2.5 text-xs font-extrabold transition-all duration-300 ${accountType === "customer" ? "bg-white text-primary shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                  I want to buy data
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType("agent")}
                  className={`flex-1 rounded-[10px] py-2.5 text-xs font-extrabold transition-all duration-300 ${accountType === "agent" ? "bg-white text-primary shadow-sm dark:bg-slate-950 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"}`}
                >
                  I want to resell
                </button>
              </div>



              <div className="space-y-4">
                {suOtpSent ? (
                  <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs font-semibold text-foreground text-center block">Verification Code</label>
                    <div className="flex justify-center pb-2">
                      <InputOTP 
                        maxLength={6} 
                        value={suOtp} 
                        onChange={(val) => {
                          setSuOtp(val);
                          if (val.length === 6 && !busy) {
                            setTimeout(() => document.getElementById("btn-signup-submit")?.click(), 50);
                          }
                        }}
                      >
                        <InputOTPGroup className="gap-2">
                          {[0, 1, 2, 3, 4, 5].map((i) => (
                            <InputOTPSlot 
                              key={i} 
                              index={i} 
                              className="h-12 w-11 rounded-[12px] border border-slate-200 bg-white text-lg font-black shadow-sm transition-all focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 dark:border-slate-800 dark:bg-slate-950/50" 
                            />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                      <button type="button" onClick={() => setSuOtpSent(false)} className="text-xs text-primary hover:underline font-semibold">Change number</button>
                      {suTimer > 0 ? (
                        <span className="text-xs text-muted-foreground font-medium">Resend in <span className="text-foreground">{suTimer}s</span></span>
                      ) : (
                        <button type="button" onClick={resendSuOtp} className="text-xs text-primary font-bold hover:underline">Try again</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Full name</label>
                        <Input
                          autoFocus placeholder="Kwame Mensah"
                          value={suFullName} onChange={(e) => setSuFullName(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Username</label>
                        <Input
                          placeholder="kwame123"
                          value={suUsername} onChange={(e) => setSuUsername(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Email address</label>
                        <Input
                          type="email" inputMode="email" placeholder="you@example.com"
                          value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-foreground">Phone Number</label>
                        <Input
                          type="tel" inputMode="tel" placeholder="0551234567"
                          value={suPhone} onChange={(e) => setSuPhone(e.target.value)}
                          className={inputCls}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"} placeholder="Create a strong password"
                          value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                          className={`${inputCls} pr-10`}
                        />
                        <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-foreground">Confirm Password</label>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"} placeholder="Confirm your password"
                          value={suConfirmPassword} onChange={(e) => setSuConfirmPassword(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && doSignUp()}
                          className={`${inputCls} pr-10`}
                        />
                      </div>
                    </div>

                    {/* Perks reminder */}
                    {accountType === "agent" && (
                      <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3 animate-in fade-in slide-in-from-top-2">
                        <p className="text-xs font-semibold text-primary mb-1.5">What you get as an agent</p>
                        <div className="space-y-1">
                          {["Wholesale prices on all bundles", "Your own shareable store link", "Earn margins on every sale"].map((p) => (
                            <div key={p} className="flex items-center gap-2">
                              <CheckCircle className="h-3 w-3 shrink-0 text-primary" />
                              <span className="text-xs text-muted-foreground">{p}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                <Button id="btn-signup-submit" onClick={doSignUp} disabled={busy} className="h-12 w-full rounded-[14px] bg-gradient-to-r from-violet-600 to-fuchsia-600 text-sm font-black text-white shadow-lg shadow-violet-500/25 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-violet-500/40">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>
                    {suOtpSent ? "Verify Code" : "Create account"} <ArrowRight className="ml-1.5 h-4 w-4" />
                  </>}
                </Button>
              </div>

              <div className="mt-6 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <button type="button" onClick={() => switchTo("signin")} className="font-bold text-primary hover:text-primary/80">
                    Sign in →
                  </button>
                </p>
                <p className="text-xs text-muted-foreground/60">Regular buyers don't need accounts to purchase data.</p>
              </div>
            </div>
          )}

          <p className="mt-10 text-xs text-muted-foreground/40">
            By continuing you agree to our terms and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}
