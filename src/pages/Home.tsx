import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight, BadgeCheck, BarChart3, BriefcaseBusiness, CheckCircle, Clock, Globe, Loader2,
  Search, ShieldCheck, Star, TrendingUp, Users, Volume2, VolumeX, Wallet, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { DraggableWhatsApp } from "@/components/agent/DraggableWhatsApp";
import { BundleCard } from "@/components/buy/BundleCard";
import { MtnStatusWidget } from "@/components/MtnStatusWidget";
import { PublicLayout } from "@/components/PublicLayout";
import { PillTabs } from "@/components/shared/PillTabs";
import { StatCard, StatCardVariant } from "@/components/shared/StatCard";
import { StatusRibbon } from "@/components/shared/StatusRibbon";
import { useNetworks, useBundles } from "@/hooks/useNetworksAndBundles";
import { useSettings } from "@/hooks/useSettings";
import { supabase } from "@/integrations/supabase/client";
import { formatGHS } from "@/lib/format";

const DATA_NETWORK_CODES = ["MTN", "TELECEL", "VODAFONE", "AT", "AIRTELTIGO"];
const CHECKERS_TAB = "checkers";
const BUNDLES_SHOWN = 8;

const TESTIMONIALS = [
  { name: "Akosua M.", location: "Kumasi", text: "I've been using OneGig for my reselling business for months. Prices are unbeatable and delivery is always instant.", stars: 5, role: "Data Reseller", initials: "AM" },
  { name: "Kwame A.", location: "Accra", text: "Bought data for my family and it came through in under a minute. No sign-up stress — just pick and pay.", stars: 5, role: "Regular Customer", initials: "KA" },
  { name: "Efua D.", location: "Cape Coast", text: "Best wholesale prices I've found. My agent store has been running smoothly since day one.", stars: 5, role: "Agent / Reseller", initials: "ED" },
];

const FAQS = [
  { q: "Do I need an account to buy data?", a: "No. You can purchase data as a guest — just enter the recipient's number, choose a bundle, and pay. No sign-up required." },
  { q: "How fast is delivery?", a: "Data is delivered within seconds after payment confirmation. MTN non-expiry bundles are activated instantly." },
  { q: "What payment methods are accepted?", a: "We accept MTN MoMo, Telecel Cash, AirtelTigo Money, and debit/credit cards." },
  { q: "What is an Agent account?", a: "Agents buy data at wholesale rates, set their own prices, and share a personal store link. You earn the margin on every sale your customers make." },
  { q: "Is my payment secure?", a: "Yes. All payments are processed securely by a PCI-DSS certified payment provider. We never store your card details." },
];

const TRUST_ITEMS = [
  { emoji: "🟡", name: "MTN Ghana" }, { emoji: "🔴", name: "Telecel" },
  { emoji: "🔵", name: "AirtelTigo" }, { emoji: "🔒", name: "Secured Payments" },
  { emoji: "💳", name: "MoMo Accepted" }, { emoji: "⚡", name: "Instant Delivery" },
  { emoji: "🛡️", name: "PCI-DSS Certified" }, { emoji: "🌍", name: "Ghana-Wide" },
];

const STATS: { value: string; label: string; sub: string; icon: React.ReactNode; variant: StatCardVariant }[] = [
  { value: "10K+", label: "Active Resellers", sub: "growing daily", icon: <Users className="h-5 w-5" />, variant: "primary" },
  { value: "< 60s", label: "Avg. Delivery", sub: "guaranteed speed", icon: <Clock className="h-5 w-5" />, variant: "emerald" },
  { value: "4.8★", label: "Customer Rating", sub: "verified reviews", icon: <Star className="h-5 w-5" />, variant: "amber" },
  { value: "GH₵M+", label: "Monthly Volume", sub: "trusted scale", icon: <TrendingUp className="h-5 w-5" />, variant: "rose" },
];

const FEATURES = [
  { icon: TrendingUp, title: "Wholesale Prices", desc: "Get the lowest prices in Ghana, direct from network partnerships. No hidden fees, no markups.", badge: "Up to 30% cheaper" },
  { icon: Zap, title: "Instant Delivery", desc: "Data lands on your number in seconds after payment. No manual steps, no waiting around.", badge: "Under 60 seconds" },
  { icon: ShieldCheck, title: "Secure Payments", desc: "Every transaction is protected by a PCI-DSS certified payment gateway.", badge: "PCI-DSS certified" },
  { icon: Users, title: "Agent Program", desc: "Open your store, set your margins, share your link — earn on every order, automatically.", badge: "Earn while you sleep" },
  { icon: Globe, title: "All Major Networks", desc: "MTN, Telecel, and AirtelTigo — every major Ghanaian network covered with great bundles.", badge: "3 networks" },
  { icon: Clock, title: "Always Available", desc: "Buy any time of day or night. Our platform is live 24/7 — we never close, never sleep.", badge: "24/7 uptime" },
];

