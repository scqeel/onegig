import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/hooks/useSettings";
import { ArrowRight, BriefcaseBusiness, CheckCircle, Loader2, ShieldCheck, TrendingUp, Users } from "lucide-react";

const inputCls = "h-12 rounded-xl border-border/50 bg-secondary/40 text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:border-primary/50 transition-all";

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

  const [busy, setBusy] = useState(false);
  const [siEmail, setSiEmail] = useState("");
  const [siPassword, setSiPassword] = useState("");
  const [suFullName, setSuFullName] = useState("");
  const [suUsername, setSuUsername] = useState("");
  const [suEmail, setSuEmail] = useState("");
  const [suPassword, setSuPassword] = useState("");

  useEffect(() => {
    if (!loading && session) nav(from || "/dashboard/agent", { replace: true });
  }, [session, loading, nav, from]);

  const doSignIn = async () => {
    if (!siEmail || !siPassword) {
      toast({ title: "Enter your email and password", variant: "destructive" });
      return;
    }
    setBusy(true);
    const { error } = await authClient.signInWithPassword({
      email: siEmail.trim().toLowerCase(),
      password: siPassword,
    });
    setBusy(false);
    if (error) toast({ title: "Sign in failed", description: error.message, variant: "destructive" });
  };

  const doSignUp = async () => {
    if (!suFullName || !suUsername || !suEmail || !suPassword) {
      toast({ title: "Please fill in all fields", variant: "destructive" });
      return;
    }
    const normalizedEmail = suEmail.trim().toLowerCase();
    setBusy(true);
    try {
      const { data, error } = await authClient.signUp({
        email: normalizedEmail,
        password: suPassword,
        options: { data: { full_name: suFullName.trim(), username: suUsername.toLowerCase().trim() } },
      });
      if (error) { toast({ title: "Sign up failed", description: error.message, variant: "destructive" }); return; }
      if (data.session) {
        toast({ title: "Account created", description: "Continue to activate your agent account." });
        nav("/dashboard/agent", { replace: true });
        return;
      }
      const { error: signInErr } = await authClient.signInWithPassword({ email: normalizedEmail, password: suPassword });
      if (signInErr) {
        toast({ title: "Account created", description: "Please sign in to continue." });
      } else {
        toast({ title: "Account created", description: "Continue to activate your agent account." });
        nav("/dashboard/agent", { replace: true });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unexpected error. Please try again.";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    } finally {
      setBusy(false);
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
                  <BriefcaseBusiness className="h-3 w-3" /> Agent Portal
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">Sign in</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  Access your reseller dashboard, store pricing, and withdrawals.
                </p>
              </div>

              <div className="space-y-4">
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
                  <label className="text-xs font-semibold text-foreground">Password</label>
                  <Input
                    type="password" placeholder="••••••••"
                    value={siPassword} onChange={(e) => setSiPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSignIn()}
                    className={inputCls}
                  />
                </div>
                <Button onClick={doSignIn} disabled={busy} className="h-12 w-full rounded-xl font-bold gradient-primary shadow-float">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Sign in <ArrowRight className="ml-1.5 h-4 w-4" /></>}
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
                  <BriefcaseBusiness className="h-3 w-3" /> Agent Registration
                </span>
                <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">Create account</h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  For resellers only. Set prices, manage your store, and earn on every sale.
                </p>
              </div>

              <div className="space-y-4">
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
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Email address</label>
                  <Input
                    type="email" inputMode="email" placeholder="you@example.com"
                    value={suEmail} onChange={(e) => setSuEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Password</label>
                  <Input
                    type="password" placeholder="Create a strong password"
                    value={suPassword} onChange={(e) => setSuPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && doSignUp()}
                    className={inputCls}
                  />
                </div>

                {/* Perks reminder */}
                <div className="rounded-xl border border-primary/15 bg-primary/5 px-4 py-3">
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

                <Button onClick={doSignUp} disabled={busy} className="h-12 w-full rounded-xl font-bold gradient-primary shadow-float">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Create account <ArrowRight className="ml-1.5 h-4 w-4" /></>}
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
