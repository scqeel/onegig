import { Link } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, CheckCircle, Search, ShieldCheck, Users, Zap } from "lucide-react";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";

const TRUST_ITEMS = [
  { icon: Zap, title: "Instant delivery", desc: "Data lands on your line within seconds of payment." },
  { icon: ShieldCheck, title: "Secure Payments", desc: "PCI-DSS certified checkout. We never store card details." },
  { icon: CheckCircle, title: "No account needed", desc: "Buy as a guest — just a phone number and email." },
  { icon: Users, title: "10,000+ happy customers", desc: "Trusted by resellers and everyday buyers across Ghana." },
];

export default function PublicBuyPage() {
  return (
    <div className="min-h-dvh bg-background">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground">
              <Link to="/track">
                <Search className="h-3.5 w-3.5" /> Track Order
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs">
              <Link to="/auth?tab=signin">Agent Sign In</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ── Dark page header band ── */}
      <div className="relative overflow-hidden bg-[#080c1a]">
        <div className="pointer-events-none absolute -top-20 left-1/4 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background to-transparent" />
        <div className="relative mx-auto max-w-6xl px-5 py-10 md:px-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-white/40 hover:text-white/70 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <h1 className="text-3xl font-bold text-white md:text-4xl">Buy Mobile Data</h1>
          <p className="mt-2 max-w-lg text-sm text-white/50">
            Pick a network, choose a bundle, and pay with MoMo or card. Done in under 60 seconds.
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">

          {/* ── Main flow ── */}
          <div className="space-y-4">
            <div className="overflow-hidden rounded-3xl border border-border/60 bg-white shadow-float">
              <div className="border-b border-border/60 bg-secondary/30 px-6 py-4">
                <p className="text-sm font-bold text-foreground">Select a bundle and pay</p>
                <p className="mt-0.5 text-xs text-muted-foreground">No account required · Instant delivery</p>
              </div>
              <div className="p-5 md:p-7">
                <BuyDataFlow />
              </div>
            </div>

            {/* Already paid strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/60 bg-white px-5 py-3.5 shadow-soft">
              <span className="text-sm text-muted-foreground">Already paid? Find your order here.</span>
              <Link
                to="/track"
                className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <Search className="h-3.5 w-3.5" /> Track my order
              </Link>
            </div>
          </div>

          {/* ── Trust sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">

              {/* Why us */}
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-soft">
                <div className="border-b border-border/60 bg-secondary/30 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Why OneGig?</p>
                </div>
                <div className="space-y-4 p-4">
                  {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Networks */}
              <div className="overflow-hidden rounded-2xl border border-border/60 bg-white shadow-soft">
                <div className="border-b border-border/60 bg-secondary/30 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Networks supported</p>
                </div>
                <div className="space-y-2 p-4">
                  {[
                    { emoji: "🟡", name: "MTN", detail: "Non-expiry bundles" },
                    { emoji: "🔴", name: "Telecel", detail: "Monthly bundles" },
                    { emoji: "🔵", name: "AirtelTigo", detail: "Monthly bundles" },
                  ].map((n) => (
                    <div
                      key={n.name}
                      className="flex items-center gap-3 rounded-xl border border-border/60 bg-secondary/30 px-3 py-2.5 hover:bg-secondary/60 transition-colors"
                    >
                      <span className="text-xl">{n.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{n.name}</p>
                        <p className="text-[10px] text-muted-foreground">{n.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Agent CTA */}
              <div className="relative overflow-hidden rounded-2xl bg-[#080c1a] p-4">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
                <div className="relative">
                  <BriefcaseBusiness className="h-5 w-5 text-primary mb-2" />
                  <p className="text-sm font-bold text-white">Buying frequently?</p>
                  <p className="mt-1 text-xs text-white/50 leading-relaxed">
                    Get wholesale prices and earn margins as an agent.
                  </p>
                  <Button asChild size="sm" className="mt-3 h-8 w-full rounded-xl text-xs font-bold gradient-primary shadow-float">
                    <Link to="/auth?intent=agent">Become an Agent</Link>
                  </Button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
