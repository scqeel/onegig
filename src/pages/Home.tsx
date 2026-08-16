import { Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle,
  ChevronRight,
  Clock,
  Globe,
  Menu,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  User,
  Users,
  Wallet,
  Zap,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useEffect, useRef, useState } from "react";
import { DraggableWhatsApp } from "@/components/agent/DraggableWhatsApp";
import { MtnStatusWidget } from "@/components/MtnStatusWidget";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { useSettings } from "@/hooks/useSettings";

/* ─────────────────────────────────────────────
   Scroll-reveal hook
   ───────────────────────────────────────────── */
function useInView(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ─────────────────────────────────────────────
   Animation delay class strings
   (must be fully-written literals so Tailwind JIT generates their CSS)
   ───────────────────────────────────────────── */
// Hero badge entrance delay
const HD = { badge: "[animation-delay:0ms]" };

// Section stagger arrays — index maps to each item
const SD = {
  stats:  ["[transition-delay:150ms]","[transition-delay:250ms]","[transition-delay:350ms]","[transition-delay:450ms]"] as const,
  feats:  ["[animation-delay:100ms]","[animation-delay:175ms]","[animation-delay:250ms]","[animation-delay:325ms]","[animation-delay:400ms]","[animation-delay:475ms]"] as const,
  steps:  ["[animation-delay:180ms]","[animation-delay:310ms]","[animation-delay:440ms]"] as const,
  tests:  ["[animation-delay:120ms]","[animation-delay:230ms]","[animation-delay:340ms]"] as const,
  clist:  ["[animation-delay:380ms]","[animation-delay:460ms]","[animation-delay:540ms]","[animation-delay:620ms]"] as const,
  ccards: ["[animation-delay:180ms]","[animation-delay:270ms]","[animation-delay:360ms]","[animation-delay:450ms]"] as const,
  faq:    ["[animation-delay:80ms]","[animation-delay:150ms]","[animation-delay:220ms]","[animation-delay:290ms]","[animation-delay:360ms]"] as const,
};

/* ─────────────────────────────────────────────
   Static data
   ───────────────────────────────────────────── */
const NETWORKS = [
  {
    id: "mtn", name: "MTN", emoji: "🟡", tag: "Non-Expiry",
    bundles: [{ label: "1 GB", price: "GH₵4.20" }, { label: "5 GB", price: "GH₵22.30" }, { label: "10 GB", price: "GH₵41.00" }, { label: "20 GB", price: "GH₵80.00" }, { label: "50 GB", price: "GH₵200.00" }],
  },
  {
    id: "telecel", name: "Telecel", emoji: "🔴", tag: "Monthly",
    bundles: [{ label: "5 GB", price: "GH₵19.50" }, { label: "10 GB", price: "GH₵36.50" }, { label: "20 GB", price: "GH₵69.80" }, { label: "30 GB", price: "GH₵105.00" }, { label: "50 GB", price: "GH₵171.50" }],
  },
  {
    id: "airtel", name: "AirtelTigo", emoji: "🔵", tag: "Monthly",
    bundles: [{ label: "1 GB", price: "GH₵3.95" }, { label: "5 GB", price: "GH₵19.50" }, { label: "10 GB", price: "GH₵38.50" }, { label: "20 GB", price: "GH₵75.00" }, { label: "30 GB", price: "GH₵115.00" }],
  },
  {
    id: "result_checkers", name: "Result Checkers", emoji: "🎓", tag: "WAEC Vouchers",
    bundles: [
      { label: "WASSCE Result Checker 🎓", price: "GH₵25.00" },
      { label: "BECE Result Checker 🎓", price: "GH₵22.00" },
      { label: "CSSPS Placement Checker 🏫", price: "GH₵20.00" },
      { label: "NOVDEC Result Checker 🎓", price: "GH₵25.00" },
    ],
  },
];

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

const FEATURES = [
  { icon: TrendingUp, title: "Wholesale Prices",  desc: "Get the lowest prices in Ghana, direct from network partnerships. No hidden fees, no markups.", badge: "Up to 30% cheaper" },
  { icon: Zap,        title: "Instant Delivery",  desc: "Data lands on your number in seconds after payment. No manual steps, no waiting around.",         badge: "Under 60 seconds" },
  { icon: ShieldCheck,title: "Secure Payments",   desc: "Every transaction is protected by a PCI-DSS certified payment gateway.",          badge: "PCI-DSS certified" },
  { icon: Users,      title: "Agent Program",     desc: "Open your store, set your margins, share your link — earn on every order, automatically.",         badge: "Earn while you sleep" },
  { icon: Globe,      title: "All Major Networks",desc: "MTN, Telecel, and AirtelTigo — every major Ghanaian network covered with great bundles.",          badge: "3 networks" },
  { icon: Clock,      title: "Always Available",  desc: "Buy any time of day or night. Our platform is live 24/7 — we never close, never sleep.",           badge: "24/7 uptime" },
];

const STEPS = [
  { icon: Search,      step: "01", title: "Choose your bundle", desc: "Pick a network — MTN, Telecel, or AirtelTigo — then select the bundle size that suits you." },
  { icon: ShieldCheck, step: "02", title: "Pay securely",       desc: "Pay via MoMo, card, or mobile money. Secured by a trusted gateway." },
  { icon: Zap,         step: "03", title: "Receive instantly",  desc: "Data hits your line within seconds. No delays, no follow-up calls, no manual processing." },
];

const AGENT_FEATURES = [
  { icon: BarChart3, title: "Set your margins", desc: "Price bundles how you like and keep the full difference." },
  { icon: Users,     title: "Your own store",   desc: "A branded link your customers can bookmark and reorder from." },
  { icon: Zap,       title: "Auto fulfilment",  desc: "Orders are filled automatically, 24/7 — zero manual effort." },
  { icon: Wallet,    title: "Secure payouts",   desc: "Earnings go to your wallet. Withdraw to MoMo whenever you like." },
];

const AGENT_CHECKLIST = [
  "Set your own prices and keep the full margin",
  "Get a branded store link in minutes",
  "Orders fulfilled 24/7 — zero manual effort",
  "Withdraw earnings to MoMo anytime",
];

/* ─────────────────────────────────────────────
   Page component
   The marketing page is a fixed dark ("ink") surface regardless of the
   visitor's app-wide theme preference — the global theme toggle still
   controls the rest of the app (dashboard, admin), just not this page.
   ───────────────────────────────────────────── */
export default function HomePage() {
  const [activeNetwork, setActiveNetwork] = useState("mtn");
  const network = NETWORKS.find((n) => n.id === activeNetwork)!;
  const { user, isAdmin, isAgent, signOut } = useAuth();
  const { data: settings } = useSettings();

  const dashboardPath = isAdmin ? '/admin' : isAgent ? '/agent' : '/dashboard/customer';
  const dashboardLabel = isAdmin ? 'Admin Dashboard' : isAgent ? 'Agent Dashboard' : 'My Dashboard';

  const { data: homeBg } = useQuery({
    queryKey: ["home-bg"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "home_page_bg").maybeSingle();
      return data?.value || "/bg-ancient-1.png";
    },
    staleTime: 60_000,
  });

  const { data: homeBgVideo } = useQuery({
    queryKey: ["home-bg-video"],
    queryFn: async () => {
      const { data } = await supabase.from("app_settings").select("value").eq("key", "home_page_bg_video").maybeSingle();
      return data?.value || "";
    },
    staleTime: 60_000,
  });

  const [isMuted, setIsMuted] = useState(true);

  const bgStyle = homeBg && homeBg !== "none" ? { backgroundImage: `url(${homeBg})`, backgroundSize: "cover", backgroundPosition: "center" } : {};

  const { ref: statsRef,        inView: statsInView }        = useInView(0.15);
  const { ref: featuresRef,     inView: featuresInView }     = useInView(0.08);
  const { ref: stepsRef,        inView: stepsInView }        = useInView(0.08);
  const { ref: testimonialsRef, inView: testimonialsInView } = useInView(0.08);
  const { ref: ctaRef,          inView: ctaInView }          = useInView(0.08);
  const { ref: faqRef,          inView: faqInView }          = useInView(0.08);

  return (
    <main className="dark min-h-dvh bg-background overflow-x-hidden">

      {/* ── Navbar (floating pill) ── */}
      <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 pointer-events-none">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-border bg-background/90 backdrop-blur-md px-4 md:px-6 pointer-events-auto transition-all">
          <Logo size="md" />

          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/verify-number" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-colors">
              <ShieldCheck className="h-3.5 w-3.5" /> Verify Number
            </Link>
            <Link to="/submit-numbers" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Send className="h-3.5 w-3.5" /> Submit Numbers
            </Link>
            <Link to="/track" className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <Search className="h-3.5 w-3.5" /> Track Order
            </Link>
            {user ? (
              <Link to={dashboardPath} className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                {dashboardLabel}
              </Link>
            ) : (
              <Link to="/auth?tab=signin" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                Agent Sign In
              </Link>
            )}
            <Button asChild className="ml-2 h-10 rounded-full px-6 text-sm">
              <Link to="/buy">Buy Data Now</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-foreground hover:bg-accent" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 border-l border-border bg-background p-6">
                <SheetHeader className="mb-8 text-left">
                  <SheetTitle><Logo size="sm" /></SheetTitle>
                  <SheetDescription className="sr-only">Navigation</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3">
                  <SheetClose asChild>
                    <Link to="/buy" className="group flex items-center justify-between rounded-2xl bg-primary p-4 transition-all active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/15">
                          <Zap className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="font-semibold text-primary-foreground">Buy Data Now</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-primary-foreground/70 group-hover:text-primary-foreground transition-colors" />
                    </Link>
                  </SheetClose>

                  <SheetClose asChild>
                    <Link to="/verify-number" className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:bg-accent active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/10">
                          <ShieldCheck className="h-4 w-4 text-emerald-500" />
                        </div>
                        <span className="font-semibold text-foreground">Verify Number</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  </SheetClose>

                  <SheetClose asChild>
                    <Link to="/submit-numbers" className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:bg-accent active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-500/10">
                          <Send className="h-4 w-4 text-blue-500" />
                        </div>
                        <span className="font-semibold text-foreground">Submit Numbers</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  </SheetClose>

                  <SheetClose asChild>
                    <Link to="/track" className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:bg-accent active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                          <Search className="h-4 w-4 text-primary" />
                        </div>
                        <span className="font-semibold text-foreground">Track Order</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </Link>
                  </SheetClose>

                  {user ? (
                    <>
                      <SheetClose asChild>
                        <Link to={dashboardPath} className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:bg-accent active:scale-[0.98]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                              <BriefcaseBusiness className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-semibold text-foreground">{dashboardLabel}</span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <button onClick={signOut} className="group w-full flex items-center justify-between rounded-2xl border border-destructive/20 bg-destructive/5 p-4 transition-all hover:bg-destructive/10 active:scale-[0.98]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-destructive/10">
                              <User className="h-4 w-4 text-destructive" />
                            </div>
                            <span className="font-semibold text-destructive">Log Out</span>
                          </div>
                        </button>
                      </SheetClose>
                    </>
                  ) : (
                    <SheetClose asChild>
                      <Link to="/auth?tab=signin" className="group flex items-center justify-between rounded-2xl border border-border bg-card p-4 transition-all hover:bg-accent active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <span className="font-semibold text-foreground">Agent Sign In</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </Link>
                    </SheetClose>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-background min-h-[92dvh] flex items-center pt-24 pb-16 lg:pt-32 lg:pb-28" style={bgStyle}>
        {/* Background video rendering */}
        {homeBgVideo && (
          <video
            src={homeBgVideo}
            autoPlay
            loop
            muted={isMuted}
            playsInline
            className="absolute inset-0 h-full w-full object-cover z-0 pointer-events-none"
          />
        )}

        {/* Subtle texture when no image or video is configured */}
        {(!homeBg || homeBg === "none") && !homeBgVideo && (
          <div className="pointer-events-none absolute inset-0 grid-pattern-dark opacity-60" />
        )}

        {/* Functional scrim so text stays legible over a photo/video background */}
        {((homeBg && homeBg !== "none") || homeBgVideo) && (
          <div className="absolute inset-0 bg-background/70 z-10" />
        )}

        {/* Floating Mute/Unmute toggle button */}
        {homeBgVideo && (
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80 text-foreground transition-all hover:scale-105 active:scale-95 pointer-events-auto"
            aria-label={isMuted ? "Unmute background video" : "Mute background video"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        )}

        <div className="relative z-20 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 pt-4 pb-12">
          <div className="flex flex-col items-center gap-12 lg:grid lg:grid-cols-12 lg:gap-14">

            {/* LEFT COLUMN */}
            <div className="w-full text-center lg:col-span-6 lg:text-left flex flex-col items-center lg:items-start space-y-6">

              {/* Live status badge */}
              <div className={cn("inline-flex items-center gap-2.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-muted-foreground animate-hero-badge", HD.badge)}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                <span className="uppercase tracking-widest text-[10px] text-foreground">Live · Ghana-wide network</span>
              </div>

              {/* Headline */}
              <h1 className="text-4xl sm:text-5xl font-bold leading-[1.05] tracking-tighter md:text-6xl lg:text-[4.25rem] text-foreground">
                <span className="block">Mobile data,</span>
                <span className="block text-primary">delivered in seconds.</span>
              </h1>

              {/* Sub-headline */}
              <p className="max-w-xl text-base sm:text-lg leading-relaxed text-muted-foreground">
                Direct wholesale access to MTN Non-Expiry, Telecel, AirtelTigo, and WAEC Result Checkers at true market prices. <span className="text-foreground font-semibold">No login required.</span>
              </p>

              {/* Quick Order Console */}
              <div className="w-full max-w-lg rounded-[1.75rem] border border-border bg-card p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-2 w-2 rounded-full bg-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      Quick Order
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary bg-primary/10 px-2.5 py-1 rounded-full border border-primary/20">
                    Instant delivery
                  </span>
                </div>

                {/* Network Segmented Switcher Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {NETWORKS.map((n) => {
                    const active = activeNetwork === n.id;
                    return (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => setActiveNetwork(n.id)}
                        className={cn(
                          "flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-colors cursor-pointer",
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                        )}
                      >
                        <span className="text-sm shrink-0">{n.emoji}</span>
                        <span className="truncate text-[11px]">{n.id === "result_checkers" ? "Checkers" : n.name}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Package Quick Preview */}
                <div className="flex items-center justify-between rounded-xl border border-border bg-background px-4 py-3 text-xs">
                  <div className="flex items-center gap-2.5">
                    <span className="text-lg">{network.emoji}</span>
                    <div>
                      <span className="font-semibold text-foreground block">{network.name} Popular Bundle</span>
                      <span className="text-[11px] text-muted-foreground">{network.bundles[0]?.label} — <strong className="text-primary font-semibold">{network.bundles[0]?.price}</strong></span>
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider bg-secondary px-2 py-1 rounded-md border border-border">
                    Wholesale
                  </span>
                </div>

                {/* Action Button Bar */}
                <div className="grid sm:grid-cols-12 gap-2.5 pt-1">
                  <Button
                    asChild
                    size="lg"
                    className="sm:col-span-8 rounded-xl text-sm"
                  >
                    <Link to={`/buy?network=${network.id.toUpperCase()}`}>
                      Buy {network.name} Now <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    size="lg"
                    className="sm:col-span-4 rounded-xl text-xs px-4"
                  >
                    <Link to="/track">Track Order</Link>
                  </Button>
                </div>
              </div>

              {/* DataHub Live Status Widget */}
              <MtnStatusWidget className="w-full max-w-lg" />

              {/* Trust Badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-xs font-semibold text-muted-foreground pt-2">
                <span className="flex items-center gap-1.5">
                  <CheckCircle className="h-4 w-4 text-emerald-500" /> Instant MoMo Dispatch
                </span>
                <span className="flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-primary" /> 100% Auto-Refund Guard
                </span>
                <span className="flex items-center gap-1.5">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> 4.9/5 Rating (12.4k+ Orders)
                </span>
              </div>
            </div>

            {/* RIGHT COLUMN: BUNDLE DECK */}
            <div className="w-full max-w-md lg:col-span-6 lg:max-w-none relative">
              <div className="relative overflow-hidden rounded-[1.75rem] border border-border bg-card p-4.5 sm:p-6 space-y-5">

                <div className="flex items-center justify-between border-b border-border pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-lg">
                      {network.emoji}
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">{network.name} Packages</h3>
                      <p className="text-xs text-muted-foreground">Select package & buy instantly</p>
                    </div>
                  </div>

                  <span className="rounded-full border border-border bg-background px-3 py-1 text-[10px] font-semibold tracking-wider uppercase text-muted-foreground">
                    {network.tag}
                  </span>
                </div>

                {/* Interactive Bundles List */}
                <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                  {network.bundles.map((b, i) => {
                    const isBest = i === 0;
                    const netCode = network.id === "mtn" ? "MTN" : (network.id === "telecel" ? "TELECEL" : (network.id === "result_checkers" ? "RESULT_CHECKER" : "AT"));
                    return (
                      <Link
                        key={b.label}
                        to={`/buy?network=${netCode}&bundleLabel=${encodeURIComponent(b.label)}`}
                        className={cn(
                          "group flex items-center justify-between rounded-xl border p-4 transition-colors cursor-pointer active:scale-[0.99]",
                          isBest
                            ? "border-primary/40 bg-primary/5"
                            : "border-border bg-background hover:bg-accent"
                        )}
                      >
                        <div className="flex items-center gap-3.5">
                          <div className={cn(
                            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                            isBest ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"
                          )}>
                            <Smartphone className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-foreground leading-tight">{b.label}</p>
                            {isBest && (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-primary leading-none block mt-0.5">Reseller Choice</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <span className={cn("text-sm font-semibold tracking-tight", isBest ? "text-primary" : "text-foreground")}>
                            {b.price}
                          </span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </Link>
                    );
                  })}
                </div>

                {/* Bottom Bar */}
                <div className="border-t border-border pt-4 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-muted-foreground font-medium">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    <span>256-Bit Gateway Protection</span>
                  </div>

                  <Link
                    to="/buy"
                    className="font-semibold text-primary hover:text-primary/80 flex items-center gap-1 hover:underline"
                  >
                    View All Bundles <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>

          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </section>


      {/* ── Trust strip ── */}
      <div className="border-b border-border bg-background py-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2.5 px-4">
          {TRUST_ITEMS.map((b, i) => (
            <div key={i} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5">
              <span className="text-sm">{b.emoji}</span>
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="bg-background py-20 border-b border-border">
        <div ref={statsRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={cn(
            "rounded-[1.75rem] border border-border bg-card p-8 sm:p-10 transition-all duration-1000",
            statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="mb-10 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Trusted by resellers across Ghana
            </p>
            <div className="grid grid-cols-2 gap-y-10 gap-x-4 md:grid-cols-4 divide-y divide-border md:divide-y-0 md:divide-x divide-solid">
              {[
                { value: "10K+",   label: "Active Resellers", sub: "growing daily" },
                { value: "< 60s",  label: "Avg. Delivery",    sub: "guaranteed speed" },
                { value: "4.8★",   label: "Customer Rating",  sub: "verified reviews" },
                { value: "GH₵M+",  label: "Monthly Volume",   sub: "trusted scale" },
              ].map(({ value, label, sub }, i) => (
                <div
                  key={label}
                  className={cn(
                    "text-center transition-all duration-700 px-2",
                    i >= 2 ? "pt-10 md:pt-0" : "",
                    SD.stats[i]
                  )}
                >
                  <p className="text-4xl font-bold text-foreground md:text-5xl">{value}</p>
                  <p className="mt-3 text-sm font-semibold text-foreground/80">{label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 bg-background border-b border-border">
        <div ref={featuresRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={`mb-16 text-center transition-all duration-1000 ${featuresInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
              <Sparkles className="h-3 w-3" /> Why OneGig
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl lg:text-[2.75rem]">
              Built for resellers.<br className="hidden sm:block" />
              Loved by everyone.
            </h2>
            <p className="mt-4 mx-auto max-w-lg text-sm sm:text-base text-muted-foreground leading-relaxed">
              Whether you're topping up your own line or running a full data business, we have exactly what you need.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, badge }, i) => (
              <div
                key={title}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30 hover:-translate-y-0.5",
                  SD.feats[i],
                  featuresInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className="mb-5 flex items-start justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="rounded-full border border-primary/15 bg-primary/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">{badge}</span>
                </div>
                <h3 className="mb-2 text-base font-semibold text-foreground">{title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-background py-24 border-b border-border">
        <div ref={stepsRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          <div className={`mb-16 text-center transition-all duration-1000 ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-1.5 text-xs font-semibold text-muted-foreground">
              Simple process
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Buy data in under a minute</h2>
            <p className="mt-3 mx-auto max-w-sm text-muted-foreground text-sm">No technical knowledge required. Three steps and you're done.</p>
          </div>

          <div className="relative grid gap-5 md:grid-cols-3">
            {/* Horizontal Connector line (desktop) */}
            <div
              className={`absolute left-[calc(16.7%+2rem)] right-[calc(16.7%+2rem)] top-12 hidden h-px origin-left bg-border transition-transform duration-1000 ease-out [transition-delay:400ms] md:block ${stepsInView ? "scale-x-100" : "scale-x-0"}`}
            />
            {/* Vertical Connector line (mobile) */}
            <div className="absolute left-[32px] top-12 bottom-12 w-px bg-border md:hidden pointer-events-none" />

            {STEPS.map(({ icon: Icon, step, title, desc }, i) => (
              <div
                key={step}
                className={cn(
                  "group relative flex gap-5 items-start md:flex-col md:items-start rounded-2xl border border-border bg-card p-6 transition-all duration-300 hover:border-primary/30",
                  SD.steps[i],
                  stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 relative z-10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 md:mt-3">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-primary/80">Step {step}</span>
                  <h3 className="text-base font-semibold text-foreground mt-1 leading-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-12 text-center transition-all duration-700 [transition-delay:500ms] ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <Button asChild size="lg" className="h-12 rounded-xl px-10">
              <Link to="/buy">Get Started Free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-background border-b border-border">
        <div ref={testimonialsRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">

          <div className={`mb-16 text-center transition-all duration-1000 ${testimonialsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Verified Reseller Reviews
            </span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground md:text-4xl">Real people. Real results.</h2>
            <div className="mt-4 flex items-center justify-center gap-1 text-foreground">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />)}
              <span className="ml-2 text-sm font-semibold">4.8 out of 5</span>
              <span className="ml-1 text-sm text-muted-foreground">· 3,200+ reviews</span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={cn(
                  "group relative flex flex-col rounded-2xl border border-border bg-card p-6 transition-all duration-500 hover:border-primary/30",
                  SD.tests[i],
                  testimonialsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />)}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-foreground">"{t.text}"</p>

                <div className="mt-6 flex items-center gap-3 border-t border-border pt-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.role} · {t.location}</p>
                  </div>
                  <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-emerald-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent CTA ── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        <div ref={ctaRef} className="relative overflow-hidden rounded-[1.75rem] bg-card p-8 sm:p-12 md:p-16 border border-border">
          <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />

          <div className="relative flex flex-col gap-12 lg:grid lg:grid-cols-12 lg:gap-16 items-center">
            {/* Left Content Column */}
            <div className={cn(
              "w-full text-center lg:text-left lg:col-span-7 flex flex-col items-center lg:items-start transition-all duration-1000",
              ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> For Wholesale Resellers
              </span>
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl lg:text-5xl">
                Turn data into<br />
                <span className="text-primary">residual income.</span>
              </h2>
              <p className="mt-4 max-w-md text-sm sm:text-base leading-relaxed text-muted-foreground">
                Join over 10,000+ resellers earning on every sale. Open your customized storefront in minutes, configure bundle markups, and let auto-fulfillment do the rest.
              </p>

              <div className="mt-8 space-y-3.5 w-fit">
                {AGENT_CHECKLIST.map((item, i) => (
                  <div
                    key={item}
                    className={cn(
                      "flex items-center gap-3 transition-all duration-700",
                      SD.clist[i],
                      ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                    )}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500/15">
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    </div>
                    <span className="text-xs sm:text-sm font-medium text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap justify-center lg:justify-start gap-3 w-full sm:w-auto">
                <Button asChild className="h-12 rounded-xl px-8">
                  <Link to="/auth?intent=agent"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Become an Agent</Link>
                </Button>
                <Button asChild variant="ghost" className="h-12 rounded-xl px-6">
                  <Link to="/auth?tab=signin">Sign In →</Link>
                </Button>
              </div>
            </div>

            {/* Right Features Column */}
            <div className="w-full lg:col-span-5 grid grid-cols-2 gap-4">
              {AGENT_FEATURES.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className={cn(
                    "group rounded-2xl border border-border bg-background p-5 transition-all duration-500 hover:border-primary/30",
                    SD.ccards[i],
                    ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  )}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">{title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-border bg-background py-24">
        <div ref={faqRef} className="mx-auto max-w-2xl px-5 md:px-8">
          <div className={`mb-12 text-center ${faqInView ? "animate-in fade-in slide-in-from-bottom-6 duration-700" : "opacity-0"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">FAQ</span>
            <h2 className="mt-4 text-3xl font-bold tracking-tight text-foreground">Frequently asked questions</h2>
            <p className="mt-2 text-sm text-muted-foreground">Everything you need to know about OneGig</p>
          </div>

          <Accordion type="single" collapsible className="space-y-2.5">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className={cn(
                  "rounded-2xl border border-border bg-card px-5 transition-all data-[state=open]:border-primary/30",
                  SD.faq[i],
                  faqInView ? "animate-in fade-in slide-in-from-bottom-4 duration-500" : "opacity-0"
                )}
              >
                <AccordionTrigger className="py-4 text-sm font-semibold text-foreground hover:no-underline">{faq.q}</AccordionTrigger>
                <AccordionContent className="pb-4 text-sm leading-relaxed text-muted-foreground">{faq.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <p className={`mt-8 text-center text-sm text-muted-foreground [animation-delay:460ms] ${faqInView ? "animate-in fade-in duration-700" : "opacity-0"}`}>
            Still have questions?{" "}
            <a href="mailto:support@onegig.shop" className="font-semibold text-primary hover:underline">Email our support team</a>
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="md:col-span-1">
              <Logo size="md" />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
                Ghana's fastest, most affordable mobile data platform. Buy for yourself or build a thriving reselling business.
              </p>
              <div className="mt-6 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-muted-foreground">All systems operational</span>
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-3 gap-8">
              <div>
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Buy Data</p>
                <ul className="space-y-2.5 text-sm">
                  {[{ label: "MTN Bundles", to: "/buy" }, { label: "Telecel Bundles", to: "/buy" }, { label: "AirtelTigo Bundles", to: "/buy" }, { label: "Track Order", to: "/track" }].map((l) => (
                    <li key={l.label}><Link to={l.to} className="text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Agents</p>
                <ul className="space-y-2.5 text-sm">
                  {[{ label: "Sign In", to: "/auth?tab=signin" }, { label: "Become an Agent", to: "/auth?intent=agent" }, { label: "Create Account", to: "/auth?tab=signup" }].map((l) => (
                    <li key={l.label}><Link to={l.to} className="text-muted-foreground hover:text-foreground transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">Support</p>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="mailto:support@onegig.shop" className="text-muted-foreground hover:text-foreground transition-colors">support@onegig.shop</a></li>
                  <li><span className="text-muted-foreground">+233-55-116-1012</span></li>
                  <li><span className="text-muted-foreground">Available 24/7</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row">
            <p>© {new Date().getFullYear()} OneGig Ghana. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/buy" className="hover:text-foreground transition-colors">Privacy Policy</Link>
              <Link to="/buy" className="hover:text-foreground transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
      <DraggableWhatsApp link={settings?.whatsapp_group_link || "https://whatsapp.com/channel/0029VbDOyktLdQelDfBClj3y"} />
    </main>
  );
}
