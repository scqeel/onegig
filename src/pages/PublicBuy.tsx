import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, BriefcaseBusiness, CheckCircle, Search, ShieldCheck, Users, Zap, Smartphone, Tv } from "lucide-react";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { BuyAirtimeFlow } from "@/components/buy/BuyAirtimeFlow";
import { PayBillsFlow } from "@/components/buy/PayBillsFlow";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TRUST_ITEMS = [
  { icon: Zap, title: "Instant delivery", desc: "Transactions complete on your line within seconds." },
  { icon: ShieldCheck, title: "Secure Payments", desc: "PCI-DSS certified checkout. We never store card details." },
  { icon: CheckCircle, title: "No account needed", desc: "Buy as a guest — just enter your details." },
  { icon: Users, title: "10,000+ happy customers", desc: "Trusted by resellers and everyday buyers across Ghana." },
];

export default function PublicBuyPage() {
  const [activeTab, setActiveTab] = useState<"data" | "airtime" | "bill">(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab")?.toLowerCase();
    if (tab === "airtime" || tab === "bill" || tab === "data") return tab as any;
    return "data";
  });

  const getHeaderInfo = () => {
    switch (activeTab) {
      case "airtime":
        return {
          title: "Buy Airtime",
          desc: "Instant top-ups for MTN, Telecel, and AirtelTigo. No registration required."
        };
      case "bill":
        return {
          title: "Pay Utility Bills",
          desc: "Pay DSTV, GOTV, StarTimes & ECG Prepaid instantly with secure validation."
        };
      default:
        return {
          title: "Buy Mobile Data",
          desc: "Pick a network, choose a bundle, and pay with MoMo or card. Done in under 60 seconds."
        };
    }
  };

  const header = getHeaderInfo();

  return (
    <div className="min-h-dvh bg-background">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-30 border-b border-border/40 glass">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 md:px-8">
          <Link to="/">
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="h-8 gap-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground dark:hover:text-white">
              <Link to="/track">
                <Search className="h-3.5 w-3.5" /> Track Order
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="h-8 rounded-lg text-xs dark:border-slate-800 dark:hover:bg-slate-900">
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
          <h1 className="text-3xl font-bold text-white md:text-4xl transition-all duration-300">{header.title}</h1>
          <p className="mt-2 max-w-lg text-sm text-white/50 transition-all duration-300">
            {header.desc}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">

          {/* ── Main flow ── */}
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[2rem] glass-card">
              {/* Tab Switcher Headers */}
              <div className="border-b border-border/40 bg-secondary/10 dark:bg-slate-900/10 p-2 flex gap-1">
                {[
                  { id: "data", label: "Buy Data", icon: Zap },
                  { id: "airtime", label: "Buy Airtime", icon: Smartphone },
                  { id: "bill", label: "Pay Bills", icon: Tv }
                ].map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setActiveTab(t.id as any)}
                      className={cn(
                        "flex-1 py-3 px-4 rounded-2xl flex items-center justify-center gap-2 font-bold text-xs md:text-sm transition-all duration-200",
                        activeTab === t.id
                          ? "bg-slate-950 text-white shadow-float border border-slate-800"
                          : "text-muted-foreground hover:text-foreground hover:bg-secondary/20 dark:hover:bg-slate-900/20"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", activeTab === t.id ? "text-primary" : "text-slate-400")} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab Content */}
              <div className="p-6 md:p-8">
                {activeTab === "data" && <BuyDataFlow />}
                {activeTab === "airtime" && <BuyAirtimeFlow />}
                {activeTab === "bill" && <PayBillsFlow />}
              </div>
            </div>

            {/* Already paid strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-4 glass-card">
              <span className="text-sm text-muted-foreground dark:text-slate-400">Already paid? Find your order here.</span>
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
              <div className="overflow-hidden rounded-2xl glass-card">
                <div className="border-b border-border/45 bg-secondary/20 dark:bg-slate-900/20 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-slate-400">Why OneGig?</p>
                </div>
                <div className="space-y-4 p-4">
                  {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground dark:text-white">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground dark:text-slate-400">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Networks */}
              <div className="overflow-hidden rounded-2xl glass-card">
                <div className="border-b border-border/45 bg-secondary/20 dark:bg-slate-900/20 px-4 py-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground dark:text-slate-400">Networks supported</p>
                </div>
                <div className="space-y-2 p-4">
                  {[
                    { emoji: "🟡", name: "MTN", detail: "Non-expiry bundles" },
                    { emoji: "🔴", name: "Telecel", detail: "Monthly bundles" },
                    { emoji: "🔵", name: "AirtelTigo", detail: "Monthly bundles" },
                  ].map((n) => (
                    <div
                      key={n.name}
                      className="flex items-center gap-3 rounded-xl border border-border/30 dark:border-slate-800/40 bg-secondary/10 dark:bg-slate-900/10 px-3 py-2.5 hover:bg-secondary/20 dark:hover:bg-slate-900/20 transition-colors"
                    >
                      <span className="text-xl">{n.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground dark:text-white">{n.name}</p>
                        <p className="text-[10px] text-muted-foreground dark:text-slate-400">{n.detail}</p>
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
