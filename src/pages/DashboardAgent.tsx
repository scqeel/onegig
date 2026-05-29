import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, Shield, TrendingUp, Users, Wallet } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { BecomeAgent } from "@/components/buy/BecomeAgent";

const BENEFITS = [
  {
    icon: TrendingUp,
    title: "Profit on each order",
    desc: "Set your own sell prices and keep 100% of the margin on every bundle sold.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Your own store link",
    desc: "Get a branded link — customers can discover, bookmark, and reorder from you directly.",
  },
  {
    icon: Users,
    title: "Build a customer base",
    desc: "Your store is always live. Customers order from you anytime, even while you sleep.",
  },
  {
    icon: Shield,
    title: "Secure withdrawals",
    desc: "Track lifetime earnings and request MoMo payouts from your dashboard at any time.",
  },
];

export default function DashboardAgentPage() {
  const { isAgent } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (isAgent) nav("/agent", { replace: true });
  }, [isAgent, nav]);

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Dark hero ── */}
      <div className="relative overflow-hidden bg-[#080c1a]">
        <div className="pointer-events-none absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full bg-primary/20 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />

        <div className="relative mx-auto max-w-5xl px-5 pb-16 pt-12 md:px-8">
          <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-xs text-white/35 hover:text-white/60 transition-colors">
            ← Back to homepage
          </Link>

          <div className="flex flex-wrap items-center gap-3 mb-5">
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
              <BriefcaseBusiness className="h-3 w-3" /> Agent Program
            </span>
          </div>

          <h1 className="text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Activate your<br />
            <span className="gradient-text">agent store.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/50">
            One-time activation fee. Unlimited earning potential. Join 10,000+ agents already running their data businesses on OneGig.
          </p>

          {/* Mini stats */}
          <div className="mt-8 flex flex-wrap gap-6">
            {[
              { value: "10,000+", label: "Active agents" },
              { value: "GH₵M+", label: "Paid out monthly" },
              { value: "< 60s", label: "Order fulfilment" },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-xs text-white/40">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-5xl px-5 py-10 md:px-8">
        <div className="grid gap-5 lg:grid-cols-12">

          {/* Benefits */}
          <section className="lg:col-span-5 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-primary">What you get</p>
            {BENEFITS.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-card p-4 shadow-soft hover:shadow-float transition-shadow">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/15 px-4 py-3 mt-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground">
                Activation required before your store goes live. One-time payment.
              </p>
            </div>
          </section>

          {/* Activation */}
          <section className="overflow-hidden rounded-3xl border border-border/60 bg-card shadow-float lg:col-span-7">
            <div className="border-b border-border/60 bg-[#080c1a] px-6 py-5 md:px-8">
              <div className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-bold text-white">Complete Activation</h3>
              </div>
              <p className="mt-1 text-sm text-white/50">Pay once to unlock your agent store and start earning.</p>
            </div>
            <div className="p-5 md:p-7">
              <BecomeAgent onClose={() => {}} />
            </div>
          </section>
        </div>

        {/* Bottom CTA strip */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-6 py-4 shadow-soft">
          <div>
            <p className="text-sm font-bold text-foreground">Already an agent?</p>
            <p className="text-xs text-muted-foreground">Sign in to access your store dashboard.</p>
          </div>
          <Link
            to="/auth?tab=signin"
            className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
          >
            Sign in to dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
