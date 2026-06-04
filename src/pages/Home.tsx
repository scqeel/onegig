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
  User,
  Users,
  Wallet,
  Zap,
  Sun,
  Moon,
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
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

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
  const { theme, setTheme } = useTheme();
  const { user, isAdmin, isAgent, signOut } = useAuth();

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
    <main className="min-h-dvh bg-transparent overflow-x-hidden">

      {/* ── Navbar (Modern Floating Pill) ── */}
      <header className="fixed left-0 right-0 top-4 z-50 px-4 md:px-8 pointer-events-none">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between rounded-full border border-slate-200/50 bg-white/80 dark:bg-slate-950/80 px-4 md:px-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)] backdrop-blur-xl dark:border-white/5 pointer-events-auto transition-all">
          <Logo size="md" className="mix-blend-multiply dark:mix-blend-normal" />
          
          <nav className="hidden items-center gap-1 md:flex">
            <Link to="/track" className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors">
              <Search className="h-3.5 w-3.5" /> Track Order
            </Link>
            {user ? (
              <Link to={dashboardPath} className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors">
                {dashboardLabel}
              </Link>
            ) : (
              <Link to="/auth?tab=signin" className="inline-flex h-9 items-center rounded-full px-4 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900 hover:text-slate-900 dark:hover:text-white transition-colors">
                Agent Sign In
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button asChild className="ml-2 h-10 rounded-full px-6 text-sm font-bold gradient-primary shadow-[0_4px_14px_rgba(139,92,246,0.3)] hover:shadow-[0_6px_20px_rgba(139,92,246,0.4)] transition-all hover:-translate-y-0.5">
              <Link to="/buy">Buy Data Now</Link>
            </Button>
          </nav>

          <div className="flex items-center gap-2 md:hidden">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-900"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-900" aria-label="Menu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 border-l border-slate-100 dark:border-slate-900 bg-white/95 backdrop-blur-2xl dark:bg-slate-950/95 p-6 shadow-2xl">
                <SheetHeader className="mb-8 text-left">
                  <SheetTitle><Logo size="sm" className="mix-blend-multiply dark:mix-blend-normal" /></SheetTitle>
                  <SheetDescription className="sr-only">Navigation</SheetDescription>
                </SheetHeader>
                <div className="flex flex-col gap-3">
                  <SheetClose asChild>
                    <Link to="/buy" className="group flex items-center justify-between rounded-2xl bg-gradient-to-r from-violet-500 to-fuchsia-500 p-4 shadow-[0_4px_14px_rgba(139,92,246,0.3)] transition-all hover:shadow-[0_6px_20px_rgba(139,92,246,0.4)] active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                          <Zap className="h-4 w-4 text-white" />
                        </div>
                        <span className="font-bold text-white">Buy Data Now</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-white/70 group-hover:text-white transition-colors" />
                    </Link>
                  </SheetClose>

                  <SheetClose asChild>
                    <Link to="/track" className="group flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-md transition-all hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-[0.98]">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/10">
                          <Search className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                        </div>
                        <span className="font-semibold text-slate-700 dark:text-slate-200">Track Order</span>
                      </div>
                      <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
                    </Link>
                  </SheetClose>

                  {user ? (
                    <>
                      <SheetClose asChild>
                        <Link to={dashboardPath} className="group flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-md transition-all hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-[0.98]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-fuchsia-500/10">
                              <BriefcaseBusiness className="h-4 w-4 text-fuchsia-500 dark:text-fuchsia-400" />
                            </div>
                            <span className="font-semibold text-slate-700 dark:text-slate-200">{dashboardLabel}</span>
                          </div>
                          <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
                        </Link>
                      </SheetClose>
                      <SheetClose asChild>
                        <button onClick={signOut} className="group w-full flex items-center justify-between rounded-2xl border border-red-500/10 bg-red-50/50 dark:bg-red-500/5 p-4 shadow-sm backdrop-blur-md transition-all hover:bg-red-100 dark:hover:bg-red-950/20 active:scale-[0.98]">
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500/10">
                              <User className="h-4 w-4 text-red-500" />
                            </div>
                            <span className="font-semibold text-red-600 dark:text-red-400">Log Out</span>
                          </div>
                        </button>
                      </SheetClose>
                    </>
                  ) : (
                    <SheetClose asChild>
                      <Link to="/auth?tab=signin" className="group flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/40 p-4 shadow-sm backdrop-blur-md transition-all hover:bg-slate-100 dark:hover:bg-slate-900 active:scale-[0.98]">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-pink-500/10">
                            <User className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                          </div>
                          <span className="font-semibold text-slate-700 dark:text-slate-200">Agent Sign In</span>
                        </div>
                        <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300 transition-colors" />
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
      <section className="relative overflow-hidden bg-[#05080f] min-h-[92dvh] flex items-center pt-24 pb-16 lg:pt-32 lg:pb-28" style={bgStyle}>
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

        {/* Ambient glows when no image or video is configured */}
        {(!homeBg || homeBg === "none") && !homeBgVideo && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -top-40 left-1/4 h-[700px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/20 blur-[140px] animate-float-pulse" />
            <div className="absolute top-1/3 right-0 h-[450px] w-[450px] rounded-full bg-fuchsia-600/15 blur-[120px] animate-float-pulse [animation-delay:1s]" />
            <div className="absolute -bottom-20 left-0 h-[300px] w-[600px] rounded-full bg-indigo-700/10 blur-[130px] animate-float-pulse [animation-delay:2s]" />
            <div className="absolute inset-0 grid-pattern-dark opacity-60" />
          </div>
        )}
        
        {/* Dark overlay to ensure text is readable on patterned backgrounds (images/videos) */}
        {((homeBg && homeBg !== "none") || homeBgVideo) && (
          <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px] z-10" />
        )}

        {/* Floating Mute/Unmute toggle button */}
        {homeBgVideo && (
          <button
            type="button"
            onClick={() => setIsMuted(!isMuted)}
            className="absolute bottom-6 right-6 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-black/60 text-white backdrop-blur-md transition-all hover:scale-105 active:scale-95 shadow-lg pointer-events-auto"
            aria-label={isMuted ? "Unmute background video" : "Mute background video"}
          >
            {isMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4 animate-pulse" />
            )}
          </button>
        )}

        <div className="relative z-20 mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-12 lg:grid lg:grid-cols-12 lg:gap-16">
            
            {/* Left Content Column */}
            <div className="w-full text-center lg:col-span-6 lg:text-left flex flex-col items-center lg:items-start">
              {/* Badge */}
              <div className={`mb-6 sm:mb-8 animate-hero-badge ${HD.badge} w-fit`}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur-md">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
                  </span>
                  Ghana's #1 wholesale data platform
                  <span className="rounded-full bg-primary/25 px-2 py-0.5 text-[9px] font-black tracking-wider text-white">LIVE</span>
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black leading-[1.05] tracking-tight md:text-6xl lg:text-[4.25rem] text-white">
                <span className={`block animate-fade-up ${HD.l1}`}>Buy data.</span>
                <span className={`block hero-gradient-text animate-fade-up ${HD.l2}`}>Save more.</span>
                <span className={`block text-white/30 font-bold animate-fade-up ${HD.l3}`}>Deliver instantly.</span>
              </h1>

              <p className={`mt-5 max-w-md text-base sm:text-lg leading-relaxed text-white/50 animate-fade-up ${HD.para}`}>
                Ghana's fastest mobile data platform — MTN, Telecel & AirtelTigo bundles at wholesale rates. No signup, no wait times.
              </p>

              <div className={`mt-8 flex flex-col sm:flex-row gap-3 w-full sm:w-auto animate-fade-up ${HD.btns}`}>
                <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base font-bold bg-white text-slate-950 hover:bg-slate-100 hover:scale-[1.01] shadow-[0_12px_30px_-6px_rgba(139,92,246,0.3)] transition-all">
                  <Link to="/buy">Buy Data Now <ArrowRight className="ml-2 h-5 w-5" /></Link>
                </Button>
                <Button asChild size="lg" className="h-14 rounded-2xl px-8 text-base font-semibold border border-white/10 text-white/80 bg-white/[0.04] hover:bg-white/10 hover:text-white backdrop-blur-md transition-all hover:scale-[1.01]">
                  <Link to="/auth?intent=agent">Become an Agent <ChevronRight className="ml-1 h-5 w-5" /></Link>
                </Button>
              </div>

              <div className={`mt-8 flex flex-wrap justify-center lg:justify-start gap-x-6 gap-y-2.5 animate-fade-up ${HD.pips}`}>
                {[
                  { icon: CheckCircle, text: "No account needed" },
                  { icon: Zap,         text: "Under 60s delivery" },
                  { icon: ShieldCheck, text: "Secured payments" },
                ].map(({ icon: Icon, text }) => (
                  <span key={text} className="inline-flex items-center gap-2 text-xs sm:text-sm text-white/40">
                    <Icon className="h-4 w-4 text-green-400/80" /> {text}
                  </span>
                ))}
              </div>
            </div>

            {/* Right Interactive Cockpit Column */}
            <div className={`w-full max-w-md lg:col-span-6 lg:max-w-none relative animate-slide-right ${HD.card}`}>
              <div className="pointer-events-none absolute inset-0 -m-6 rounded-3xl bg-primary/10 blur-3xl animate-float-pulse" />

              <div className="relative overflow-hidden rounded-[2.25rem] border border-white/[0.08] bg-white/[0.02] p-2 sm:p-2.5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] backdrop-blur-3xl">
                <div className="rounded-[1.75rem] bg-white/95 dark:bg-slate-900/95 p-5 sm:p-6 shadow-inner backdrop-blur-md">

                  {/* Network selection tabs */}
                  <div className="mb-6 flex gap-1.5 rounded-2xl bg-slate-100/80 dark:bg-slate-950/50 p-1">
                    {NETWORKS.map((n) => {
                      const active = activeNetwork === n.id;
                      return (
                        <button
                          type="button"
                          key={n.id}
                          onClick={() => setActiveNetwork(n.id)}
                          className={cn(
                            "flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-xs font-black tracking-tight transition-all duration-300",
                            active
                              ? n.activeClass
                              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                          )}
                        >
                          <span className="text-sm shrink-0">{n.emoji}</span>
                          <span className="truncate">{n.name}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${network.dotColor} animate-pulse`} />
                      <p className="text-sm font-black text-slate-900 dark:text-white">{network.name} Active Bundles</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold tracking-tight uppercase ${network.tagColor}`}>
                      {network.tag}
                    </span>
                  </div>

                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {network.bundles.map((b, i) => {
                      const isBest = i === 0;
                      return (
                        <div
                          key={b.label}
                          className={cn(
                            "group flex items-center justify-between rounded-2xl border px-4 py-3.5 transition-all duration-200 cursor-pointer active:scale-[0.99]",
                            isBest
                              ? `${network.rowHighlight} border-primary/20 dark:border-primary/30 shadow-[0_4px_12px_rgba(139,92,246,0.04)]`
                              : "border-slate-100 dark:border-slate-800/80 bg-white/50 dark:bg-slate-950/20 hover:bg-slate-50 dark:hover:bg-slate-950/60"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-colors",
                              isBest ? "bg-primary/10 text-primary" : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                            )}>
                              <Smartphone className="h-4 w-4" />
                            </div>
                            <div className="flex flex-col gap-0.5">
                              <span className="text-sm font-black text-slate-900 dark:text-white leading-tight">{b.label}</span>
                              {isBest && (
                                <span className="text-[9px] font-black uppercase tracking-wider text-primary leading-none"> reseller choice </span>
                              )}
                            </div>
                          </div>
                          <span className={cn(
                            "text-sm font-black tracking-tight",
                            isBest ? network.priceColor : "text-slate-900 dark:text-white"
                          )}>{b.price}</span>
                        </div>
                      );
                    })}
                  </div>

                  <Button asChild className="mt-5 h-12 w-full rounded-2xl gradient-primary font-bold shadow-[0_8px_20px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_28px_rgba(139,92,246,0.35)] text-sm transition-all active:scale-[0.98]">
                    <Link to="/buy">Order Now <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
                  </Button>

                  <div className="mt-4 flex items-center justify-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    <ShieldCheck className="h-3.5 w-3.5 text-green-500" />
                    <span>Secure processing by PCI-DSS platform</span>
                  </div>
                </div>
              </div>

              {/* Floating badges with glassmorphic backing & hover effects */}
              <div className={`absolute -right-2 -top-4 flex items-center gap-1.5 rounded-full border border-slate-200/50 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-3.5 py-2 shadow-lg backdrop-blur-md animate-in zoom-in-75 duration-500 ${HD.fb1} hover:scale-105 transition-transform`}>
                <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                <span className="text-xs font-black text-slate-900 dark:text-white">4.8</span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">· 3.2k reviews</span>
              </div>
              <div className={`absolute -left-2 bottom-16 flex items-center gap-2 rounded-full border border-slate-200/50 dark:border-white/10 bg-white/90 dark:bg-slate-900/90 px-3.5 py-2 shadow-lg backdrop-blur-md animate-in zoom-in-75 duration-500 ${HD.fb2} hover:scale-105 transition-transform`}>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                </span>
                <span className="text-xs font-bold text-slate-900 dark:text-white">Instant Fulfillment</span>
              </div>
            </div>
            
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/50 to-transparent dark:from-[#05080f] dark:via-[#05080f]/40 dark:to-transparent" />
      </section>


      {/* ── Trust strip — auto-scrolling marquee ── */}
      <div className="overflow-hidden border-b border-slate-100 dark:border-white/5 bg-white dark:bg-slate-950 py-4">
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
        <div ref={statsRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={cn(
            "rounded-[2.5rem] border border-white/[0.06] bg-white/[0.02] p-8 sm:p-10 backdrop-blur-xl shadow-2xl transition-all duration-1000",
            statsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          )}>
            <p className="mb-10 text-center text-[10px] font-black uppercase tracking-[0.2em] text-white/40">
              Trusted by resellers across Ghana
            </p>
            <div className="grid grid-cols-2 gap-y-10 gap-x-4 md:grid-cols-4 divide-y divide-white/[0.05] md:divide-y-0 md:divide-x divide-solid">
              {[
                { value: "10K+",   label: "Active Resellers", sub: "growing daily",        from: "from-violet-400", to: "to-purple-400" },
                { value: "< 60s",  label: "Avg. Delivery",    sub: "guaranteed speed",     from: "from-green-400",  to: "to-emerald-400" },
                { value: "4.8★",   label: "Customer Rating",  sub: "verified reviews",      from: "from-yellow-400", to: "to-orange-400" },
                { value: "GH₵M+", label: "Monthly Volume",   sub: "trusted scale",        from: "from-pink-400",   to: "to-rose-400" },
              ].map(({ value, label, sub, from, to }, i) => (
                <div
                  key={label}
                  className={cn(
                    "text-center transition-all duration-700 px-2",
                    i >= 2 ? "pt-10 md:pt-0" : "",
                    SD.stats[i]
                  )}
                >
                  <p className={`text-4xl font-black bg-gradient-to-r ${from} ${to} bg-clip-text text-transparent md:text-5xl`}>{value}</p>
                  <p className="mt-3 text-sm font-semibold text-white/80">{label}</p>
                  <p className="mt-0.5 text-xs text-white/30">{sub}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 bg-slate-50/30 dark:bg-[#05080f]/20">
        <div ref={featuresRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className={`mb-16 text-center transition-all duration-1000 ${featuresInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
              <Sparkles className="h-3 w-3 animate-pulse" /> Why OneGig
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl lg:text-[2.75rem]">
              Built for resellers.<br className="hidden sm:block" />
              <span className="gradient-text"> Loved by everyone.</span>
            </h2>
            <p className="mt-4 mx-auto max-w-lg text-sm sm:text-base text-muted-foreground leading-relaxed">
              Whether you're topping up your own line or running a full data business, we have exactly what you need.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, badge, from, to, glow }, i) => (
              <div
                key={title}
                className={cn(
                  "group relative overflow-hidden rounded-3xl border border-slate-200/60 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 p-6 backdrop-blur-md transition-all duration-300 hover:border-transparent hover:shadow-[0_12px_40px_rgba(139,92,246,0.06)] hover:-translate-y-1",
                  SD.feats[i],
                  featuresInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className={`absolute inset-0 opacity-0 ${glow} transition-opacity duration-300`} />
                <div className="relative z-10">
                  <div className="mb-5 flex items-start justify-between">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br ${from} ${to} shadow-[0_4px_20px_-4px_rgba(139,92,246,0.4)]`}>
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                    <span className="rounded-full border border-primary/10 bg-primary/5 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-primary">{badge}</span>
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
      <section className="bg-[#05080f] py-24 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-violet-950/10 blur-[130px] pointer-events-none" />
        <div ref={stepsRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 relative z-10">
          
          <div className={`mb-16 text-center transition-all duration-1000 ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-white/60">
              Simple process
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Buy data in under a minute</h2>
            <p className="mt-3 mx-auto max-w-sm text-white/45 text-sm">No technical knowledge required. Three steps and you're done.</p>
          </div>

          <div className="relative grid gap-6 md:grid-cols-3">
            {/* Horizontal Connector line (desktop) */}
            <div
              className={`absolute left-[calc(16.7%+2rem)] right-[calc(16.7%+2rem)] top-12 hidden h-[2px] origin-left bg-gradient-to-r from-primary/40 via-fuchsia-500/50 to-primary/40 transition-transform duration-1000 ease-out [transition-delay:400ms] md:block ${stepsInView ? "scale-x-100" : "scale-x-0"}`}
            />
            {/* Vertical Connector line (mobile) */}
            <div className="absolute left-[32px] top-12 bottom-12 w-[2px] bg-gradient-to-b from-primary/30 via-fuchsia-500/40 to-primary/30 md:hidden pointer-events-none" />

            {STEPS.map(({ icon: Icon, step, title, desc, from, to }, i) => (
              <div
                key={step}
                className={cn(
                  "group relative flex gap-5 items-start md:flex-col md:items-start rounded-3xl border border-white/[0.05] bg-white/[0.01] p-6 backdrop-blur-md transition-all duration-300 hover:bg-white/[0.03] hover:border-white/10",
                  SD.steps[i],
                  stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className={cn(
                  "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-lg relative z-10 transition-transform duration-300 group-hover:scale-105",
                  from, to
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 md:mt-3">
                  <span className="text-[10px] font-black uppercase tracking-wider text-primary/70">Step {step}</span>
                  <h3 className="text-base font-bold text-white mt-1 leading-tight">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className={`mt-12 text-center transition-all duration-700 [transition-delay:500ms] ${stepsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
            <Button asChild size="lg" className="h-12 rounded-xl px-10 font-bold gradient-primary shadow-[0_8px_30px_rgba(139,92,246,0.25)] hover:shadow-[0_12px_40px_rgba(139,92,246,0.35)] hover:-translate-y-0.5 transition-all">
              <Link to="/buy">Get Started Free <ArrowRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24 bg-slate-50/20 dark:bg-slate-950/10">
        <div ref={testimonialsRef} className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          
          <div className={`mb-16 text-center transition-all duration-1000 ${testimonialsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-bold text-primary">
              <BadgeCheck className="h-3.5 w-3.5 animate-pulse" /> Verified Reseller Reviews
            </span>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-foreground md:text-4xl">Real people. Real results.</h2>
            <div className="mt-4 flex items-center justify-center gap-1 text-slate-900 dark:text-white">
              {[...Array(5)].map((_, i) => <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />)}
              <span className="ml-2 text-sm font-black">4.8 out of 5</span>
              <span className="ml-1 text-sm text-muted-foreground">· 3,200+ reviews</span>
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={t.name}
                className={cn(
                  "group relative flex flex-col rounded-3xl border border-slate-200/50 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 p-6 shadow-soft transition-all duration-500 hover:shadow-float hover:-translate-y-1",
                  SD.tests[i],
                  testimonialsInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                )}
              >
                <div className="mb-4 flex gap-0.5">
                  {Array.from({ length: t.stars }).map((_, j) => <Star key={j} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="flex-1 text-sm leading-relaxed text-foreground dark:text-slate-200">"{t.text}"</p>
                
                <div className="mt-6 flex items-center gap-3 border-t border-slate-100 dark:border-slate-800/60 pt-4">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${t.gradient} text-sm font-black text-white shadow-inner`}>
                    {t.initials}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{t.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{t.role} · {t.location}</p>
                  </div>
                  <CheckCircle className="ml-auto h-4 w-4 shrink-0 text-green-500" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Agent CTA ── */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 pb-24">
        <div ref={ctaRef} className="relative overflow-hidden rounded-[2.5rem] bg-[#05080f] p-8 sm:p-12 md:p-16 border border-white/[0.05] shadow-3xl">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-24 left-0 h-72 w-[500px] rounded-full bg-fuchsia-600/10 blur-3xl" />
            <div className="absolute inset-0 grid-pattern-dark opacity-30" />
          </div>

          <div className="relative flex flex-col gap-12 lg:grid lg:grid-cols-12 lg:gap-16 items-center">
            {/* Left Content Column */}
            <div className={cn(
              "w-full text-center lg:text-left lg:col-span-7 flex flex-col items-center lg:items-start transition-all duration-1000",
              ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
            )}>
              <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-4 py-1.5 text-xs font-semibold text-white/70">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> For Wholesale Resellers
              </span>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
                Turn data into<br />
                <span className="gradient-text">residual income.</span>
              </h2>
              <p className="mt-4 max-w-md text-sm sm:text-base leading-relaxed text-white/50">
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
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500/20">
                      <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                    </div>
                    <span className="text-xs sm:text-sm font-semibold text-white/70">{item}</span>
                  </div>
                ))}
              </div>

              <div className="mt-9 flex flex-wrap justify-center lg:justify-start gap-3 w-full sm:w-auto">
                <Button asChild className="h-12 rounded-xl bg-white text-slate-950 hover:bg-slate-100 px-8 font-bold shadow-[0_8px_24px_rgba(255,255,255,0.1)] transition-all hover:scale-[1.01]">
                  <Link to="/auth?intent=agent"><BriefcaseBusiness className="mr-2 h-4 w-4" /> Become an Agent</Link>
                </Button>
                <Button asChild variant="ghost" className="h-12 rounded-xl px-6 font-semibold text-white/50 hover:bg-white/[0.05] hover:text-white">
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
                    "group rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5 transition-all duration-500 hover:bg-white/[0.05] hover:border-white/10 hover:-translate-y-0.5",
                    SD.ccards[i],
                    ctaInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
                  )}
                >
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-primary/20">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                  <p className="text-sm font-bold text-white">{title}</p>
                  <p className="mt-1.5 text-xs leading-relaxed text-white/40">{desc}</p>
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
                className={cn(
                  "rounded-2xl border border-slate-200/60 dark:border-slate-800/80 bg-white dark:bg-slate-900/50 px-5 shadow-soft backdrop-blur-md transition-all data-[state=open]:border-primary/20 dark:data-[state=open]:border-primary/30 data-[state=open]:shadow-float",
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
      <DraggableWhatsApp link="https://whatsapp.com/channel/0029VbDOyktLdQelDfBClj3y" />
    </main>
  );
}
