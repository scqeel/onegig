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
      <div className="dark flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="dark flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-12 overflow-hidden relative">
        <div className="pointer-events-none absolute inset-0 grid-pattern-dark opacity-40" />

        <div className="relative z-10 w-full max-w-[420px] text-center animate-fade-up">
          <div className="mb-8 flex flex-col items-center">
            <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl bg-destructive/10 border border-destructive/20 mb-6">
              <XCircle className="h-10 w-10 text-destructive" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Invalid Invitation Link
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground px-4">
              The referral code <span className="font-mono text-destructive bg-destructive/5 px-2 py-0.5 rounded border border-destructive/10">"{ref}"</span> is not registered or has expired. Please double-check the link or contact your parent agent for a valid invite.
            </p>
          </div>

          <Button
            onClick={() => nav("/")}
            variant="outline"
            className="h-14 w-full rounded-xl text-[15px]"
          >
            <ArrowLeft className="mr-2 h-5 w-5" /> Return to Homepage
          </Button>
        </div>
      </div>
    );
  }

  const storeName = agent.store_name;
  const brandColor = agent.store_brand_color || "hsl(var(--primary))";

  return (
    <div className="dark flex min-h-dvh flex-col items-center justify-center bg-background px-5 py-12 overflow-hidden relative">
      <div className="pointer-events-none absolute inset-0 grid-pattern-dark opacity-40" />

      <div className="relative z-10 w-full max-w-[420px] animate-fade-up">
        {/* Top Logo / Brand */}
        <div className="mb-10 text-center flex flex-col items-center">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-2xl border border-border bg-card mb-6 overflow-hidden">
            {agent.store_logo_url ? (
              <img src={agent.store_logo_url} alt={storeName} className="h-full w-full object-cover" />
            ) : (
              <Store className="h-9 w-9" style={{ color: brandColor }} />
            )}
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-foreground mb-5">
            <Star className="h-3.5 w-3.5" style={{ fill: brandColor, color: brandColor }} />
            Exclusive Agent Invitation
          </div>

          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            Join <span style={{ color: brandColor }}>{storeName}</span>'s Network
          </h1>
          <p className="mt-3.5 text-sm leading-relaxed text-muted-foreground px-4">
            You've been invited to become an official data reseller. Get wholesale prices, set your own margins, and start earning today.
          </p>
        </div>

        {/* Feature List */}
        <div className="mb-10 space-y-3">
          {[
            { icon: TrendingUp, title: "Wholesale data prices", desc: "Buy at base rates and keep 100% of your profit." },
            { icon: Store, title: "Your own storefront", desc: "Get a custom link for customers to buy from you." },
            { icon: ShieldCheck, title: "Secure daily payouts", desc: "Withdraw your earnings directly to Mobile Money." },
          ].map(({ icon: Icon, title, desc }) => (
            <div
              key={title}
              className="flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-primary/30"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action button */}
        <Button
          onClick={handleAccept}
          disabled={isRedirecting}
          className="group h-14 w-full rounded-xl text-[15px] text-white transition-all duration-300 hover:-translate-y-0.5 active:translate-y-0"
          style={{ backgroundColor: brandColor }}
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
          <Link to="/" className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
            No thanks, return to homepage
          </Link>
        </div>
      </div>
    </div>
  );
}
