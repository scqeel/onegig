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
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  Users,
  Wallet,
  Zap,
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
// Hero — sequential stagger
const HD = {
  badge: "[animation-delay:0ms]",
  l1:    "[animation-delay:80ms]",
  l2:    "[animation-delay:210ms]",
  l3:    "[animation-delay:340ms]",
  para:  "[animation-delay:450ms]",
  btns:  "[animation-delay:560ms]",
  pips:  "[animation-delay:680ms]",
  card:  "[animation-delay:270ms]",
  fb1:   "[animation-delay:720ms]",
  fb2:   "[animation-delay:880ms]",
};

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
    tagColor: "bg-yellow-50 text-yellow-700 border-yellow-200",
    activeClass: "bg-yellow-400 text-yellow-900 border-yellow-400 shadow-[0_4px_12px_rgba(250,204,21,0.4)]",
    dotColor: "bg-yellow-400", rowHighlight: "bg-yellow-50 border-yellow-200/60", priceColor: "text-yellow-700",
    bundles: [{ label: "1 GB", price: "GH₵4.20" }, { label: "5 GB", price: "GH₵22.30" }, { label: "10 GB", price: "GH₵41.00" }, { label: "20 GB", price: "GH₵80.00" }, { label: "50 GB", price: "GH₵200.00" }],
  },
  {
    id: "telecel", name: "Telecel", emoji: "🔴", tag: "Monthly",
    tagColor: "bg-red-50 text-red-700 border-red-200",
    activeClass: "bg-red-500 text-white border-red-500 shadow-[0_4px_12px_rgba(239,68,68,0.35)]",
    dotColor: "bg-red-500", rowHighlight: "bg-red-50 border-red-200/60", priceColor: "text-red-600",
    bundles: [{ label: "5 GB", price: "GH₵19.50" }, { label: "10 GB", price: "GH₵36.50" }, { label: "20 GB", price: "GH₵69.80" }, { label: "30 GB", price: "GH₵105.00" }, { label: "50 GB", price: "GH₵171.50" }],
  },
  {
    id: "airtel", name: "AirtelTigo", emoji: "🔵", tag: "Monthly",
    tagColor: "bg-blue-50 text-blue-700 border-blue-200",
    activeClass: "bg-blue-500 text-white border-blue-500 shadow-[0_4px_12px_rgba(59,130,246,0.35)]",
    dotColor: "bg-blue-500", rowHighlight: "bg-blue-50 border-blue-200/60", priceColor: "text-blue-600",
    bundles: [{ label: "1 GB", price: "GH₵3.95" }, { label: "5 GB", price: "GH₵19.50" }, { label: "10 GB", price: "GH₵38.50" }, { label: "20 GB", price: "GH₵75.00" }, { label: "30 GB", price: "GH₵115.00" }],
  },
];

const TESTIMONIALS = [
  { name: "Akosua M.", location: "Kumasi", text: "I've been using OneGig for my reselling business for months. Prices are unbeatable and delivery is always instant.", stars: 5, role: "Data Reseller", initials: "AM", gradient: "from-violet-500 to-purple-600" },
  { name: "Kwame A.", location: "Accra", text: "Bought data for my family and it came through in under a minute. No sign-up stress — just pick and pay.", stars: 5, role: "Regular Customer", initials: "KA", gradient: "from-blue-500 to-cyan-500" },
  { name: "Efua D.", location: "Cape Coast", text: "Best wholesale prices I've found. My agent store has been running smoothly since day one.", stars: 5, role: "Agent / Reseller", initials: "ED", gradient: "from-green-500 to-emerald-500" },
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
  { icon: TrendingUp, title: "Wholesale Prices",  desc: "Get the lowest prices in Ghana, direct from network partnerships. No hidden fees, no markups.", badge: "Up to 30% cheaper",    from: "from-violet-500", to: "to-purple-600", glow: "group-hover:bg-violet-50" },
  { icon: Zap,        title: "Instant Delivery",  desc: "Data lands on your number in seconds after payment. No manual steps, no waiting around.",         badge: "Under 60 seconds",    from: "from-yellow-400", to: "to-orange-500", glow: "group-hover:bg-orange-50" },
  { icon: ShieldCheck,title: "Secure Payments",   desc: "Every transaction is protected by a PCI-DSS certified payment gateway.",          badge: "PCI-DSS certified",   from: "from-green-500",  to: "to-emerald-600",glow: "group-hover:bg-green-50"  },
  { icon: Users,      title: "Agent Program",     desc: "Open your store, set your margins, share your link — earn on every order, automatically.",         badge: "Earn while you sleep",from: "from-pink-500",   to: "to-rose-600",   glow: "group-hover:bg-pink-50"   },
  { icon: Globe,      title: "All Major Networks",desc: "MTN, Telecel, and AirtelTigo — every major Ghanaian network covered with great bundles.",          badge: "3 networks",          from: "from-blue-500",   to: "to-cyan-600",   glow: "group-hover:bg-blue-50"   },
  { icon: Clock,      title: "Always Available",  desc: "Buy any time of day or night. Our platform is live 24/7 — we never close, never sleep.",           badge: "24/7 uptime",         from: "from-indigo-500", to: "to-violet-600", glow: "group-hover:bg-indigo-50" },
];