const STEPS = [
  { icon: Search, step: "01", title: "Choose your bundle", desc: "Pick a network — MTN, Telecel, or AirtelTigo — then select the bundle size that suits you." },
  { icon: ShieldCheck, step: "02", title: "Pay securely", desc: "Pay via MoMo, card, or mobile money. Secured by a trusted gateway." },
  { icon: Zap, step: "03", title: "Receive instantly", desc: "Data hits your line within seconds. No delays, no follow-up calls, no manual processing." },
];

const AGENT_FEATURES = [
  { icon: BarChart3, title: "Set your margins", desc: "Price bundles how you like and keep the full difference." },
  { icon: Users, title: "Your own store", desc: "A branded link your customers can bookmark and reorder from." },
  { icon: Zap, title: "Auto fulfilment", desc: "Orders are filled automatically, 24/7 — zero manual effort." },
  { icon: Wallet, title: "Secure payouts", desc: "Earnings go to your wallet. Withdraw to MoMo whenever you like." },
];

const SECTION_LABEL = "text-[10px] font-bold uppercase tracking-wider text-muted-foreground";
const CARD = "rounded-2xl border border-border bg-card shadow-soft";
const ICON_TILE = "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary";

export default function HomePage() {
  const nav = useNavigate();
  const { data: settings } = useSettings();
  const { data: networks = [] } = useNetworks();
  const dataNetworks = networks.filter((n) => DATA_NETWORK_CODES.includes(n.code.toUpperCase()));
  const [pickedNetworkId, setPickedNetworkId] = useState<string | null>(null);
  const network = dataNetworks.find((n) => n.id === pickedNetworkId) ?? dataNetworks[0];
  const { data: bundles = [], isLoading: loadingBundles } = useBundles(network?.id ?? null);

  const { data: homeBgVideo } = useQuery({
    queryKey: ["home-bg-video"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "home_page_bg_video").maybeSingle();
      return String(data?.value ?? "");
    },
    staleTime: 60_000,
  });
  const [isMuted, setIsMuted] = useState(true);

  return (
    <PublicLayout
      active="home"
      title="Mobile data, delivered in seconds."
      subtitle="Direct wholesale access to MTN Non-Expiry, Telecel, AirtelTigo, and WAEC Result Checkers at true market prices. No login required."
      topActions={
        <Button asChild className="h-10 rounded-xl px-5 text-sm font-semibold">
          <Link to="/buy">Buy Data Now <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
        </Button>
      }
    >
      <StatusRibbon
        icon={<Zap className="h-5 w-5 fill-primary text-primary" />}
        title="Live · Ghana-wide network"
        subtitle={TRUST_ITEMS.slice(3).map((b, i) => (
          <span key={b.name} className="flex items-center gap-2">
            {i > 0 && <span className="opacity-30">•</span>}
            {b.name}
          </span>
        ))}
        actions={TRUST_ITEMS.slice(0, 3).map((b) => (
          <div key={b.name} className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-background/80 px-3.5 py-2 text-xs font-semibold text-muted-foreground shadow-sm">
            <span>{b.emoji}</span>
            <span className="whitespace-nowrap">{b.name}</span>
          </div>
        ))}
      />

      {homeBgVideo && (
        <div className={`relative overflow-hidden ${CARD}`}>
          <video src={homeBgVideo} autoPlay loop muted={isMuted} playsInline className="h-48 w-full object-cover md:h-64" />
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-background/80 text-foreground transition-transform active:scale-95"
            aria-label={isMuted ? "Unmute video" : "Mute video"}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* The quick order console is the first thing on the page: pick a network, pick a bundle, pay. */}
      <section className={`space-y-4 p-4 md:p-5 ${CARD}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className={SECTION_LABEL}>Quick Order</p>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">
              {network ? `${network.name} Packages` : "Choose a network"}
            </h2>
          </div>
          <Link to="/buy" className="flex items-center gap-1 text-xs font-semibold text-foreground hover:underline">
            View All Bundles <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <PillTabs
          tabs={[
            ...dataNetworks.map((n) => ({ value: n.id, label: n.name })),
            { value: CHECKERS_TAB, label: "Checkers" },
          ]}
          value={network?.id ?? ""}
          onChange={(value) => (value === CHECKERS_TAB ? nav("/buy?tab=checker") : setPickedNetworkId(value))}
          stretch
          tabClassName="px-1 py-2 text-[11px] sm:text-xs"
        />

        {loadingBundles || !network ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : bundles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border py-10 text-center text-xs text-muted-foreground">
            No active bundles available.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-4">
            {bundles.slice(0, BUNDLES_SHOWN).map((b) => (
              <BundleCard
                key={b.id}
                networkCode={network.code}
                networkName={network.name}
                sizeLabel={b.size_label}
                price={formatGHS(Number(b.user_price ?? 0))}
                active={false}
                onClick={() => nav(`/buy?network=${network.code}&bundleLabel=${encodeURIComponent(b.size_label)}`)}
              />
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-3 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-emerald-500" /> Instant MoMo Dispatch</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-emerald-500" /> 100% Auto-Refund Guard</span>
          <span className="flex items-center gap-1.5"><Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9/5 Rating (12.4k+ Orders)</span>
        </div>
      </section>

      <MtnStatusWidget />

      <section className="space-y-3">
        <p className={SECTION_LABEL}>Trusted by resellers across Ghana</p>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {STATS.map(({ value, label, sub, icon, variant }) => (
            <StatCard key={label} title={label} value={value} helper={sub} icon={icon} variant={variant} />
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className={SECTION_LABEL}>Why OneGig</p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">Built for resellers. Loved by everyone.</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {FEATURES.map(({ icon: Icon, title, desc, badge }) => (
            <div key={title} className={`p-5 ${CARD}`}>
              <div className="flex items-start justify-between gap-3">
                <div className={ICON_TILE}><Icon className="h-5 w-5" /></div>
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{badge}</span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className={SECTION_LABEL}>Simple process</p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">Buy data in under a minute</h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {STEPS.map(({ icon: Icon, step, title, desc }) => (
            <div key={step} className={`flex gap-4 p-5 md:flex-col ${CARD}`}>
              <div className={ICON_TILE}><Icon className="h-5 w-5" /></div>
              <div>
                <span className={SECTION_LABEL}>Step {step}</span>
                <h3 className="mt-0.5 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className={`flex items-center gap-1.5 ${SECTION_LABEL}`}><BadgeCheck className="h-3.5 w-3.5" /> Verified Reseller Reviews</p>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">Real people. Real results.</h2>
          </div>
          <p className="flex items-center gap-1 text-xs font-semibold text-foreground">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.8 out of 5
            <span className="font-normal text-muted-foreground">· 3,200+ reviews</span>
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className={`flex flex-col p-5 ${CARD}`}>
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: t.stars }).map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="flex-1 text-sm leading-relaxed text-foreground">"{t.text}"</p>
              <div className="mt-4 flex items-center gap-3 border-t border-border pt-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/40 text-xs font-bold text-foreground">{t.initials}</div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{t.role} · {t.location}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={`grid gap-5 p-5 md:p-6 xl:grid-cols-2 ${CARD}`}>
        <div>
          <p className={`flex items-center gap-1.5 ${SECTION_LABEL}`}><BriefcaseBusiness className="h-3.5 w-3.5" /> For Wholesale Resellers</p>
          <h2 className="mt-1 text-2xl font-bold text-foreground">Turn data into residual income.</h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            Join over 10,000+ resellers earning on every sale. Open your customized storefront in minutes, configure bundle markups, and let auto-fulfillment do the rest.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <Button asChild className="h-11 rounded-xl px-6 font-semibold">
              <Link to="/auth?intent=agent"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Become an Agent</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 rounded-xl px-6 font-semibold">
              <Link to="/auth?tab=signin">Sign In</Link>
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {AGENT_FEATURES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="rounded-xl border border-border bg-background p-4">
              <Icon className="h-4 w-4 text-primary" />
              <p className="mt-2 text-sm font-semibold text-foreground">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <p className={SECTION_LABEL}>FAQ</p>
          <h2 className="mt-0.5 text-lg font-bold text-foreground">Frequently asked questions</h2>
        </div>
        <Accordion type="single" collapsible className="space-y-2.5">
          {FAQS.map((faq, i) => (
            <AccordionItem key={i} value={`faq-${i}`} className={`px-5 ${CARD}`}>
              <AccordionTrigger className="py-4 text-left text-sm font-semibold text-foreground hover:no-underline">{faq.q}</AccordionTrigger>
              <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <DraggableWhatsApp link={settings?.whatsapp_group_link || "https://whatsapp.com/channel/0029VbDOyktLdQelDfBClj3y"} />
    </PublicLayout>
  );
}
