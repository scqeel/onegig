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
      <header className="sticky top-0 z-30 border-b border-border bg-background/95">
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

      {/* ── Page header band ── */}
      <div className="relative overflow-hidden border-b border-border bg-secondary/30">
        <div className="relative mx-auto max-w-6xl px-5 py-10 md:px-8">
          <Link
            to="/"
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to home
          </Link>
          <h1 className="text-3xl font-bold text-foreground md:text-4xl transition-all duration-300">{header.title}</h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground transition-all duration-300">
            {header.desc}
          </p>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="mx-auto max-w-6xl px-5 py-8 md:px-8 md:py-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_300px]">

          {/* ── Main flow ── */}
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[1.75rem] border border-border bg-card">
              {/* Tab Switcher Headers */}
              <div className="border-b border-border bg-secondary/40 p-2 flex gap-1">
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
                        "flex-1 py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-xs md:text-sm transition-colors duration-200",
                        activeTab === t.id
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/60"
                      )}
                    >
                      <Icon className="h-4 w-4" />
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
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4">
              <span className="text-sm text-muted-foreground">Already paid? Find your order here.</span>
              <Link
                to="/track"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
              >
                <Search className="h-3.5 w-3.5" /> Track my order
              </Link>
            </div>
          </div>

          {/* ── Trust sidebar ── */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">

              {/* Why us */}
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-secondary/40 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Why OneGig?</p>
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
              <div className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="border-b border-border bg-secondary/40 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Networks supported</p>
                </div>
                <div className="space-y-2 p-4">
                  {[
                    { emoji: "🟡", name: "MTN", detail: "Non-expiry bundles" },
                    { emoji: "🔴", name: "Telecel", detail: "Monthly bundles" },
                    { emoji: "🔵", name: "AirtelTigo", detail: "Monthly bundles" },
                  ].map((n) => (
                    <div
                      key={n.name}
                      className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5 hover:bg-accent transition-colors"
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
              <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-4">
                <BriefcaseBusiness className="h-5 w-5 text-primary mb-2" />
                <p className="text-sm font-semibold text-foreground">Buying frequently?</p>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  Get wholesale prices and earn margins as an agent.
                </p>
                <Button asChild size="sm" className="mt-3 h-8 w-full rounded-xl text-xs">
                  <Link to="/auth?intent=agent">Become an Agent</Link>
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
