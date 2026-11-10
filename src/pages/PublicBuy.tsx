import { useState } from "react";
import { Link } from "react-router-dom";
import { BriefcaseBusiness, CheckCircle, GraduationCap, Search, ShieldCheck, Smartphone, Tv, Users, Zap } from "lucide-react";
import { BuyDataFlow } from "@/components/buy/BuyDataFlow";
import { BuyAirtimeFlow } from "@/components/buy/BuyAirtimeFlow";
import { PayBillsFlow } from "@/components/buy/PayBillsFlow";
import { ResultCheckerFlow } from "@/components/buy/ResultCheckerFlow";
import { PublicHeader } from "@/components/PublicHeader";
import { PillTab, PillTabs } from "@/components/shared/PillTabs";
import { Button } from "@/components/ui/button";

type BuyTab = "data" | "airtime" | "bill" | "checker";

const BUY_TABS: PillTab<BuyTab>[] = [
  { value: "data", label: "Data", icon: <Zap className="h-4 w-4 shrink-0" /> },
  { value: "airtime", label: "Airtime", icon: <Smartphone className="h-4 w-4 shrink-0" /> },
  { value: "bill", label: "Bills", icon: <Tv className="h-4 w-4 shrink-0" /> },
  { value: "checker", label: "Checkers", icon: <GraduationCap className="h-4 w-4 shrink-0" /> },
];

const HEADERS: Record<BuyTab, { title: string; desc: string }> = {
  data: {
    title: "Buy Mobile Data",
    desc: "Pick a network, choose a bundle, and pay with MoMo or card. Done in under 60 seconds.",
  },
  airtime: {
    title: "Buy Airtime",
    desc: "Instant top-ups for MTN, Telecel, and AirtelTigo. No registration required.",
  },
  bill: {
    title: "Pay Utility Bills",
    desc: "Pay DSTV, GOTV, StarTimes & ECG Prepaid instantly with secure validation.",
  },
  checker: {
    title: "WAEC Result Checkers",
    desc: "Buy WASSCE, BECE, CSSPS & NOVDEC checker vouchers with instant PIN delivery.",
  },
};

const TRUST_ITEMS = [
  { icon: Zap, title: "Instant delivery", desc: "Transactions complete on your line within seconds." },
  { icon: ShieldCheck, title: "Secure Payments", desc: "PCI-DSS certified checkout. We never store card details." },
  { icon: CheckCircle, title: "No account needed", desc: "Buy as a guest — just enter your details." },
  { icon: Users, title: "10,000+ happy customers", desc: "Trusted by resellers and everyday buyers across Ghana." },
];

const NETWORKS = [
  { emoji: "🟡", name: "MTN", detail: "Non-expiry bundles" },
  { emoji: "🔴", name: "Telecel", detail: "Monthly bundles" },
  { emoji: "🔵", name: "AirtelTigo", detail: "Monthly bundles" },
];

const CARD = "overflow-hidden rounded-2xl border border-border bg-card shadow-soft";
const CARD_HEADING = "border-b border-border bg-secondary/40 px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground";

export default function PublicBuyPage() {
  const [activeTab, setActiveTab] = useState<BuyTab>(() => {
    const tab = new URLSearchParams(window.location.search).get("tab")?.toLowerCase();
    return tab === "airtime" || tab === "bill" || tab === "data" || tab === "checker" ? tab : "data";
  });

  const header = HEADERS[activeTab];

  return (
    <div className="min-h-dvh bg-background">
      <PublicHeader current="buy" />

      <div className="mx-auto max-w-6xl space-y-4 px-3 py-4 md:space-y-5 md:px-6 md:py-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground md:text-3xl">{header.title}</h1>
          <p className="mt-0.5 text-xs text-muted-foreground md:mt-1 md:text-sm">{header.desc}</p>
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px] xl:gap-5">
          <div className="min-w-0 space-y-4">
            <div className={CARD}>
              <div className="border-b border-border p-2">
                <PillTabs tabs={BUY_TABS} value={activeTab} onChange={setActiveTab} stretch tabClassName="py-2" />
              </div>
              <div className="p-4 md:p-6">
                {activeTab === "data" && <BuyDataFlow />}
                {activeTab === "airtime" && <BuyAirtimeFlow />}
                {activeTab === "bill" && <PayBillsFlow />}
                {activeTab === "checker" && <ResultCheckerFlow />}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-soft">
              <span className="text-sm text-muted-foreground">Already paid? Find your order here.</span>
              <Link to="/track" className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:underline">
                <Search className="h-3.5 w-3.5" /> Track my order
              </Link>
            </div>
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-4">
              <div className={CARD}>
                <p className={CARD_HEADING}>Why OneGig?</p>
                <div className="space-y-4 p-4">
                  {TRUST_ITEMS.map(({ icon: Icon, title, desc }) => (
                    <div key={title} className="flex gap-3">
                      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{title}</p>
                        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className={CARD}>
                <p className={CARD_HEADING}>Networks supported</p>
                <div className="space-y-2 p-4">
                  {NETWORKS.map((n) => (
                    <div key={n.name} className="flex items-center gap-3 rounded-xl border border-border bg-background px-3 py-2.5">
                      <span className="text-xl">{n.emoji}</span>
                      <div>
                        <p className="text-sm font-semibold text-foreground">{n.name}</p>
                        <p className="text-[10px] text-muted-foreground">{n.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-card p-4 shadow-soft">
                <BriefcaseBusiness className="mb-2 h-5 w-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">Buying frequently?</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
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
