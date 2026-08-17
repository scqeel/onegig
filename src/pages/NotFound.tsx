import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  Home, 
  ArrowLeft, 
  Zap, 
  Search, 
  BriefcaseBusiness, 
  GraduationCap, 
  Tv, 
  HelpCircle,
  Sparkles,
  Compass
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center overflow-hidden bg-slate-950 text-white px-4 py-12 selection:bg-amber-500 selection:text-slate-950">

      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-amber-500/20 to-orange-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full bg-gradient-to-br from-violet-600/20 to-rose-500/10 blur-[120px]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] opacity-40" />

      {/* Navigation Header */}
      <header className="absolute top-6 left-6 right-6 z-20 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/" className="transition-transform hover:scale-105">
          <Logo size="md" />
        </Link>
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
          size="sm"
          className="rounded-full border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white backdrop-blur-md text-xs font-semibold gap-1.5"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Go Back
        </Button>
      </header>

      {/* Main Glassmorphic Container */}
      <div className="relative z-10 w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-900/60 p-6 sm:p-10 md:p-12 text-center backdrop-blur-2xl shadow-2xl shadow-amber-500/5 animate-in fade-in zoom-in-95 duration-500">
        
        {/* Badge */}
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-amber-300 backdrop-blur-md mb-6">
          <Compass className="h-3.5 w-3.5 animate-spin [animation-duration:8s]" /> 404 · PAGE NOT FOUND
        </div>

        {/* Big 404 Gradient Text */}
        <div className="relative select-none">
          <h1 className="text-8xl sm:text-9xl font-black tracking-tighter bg-gradient-to-r from-amber-300 via-orange-400 to-rose-500 bg-clip-text text-transparent leading-none drop-shadow-sm">
            404
          </h1>
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent" />
        </div>

        {/* Headline & Description */}
        <div className="mt-4 space-y-2">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Lost in digital space?
          </h2>
          <p className="text-sm sm:text-base text-slate-300/90 max-w-md mx-auto leading-relaxed">
            The link you followed might be broken, or the page <span className="font-mono text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-md text-xs">{location.pathname}</span> has been moved.
          </p>
        </div>

        {/* Quick Destinations Grid */}
        <div className="mt-8 pt-8 border-t border-white/10 space-y-3">
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400">
            Popular Destinations
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {[
              { label: "Home Page", to: "/", icon: Home, color: "text-amber-400" },
              { label: "Buy Mobile Data", to: "/buy?tab=data", icon: Zap, color: "text-amber-400" },
              { label: "Track My Order", to: "/track", icon: Search, color: "text-cyan-400" },
              { label: "WAEC Checkers", to: "/buy?tab=checker", icon: GraduationCap, color: "text-purple-400" },
              { label: "Pay Bills", to: "/buy?tab=bill", icon: Tv, color: "text-emerald-400" },
              { label: "Become Agent", to: "/auth?intent=agent", icon: BriefcaseBusiness, color: "text-orange-400" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className="flex items-center gap-2.5 p-3 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-amber-400/40 text-left transition-all duration-200 group"
                >
                  <div className={`p-2 rounded-xl bg-white/5 group-hover:scale-110 transition-transform ${item.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-xs font-semibold text-slate-200 group-hover:text-white truncate">
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Primary Action Buttons */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            className="w-full sm:w-auto h-13 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-sm px-8 shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all"
          >
            <Link to="/">
              <Home className="mr-2 h-4.5 w-4.5" /> Take Me Home
            </Link>
          </Button>

          <Button
            asChild
            variant="outline"
            className="w-full sm:w-auto h-13 rounded-full border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold text-sm px-8"
          >
            <a href="mailto:support@onegig.shop">
              <HelpCircle className="mr-2 h-4.5 w-4.5 text-slate-300" /> Contact Support
            </a>
          </Button>
        </div>

      </div>

      {/* Footer Branding */}
      <footer className="relative z-10 mt-8 text-center text-xs text-slate-400 flex items-center gap-2">
        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
        <span>OneGig Ghana · Fast, Affordable Mobile Data & Digital Services</span>
      </footer>

    </div>
  );
}
