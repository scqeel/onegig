import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2, TrendingUp, ShieldCheck, Store, Star, XCircle, ArrowLeft } from "lucide-react";

export default function InvitePage() {
  const { ref } = useParams<{ ref: string }>();
  const nav = useNavigate();
  const [isRedirecting, setIsRedirecting] = useState(false);

  useEffect(() => {
    if (ref) {
      localStorage.setItem("agent_ref", ref);
    }
  }, [ref]);

  const { data: agent, isLoading } = useQuery({
    queryKey: ["agent-invite", ref],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agent_profiles")
        .select("store_name, store_slug, store_logo_url, store_brand_color")
        .eq("store_slug", ref)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!ref,
  });

  const handleAccept = async () => {
    setIsRedirecting(true);
    // Sign out any existing session so Auth.tsx doesn't auto-redirect
    // back to the current user's dashboard
    await supabase.auth.signOut();
    setTimeout(() => {
      nav(`/auth?intent=agent&tab=signup&ref=${ref}`, { replace: true });
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-[#05080f]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-[#05080f] px-5 py-12 overflow-hidden relative">
        {/* Ambient glows */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden flex items-center justify-center">
          <div className="absolute h-[600px] w-[600px] rounded-full opacity-[0.08] blur-[100px] bg-rose-500" />
          <div className="absolute inset-0 grid-pattern-dark opacity-50" />
        </div>

        <div className="relative z-10 w-full max-w-[420px] text-center animate-fade-up">
          <div className="mb-8 flex flex-col items-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-[25px] bg-rose-500/10 border border-rose-500/20 shadow-2xl backdrop-blur-xl mb-6 relative group">
              <div className="absolute inset-0 rounded-[25px] bg-rose-500/5 blur-md group-hover:blur-lg transition-all" />
              <XCircle className="h-10 w-10 text-rose-500 relative z-10 animate-pulse" />
            </div>
            
            <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
              Invalid Invitation Link
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-white/50 px-4 font-semibold">
              The referral code <span className="font-mono text-rose-400 bg-rose-500/5 px-2 py-0.5 rounded border border-rose-500/10">"{ref}"</span> is not registered or has expired. Please double-check the link or contact your parent agent for a valid invite.
            </p>
          </div>

          <Button 
            onClick={() => nav("/")}
            className="h-14 w-full rounded-[16px] text-[15px] font-black text-white bg-slate-900 border border-white/10 hover:bg-slate-800 transition-all duration-300 shadow-xl"
          >
            <ArrowLeft className="mr-2 h-5 w-5" /> Return to Homepage
          </Button>
        </div>
      </div>
    );
  }

  const storeName = agent.store_name;
  const brandColor = agent.store_brand_color || "#7c3aed";

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#05080f] px-5 py-12 overflow-hidden relative">
      {/* Ambient glows based on agent brand color */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden flex items-center justify-center">
        <div 
          className="absolute h-[600px] w-[600px] rounded-full opacity-[0.15] blur-[100px] transition-colors duration-1000" 
          style={{ backgroundColor: brandColor }}
        />
        <div className="absolute inset-0 grid-pattern-dark opacity-50" />
      </div>

      <div className="relative z-10 w-full max-w-[420px] animate-fade-up">
        {/* Top Logo / Brand */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-[20px] bg-white/[0.03] border border-white/[0.08] shadow-2xl backdrop-blur-xl mb-6 overflow-hidden transition-transform hover:scale-105 duration-300">
            {agent.store_logo_url ? (
              <img src={agent.store_logo_url} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-9 w-9" style={{ color: brandColor }} />
            )}
          </div>
          
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white mb-5 backdrop-blur-md">
            <Star className="h-3.5 w-3.5" style={{ fill: brandColor, color: brandColor }} />
            Exclusive Agent Invitation
          </div>
          
          <h1 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
            Join <span style={{ color: brandColor }}>{storeName}</span>'s Network
          </h1>
          <p className="mt-3.5 text-sm leading-relaxed text-white/50 px-4">
            You've been invited to become an official data reseller. Get wholesale prices, set your own margins, and start earning today.
          </p>
        </div>

        {/* Feature List */}
        <div className="mb-10 space-y-3">
          {[
            {
              icon: TrendingUp,
              title: "Wholesale data prices",
              desc: "Buy at base rates and keep 100% of your profit.",
              color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/10"
            },
            {
              icon: Store,
              title: "Your own storefront",
              desc: "Get a custom link for customers to buy from you.",
              color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/10"
            },
            {
              icon: ShieldCheck,
              title: "Secure daily payouts",
              desc: "Withdraw your earnings directly to Mobile Money.",
              color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/10"
            },
          ].map(({ icon: Icon, title, desc, color, bg, border }, i) => (
            <div 
              key={title} 
              className={`flex items-start gap-4 rounded-[18px] border border-white/[0.04] bg-white/[0.02] p-4 backdrop-blur-md transition-all hover:bg-white/[0.04] hover:border-white/[0.08]`}
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${bg} ${border}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-white/40">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action button */}
        <Button 
          onClick={handleAccept}
          disabled={isRedirecting}
          className="group h-14 w-full rounded-[16px] text-[15px] font-black text-white shadow-xl transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
          style={{ 
            backgroundColor: brandColor, 
            boxShadow: `0 12px 30px -10px ${brandColor}`
          }}
        >
          {isRedirecting ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <div className="flex items-center justify-center">
              Accept Invitation & Join 
              <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
            </div>
          )}
        </Button>
        
        <div className="mt-8 text-center">
          <Link to="/" className="text-xs font-medium text-white/30 hover:text-white/70 transition-colors">
            No thanks, return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
