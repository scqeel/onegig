import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { BecomeAgent } from "@/components/buy/BecomeAgent";
import { Store, X, Check, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

const FEATURES = [
  "Cheaper prices than normal users",
  "Set your own prices",
  "Your own store link",
  "Profit auto-credited",
  "Withdraw anytime",
  "Build your customer base",
];

export function AgentPromoModal() {
  const { isAgent, loading, user } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  useEffect(() => {
    if (!loading && !isAgent) {
      const closed = sessionStorage.getItem("agent_promo_closed");
      if (!closed) {
        const timer = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(timer);
      }
    }
  }, [loading, isAgent]);

  if (loading || isAgent || !open) return null;

  const handleClose = () => {
    setOpen(false);
    setShowCheckout(false);
    sessionStorage.setItem("agent_promo_closed", "true");
  };

  const handleBecomeAgentClick = () => {
    if (user) {
      setShowCheckout(true);
    } else {
      handleClose();
      nav("/auth?intent=agent");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-300">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2rem] border border-amber-500/30 bg-slate-950 text-white shadow-2xl shadow-amber-500/10 transition-all animate-in zoom-in-95 duration-300">
        
        {/* Background Image Layer & Warm Glow Overlay */}
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay pointer-events-none"
          style={{ backgroundImage: "url('/agent-promo-bg.jpg')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/25 via-slate-950/90 to-slate-950 pointer-events-none" />
        <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="relative z-10 p-6 sm:p-7 flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-bold uppercase tracking-wider backdrop-blur-md">
              <Store className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> AGENT PROGRAM
            </div>

            <button
              onClick={handleClose}
              className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {showCheckout ? (
            <div className="py-2">
              <div className="mb-4 flex items-center justify-between border-b border-white/10 pb-3">
                <h3 className="text-lg font-bold text-amber-400">Agent Store Activation</h3>
                <button 
                  onClick={() => setShowCheckout(false)}
                  className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
                >
                  ← Back to info
                </button>
              </div>
              <BecomeAgent onClose={handleClose} />
            </div>
          ) : (
            <>
              {/* Content Headline */}
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                  Earn by selling data bundles
                </h2>
                <p className="mt-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                  Sell data at your own price and keep the profit on every order — set up in minutes.
                </p>
              </div>

              {/* Feature Checklist Box */}
              <div className="rounded-2xl bg-slate-900/80 backdrop-blur-md border border-white/10 p-4 sm:p-5 grid grid-cols-2 gap-3">
                {FEATURES.map((feat) => (
                  <div key={feat} className="flex items-start gap-2 text-xs sm:text-[13px] font-semibold text-slate-200">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-amber-400 text-slate-950 font-bold mt-0.5">
                      <Check className="h-2.5 w-2.5 stroke-[3]" />
                    </span>
                    <span className="leading-tight">{feat}</span>
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-1">
                <Button
                  onClick={handleBecomeAgentClick}
                  className="w-full h-13 rounded-full bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 hover:from-amber-300 hover:to-orange-400 text-slate-950 font-extrabold text-base sm:text-lg shadow-lg shadow-amber-500/25 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer border-none"
                >
                  Become an agent <ArrowRight className="h-5 w-5" />
                </Button>

                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-300 font-medium">
                  <ShieldCheck className="h-4 w-4 text-emerald-400" /> Free to start · Apply in minutes
                </div>

                <button
                  onClick={handleClose}
                  className="mt-1 text-xs font-semibold text-slate-400 hover:text-white transition-colors text-center py-1 cursor-pointer"
                >
                  Maybe later
                </button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