const STEPS = [
  { icon: Search,      step: "01", title: "Choose your bundle", desc: "Pick a network — MTN, Telecel, or AirtelTigo — then select the bundle size that suits you.", from: "from-violet-500", to: "to-purple-600" },
  { icon: ShieldCheck, step: "02", title: "Pay securely",       desc: "Pay via MoMo, card, or mobile money. Secured by a trusted gateway.",   from: "from-fuchsia-500",to: "to-pink-600"   },
  { icon: Zap,         step: "03", title: "Receive instantly",  desc: "Data hits your line within seconds. No delays, no follow-up calls, no manual processing.",    from: "from-green-400",  to: "to-emerald-500"},
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
   ───────────────────────────────────────────── */
export default function HomePage() {
  const [activeNetwork, setActiveNetwork] = useState("mtn");
  const network = NETWORKS.find((n) => n.id === activeNetwork)!;

  const { ref: statsRef,        inView: statsInView }        = useInView(0.15);
  const { ref: featuresRef,     inView: featuresInView }     = useInView(0.08);
  const { ref: stepsRef,        inView: stepsInView }        = useInView(0.08);
  const { ref: testimonialsRef, inView: testimonialsInView } = useInView(0.08);
  const { ref: ctaRef,          inView: ctaInView }          = useInView(0.08);
  const { ref: faqRef,          inView: faqInView }          = useInView(0.08);

  return (
    <main className="min-h-dvh bg-white overflow-x-hidden">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 md:px-8">
          <Logo size="md" />
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/track" className="inline-flex h-9 items-center gap-1.5 rounded-xl px-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <Search className="h-3.5 w-3.5" /> Track Order
            </Link>
            <Link to="/auth?tab=signin" className="inline-flex h-9 items-center rounded-xl px-4 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Agent Sign In
            </Link>
            <Button asChild className="ml-2 h-9 rounded-xl px-5 text-sm font-bold gradient-primary shadow-float">
              <Link to="/buy">Buy Data Now</Link>
            </Button>
          </nav>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-white">
              <SheetHeader>
                <SheetTitle><Logo size="sm" /></SheetTitle>
                <SheetDescription className="sr-only">Navigation</SheetDescription>
              </SheetHeader>
              <div className="mt-8 space-y-3">
                <SheetClose asChild>
                  <Button asChild className="h-12 w-full rounded-xl gradient-primary font-bold text-sm">
                    <Link to="/buy">⚡ Buy Data Now</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild variant="outline" className="h-12 w-full rounded-xl text-sm">
                    <Link to="/track"><Search className="mr-2 h-4 w-4" /> Track Order</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild variant="ghost" className="h-12 w-full rounded-xl text-sm text-muted-foreground">
                    <Link to="/auth?tab=signin">Agent Sign In</Link>
                  </Button>
                </SheetClose>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-[#05080f]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 left-1/4 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px]" />
          <div className="absolute top-1/3 right-0 h-[450px] w-[450px] rounded-full bg-fuchsia-600/15 blur-[120px]" />
          <div className="absolute -bottom-20 left-0 h-[300px] w-[600px] rounded-full bg-indigo-700/10 blur-[130px]" />
          <div className="absolute inset-0 grid-pattern-dark opacity-60" />
        </div>

        <div className="relative mx-auto max-w-6xl px-5 pb-28 pt-16 md:px-8 md:pt-24 lg:pb-36 lg:pt-28">

          {/* Badge */}
          <div className={`mb-8 animate-hero-badge ${HD.badge}`}>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-2 text-xs font-semibold text-white/70 backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              Live · Ghana's #1 wholesale data platform
              <span className="rounded-full bg-primary/30 px-2 py-0.5 text-[10px] font-bold text-white/80">NEW</span>
            </span>
          </div>

          <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">

            {/* Left — staggered headline */}
            <div>
              <h1 className="text-5xl font-black leading-[1.04] tracking-tight md:text-6xl lg:text-[4.5rem]">
                <span className={`block text-white animate-fade-up ${HD.l1}`}>Buy data.</span>
                <span className={`block hero-gradient-text animate-fade-up ${HD.l2}`}>Save more.</span>
                <span className={`block text-white/25 font-bold animate-fade-up ${HD.l3}`}>Deliver instantly.</span>
              </h1>

              <p className={`mt-6 max-w-md text-lg leading-relaxed text-white/50 animate-fade-up ${HD.para}`}>
                Ghana's fastest mobile data platform — MTN, Telecel & AirtelTigo bundles at wholesale prices. No account needed, ever.
              </p>

              <div className={`mt-10 flex flex-wrap gap-3 animate-fade-up ${HD.btns}`}>
                <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base font-bold bg-white text-[#05080f] hover:bg-white/92 shadow-[0_8px_32px_rgba(139,92,246,0.4)] transition-all hover:shadow-[0_12px_40px_rgba(139,92,246,0.5)] hover:-translate-y-0.5">
                  <Link to="/buy">Buy Data Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base font-semibold border border-white/12 text-white/75 bg-white/[0.06] hover:bg-white/10 hover:text-white backdrop-blur-sm transition-all">
                  <Link to="/auth?intent=agent">Become an Agent <ChevronRight className="ml-1 h-5 w-5" /></Link>
                </Button>
              </div>

              <div className={`mt-8 flex flex-wrap gap-x-6 gap-y-2.5 animate-fade-up ${HD.pips}`}>
                {[
                  { icon: CheckCircle, text: "No account needed" },
                  { icon: Zap,         text: "Under 60s delivery" },
                  { icon: ShieldCheck, text: "Secured payments" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-2 text-sm text-white/35">
                    <Icon className="h-4 w-4 text-green-400/70" /> {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right — pricing card */}
            <div className={`relative animate-slide-right ${HD.card}`}>
              <div className="pointer-events-none absolute inset-0 -m-6 rounded-3xl bg-primary/15 blur-3xl" />

              <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-white/[0.04] p-1.5 shadow-[0_32px_80px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-2xl">
                <div className="rounded-[20px] bg-white p-5">

                  <div className="mb-5 flex gap-2">
                    {NETWORKS.map((n) => (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => setActiveNetwork(n.id)}
                        className={`flex-1 rounded-xl border py-2.5 text-xs font-bold transition-all duration-200 ${
                          activeNetwork === n.id
                            ? n.activeClass
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground bg-white"
                        }`}
                      >
                        {n.emoji} {n.name}
                      </button>
                    ))}
                  </div>

                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${network.dotColor} transition-colors duration-300`} />
                      <p className="text-sm font-bold text-foreground">{network.name} Bundles</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold transition-colors duration-300 ${network.tagColor}`}>
                      {network.tag}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {network.bundles.map((b, i) => (
                      <div
                        key={b.label}
                        className={`group flex items-center justify-between rounded-xl border px-3.5 py-2.5 transition-all cursor-pointer ${
                          i === 0 ? network.rowHighlight : "border-transparent hover:bg-secondary/50"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${i === 0 ? "bg-primary/12" : "bg-secondary/80"}`}>
                            <Smartphone className={`h-3 w-3 ${i === 0 ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-foreground">{b.label}</span>
                            {i === 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide text-primary">Best</span>}
                          </div>
                        </div>
                        <span className={`text-sm font-bold ${i === 0 ? network.priceColor : "text-foreground"}`}>{b.price}</span>
                      </div>
                    ))}
                  </div>

                  <Button asChild className="mt-4 h-11 w-full rounded-xl gradient-primary font-bold shadow-float text-sm">
                    <Link to="/buy">Order Now <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                  </Button>

                  <div className="mt-3 flex items-center justify-center gap-1.5">
                    <ShieldCheck className="h-3 w-3 text-green-500" />
                    <p className="text-center text-[11px] text-muted-foreground">
                      Secured Payments · PCI-DSS Certified
                    </p>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className={`absolute -right-3 -top-4 flex items-center gap-1.5 rounded-full border border-yellow-200/80 bg-white px-3 py-1.5 shadow-float animate-in zoom-in-75 duration-500 ${HD.fb1}`}>
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-black text-foreground">4.8</span>
                <span className="text-[10px] text-muted-foreground">· 3.2k+</span>
              </div>
              <div className={`absolute -left-3 bottom-16 flex items-center gap-2 rounded-full border border-green-200/70 bg-white px-3 py-2 shadow-float animate-in zoom-in-75 duration-500 ${HD.fb2}`}>
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-semibold text-foreground">⚡ Instant Delivery</span>
              </div>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/50 to-transparent" />
      </section>

      {/* ── Trust strip — auto-scrolling marquee ── */}
      <div className="overflow-hidden border-b border-border/40 bg-white py-4">
        <div className="animate-marquee flex w-max items-center gap-3 px-3">
          {[...TRUST_ITEMS, ...TRUST_ITEMS].map((b, i) => (
            <div key={i} className="flex shrink-0 items-center gap-1.5 rounded-full border border-border/50 bg-secondary/40 px-3 py-1.5">
              <span className="text-sm">{b.emoji}</span>
              <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">{b.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Stats ── */}
      <section className="bg-[#05080f] py-20">
        <div ref={statsRef} className="mx-auto max-w-6xl px-5 md:px-8">
          <p className={`mb-10 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-white/20 transition-all duration-700 ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            Trusted by thousands across Ghana
          </p>
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: "10K+",   label: "Active Resellers", sub: "and growing daily",        from: "from-violet-400", to: "to-purple-400" },
              { value: "< 60s",  label: "Avg. Delivery",    sub: "guaranteed speed",          from: "from-green-400",  to: "to-emerald-400" },
              { value: "4.8★",   label: "Customer Rating",  sub: "3,200+ verified reviews",   from: "from-yellow-400", to: "to-orange-400" },
              { value: "GH₵M+", label: "Monthly Volume",   sub: "trusted scale",             from: "from-pink-400",   to: "to-rose-400" },
            ].map(({ value, label, sub, from, to }, i) => (
              <div
                key={label}
                className={`text-center transition-all duration-700 ${SD.stats[i]} ${statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"}`}
              >
                <p className={`text-4xl font-black bg-gradient-to-r ${from} ${to} bg-clip-text text-transparent md:text-5xl`}>{value}</p>
                <p className="mt-3 text-sm font-semibold text-white/55">{label}</p>
                <p className="mt-0.5 text-xs text-white/22">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24">
        <div ref={featuresRef} className="mx-auto max-w-6xl px-5 md:px-8">
          <div className={`mb-14 text-center ${featuresInView ? "animate-in fade-in slide-in-from-bottom-6 duration-700" : "opacity-0"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
              <Sparkles className="h-3 w-3" /> Why OneGig
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl lg:text-[2.75rem]">
              Built for resellers.<br className="hidden sm:block" />
              <span className="gradient-text"> Loved by everyone.</span>
            </h2>
            <p className="mt-4 mx-auto max-w-lg text-muted-foreground">
              Whether you're topping up your own line or running a full data business, we have exactly what you need.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, badge, from, to, glow }, i) => (
              <div
                key={title}
                className={`group relative overflow-hidden rounded-2xl border border-border/60 bg-white p-6 transition-all duration-300 hover:border-transparent hover:shadow-[0_8px_40px_rgba(0,0,0,0.09)] hover:-translate-y-0.5 ${SD.feats[i]} ${featuresInView ? "animate-in fade-in slide-in-from-bottom-6 duration-700" : "opacity-0"}`}
              >
                <div className={`absolute inset-0 opacity-0 ${glow} transition-opacity duration-300`} />
                <div className="relative">
                  <div className="mb-4 flex items-start justify-between">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${from} ${to} shadow-sm`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="rounded-full border border-border/50 bg-secondary/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{badge}</span>
                  </div>
                  <h3 className="mb-2 text-base font-bold text-foreground">{title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="bg-[#05080f] py-24">
        <div ref={stepsRef} className="mx-auto max-w-6xl px-5 md:px-8">
          <div className={`mb-14 text-center ${stepsInView ? "animate-in fade-in slide-in-from-bottom-6 duration-700" : "opacity-0"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/55">
              Simple process
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Buy data in under a minute</h2>
            <p className="mt-3 mx-auto max-w-sm text-white/38 text-sm">No technical knowledge required. Three steps and you're done.</p>
          </div>

          <div className="relative grid gap-5 md:grid-cols-3 md:gap-6">
            {/* Connector line — draws left-to-right on scroll */}
            <div
              className={`absolute left-[calc(16.7%+1.5rem)] right-[calc(16.7%+1.5rem)] top-9 hidden h-px origin-left bg-gradient-to-r from-primary/30 via-fuchsia-500/50 to-primary/30 transition-transform duration-1000 ease-out [transition-delay:400ms] md:block ${stepsInView ? "scale-x-100" : "scale-x-0"}`}
            />

            {STEPS.map(({ icon: Icon, step, title, desc, from, to }, i) => (
              <div
                key={step}
                className={`group relative rounded-2xl border border-white/[0.07] bg-white/[0.03] p-7 backdrop-blur-sm transition-all hover:bg-white/[0.06] hover:border-white/10 ${SD.steps[i]} ${stepsInView ? "animate-in fade-in slide-in-from-bottom-8 duration-700" : "opacity-0"}`}
              >
                <div className={`mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${from} ${to} shadow-lg`}>
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <div className="absolute right-6 top-5 text-5xl font-black text-white/[0.04] select-none tabular-nums">{step}</div>
                <h3 className="text-base font-bold text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/38">{desc}</p>
              </div>
            ))}
          </div>

          <div className={`mt-12 text-center [animation-delay:580ms] ${stepsInView ? "animate-in fade-in slide-in-from-bottom-4 duration-500" : "opacity-0"}`}>
            <Button asChild size="lg" className="h-12 rounded-xl px-10 font-bold gradient-primary shadow-[0_8px_30px_rgba(139,92,246,0.38)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 transition-all">
              <Link to="/buy">Get Started Free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24">
        <div ref={testimonialsRef} className="mx-auto max-w-6xl px-5 md:px-8">
          <div className={`mb-14 text-center ${testimonialsInView ? "animate-in fade-in slide-in-from-bottom-6 duration-700" : "opacity-0"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
              <BadgeCheck className="h-3.5 w-3.5" /> Trusted by thousands
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Real people. Real results.</h2>
            <div className="mt-4 flex items-center justify-center gap-1">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
              <span className="ml-2 text-sm font-bold text-foreground">4.8 out of 5</span>
              <span className="ml-1 text-sm text-muted-foreground">· 3,200+ reviews</span>
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={`group relative flex flex-col rounded-2xl border border-border/60 bg-white p-6 shadow-soft transition-all hover:shadow-float hover:-translate-y-0.5 ${SD.tests[i]} ${testimonialsInView ? "animate-in fade-in slide-in-from-bottom-8 duration-700" : "opacity-0"}`}
              >
                <div className="mb-3 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-foreground">"{t.text}"</p>
                <div className="mt-5 flex items-center gap-3 border-t border-border/50 pt-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-sm font-bold text-white shadow-sm`}>
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role} · {t.location}</p>
                  </div>
                  <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-green-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent CTA ── */}
      <section className="mx-auto max-w-6xl px-5 pb-24 md:px-8">
        <div ref={ctaRef} className="relative overflow-hidden rounded-3xl bg-[#05080f] p-8 md:p-14">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/30 blur-3xl" />
            <div className="absolute -bottom-24 left-0 h-72 w-[500px] rounded-full bg-fuchsia-600/18 blur-3xl" />
            <div className="absolute inset-0 grid-pattern-dark opacity-40" />
          </div>

          <div className="relative grid items-center gap-12 md:grid-cols-2">
            {/* Left — slides in from left */}
            <div className={`[animation-delay:100ms] ${ctaInView ? "animate-slide-left" : "opacity-0"}`}>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold text-white/60">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> For Resellers
              </span>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
                Turn data into<br />
                <span className="gradient-text">income.</span>
              </h2>
              <p className="mt-4 max-w-sm text-base leading-relaxed text-white/45">
                Join 10,000+ agents earning on every sale. Open your store in minutes, set your prices, and let orders roll in automatically.
              </p>

              <div className="mt-7 space-y-3">
                {AGENT_CHECKLIST.map((item, i) => (
                  <div
                    key={item}
                    className={`flex items-center gap-3 ${SD.clist[i]} ${ctaInView ? "animate-in fade-in slide-in-from-left-4 duration-500" : "opacity-0"}`}
                  >
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                      <CheckCircle className="h-3 w-3 text-green-400" />
                    </div>
                    <span className="text-sm text-white/55">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap gap-3">
                <Button asChild className="h-12 rounded-xl bg-white px-8 font-bold text-[#05080f] hover:bg-white/92 shadow-[0_8px_24px_rgba(255,255,255,0.15)] transition-all hover:-translate-y-0.5">
                  <Link to="/auth?intent=agent"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Become an Agent</Link>
                </Button>
                <Button asChild variant="ghost" className="h-12 rounded-xl px-6 font-semibold text-white/45 hover:bg-white/[0.07] hover:text-white">
                  <Link to="/auth?tab=signin">Sign In →</Link>
                </Button>
              </div>
            </div>

            {/* Right — cards zoom in with stagger */}
            <div className="grid grid-cols-2 gap-3">
              {AGENT_FEATURES.map(({ icon: Icon, title, desc }, i) => (
                <div
                  key={title}
                  className={`group rounded-2xl border border-white/[0.07] bg-white/[0.04] p-4 transition-all hover:bg-white/[0.08] hover:border-white/12 ${SD.ccards[i]} ${ctaInView ? "animate-in zoom-in-90 fade-in duration-500" : "opacity-0"}`}
                >
                  <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl gradient-primary shadow-sm">
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/38">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section className="border-t border-border/40 bg-secondary/20 py-24">
        <div ref={faqRef} className="mx-auto max-w-2xl px-5 md:px-8">
          <div className={`mb-12 text-center ${faqInView ? "animate-in fade-in slide-in-from-bottom-6 duration-700" : "opacity-0"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">FAQ</span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground">Frequently asked questions</h2>
            <p className="mt-2 text-sm text-muted-foreground">Everything you need to know about OneGig</p>
          </div>

          <Accordion type="single" collapsible className="space-y-2.5">
            {FAQS.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className={`rounded-2xl border border-border/60 bg-white px-5 shadow-soft transition-all data-[state=open]:border-primary/20 data-[state=open]:shadow-float ${SD.faq[i]} ${faqInView ? "animate-in fade-in slide-in-from-bottom-4 duration-500" : "opacity-0"}`}
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
      <footer className="border-t border-white/5 bg-[#05080f]">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8">
          <div className="grid gap-12 md:grid-cols-4">
            <div className="md:col-span-1">
              <Logo size="md" />
              <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/30">
                Ghana's fastest, most affordable mobile data platform. Buy for yourself or build a thriving reselling business.
              </p>
              <div className="mt-6 flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-white/22">All systems operational</span>
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-3 gap-8">
              <div>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/18">Buy Data</p>
                <ul className="space-y-2.5 text-sm">
                  {[{ label: "MTN Bundles", to: "/buy" }, { label: "Telecel Bundles", to: "/buy" }, { label: "AirtelTigo Bundles", to: "/buy" }, { label: "Track Order", to: "/track" }].map((l) => (
                    <li key={l.label}><Link to={l.to} className="text-white/35 hover:text-white/70 transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/18">Agents</p>
                <ul className="space-y-2.5 text-sm">
                  {[{ label: "Sign In", to: "/auth?tab=signin" }, { label: "Become an Agent", to: "/auth?intent=agent" }, { label: "Create Account", to: "/auth?tab=signup" }].map((l) => (
                    <li key={l.label}><Link to={l.to} className="text-white/35 hover:text-white/70 transition-colors">{l.label}</Link></li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="mb-4 text-[10px] font-bold uppercase tracking-[0.15em] text-white/18">Support</p>
                <ul className="space-y-2.5 text-sm">
                  <li><a href="mailto:support@onegig.shop" className="text-white/35 hover:text-white/70 transition-colors">support@onegig.shop</a></li>
                  <li><span className="text-white/22">+233-55-116-1012</span></li>
                  <li><span className="text-white/22">Available 24/7</span></li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.05] pt-6 text-xs text-white/18 md:flex-row">
            <p>© {new Date().getFullYear()} OneGig Ghana. All rights reserved.</p>
            <div className="flex gap-6">
              <Link to="/buy" className="hover:text-white/45 transition-colors">Privacy Policy</Link>
              <Link to="/buy" className="hover:text-white/45 transition-colors">Terms of Service</Link>
            </div>
          </div>
        </div>
      </footer>
      <DraggableWhatsApp link="https://whatsapp.com/channel/YOUR_CHANNEL_ID" />
    </main>
  );
}
