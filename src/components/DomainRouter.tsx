import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgentStorePage from "@/pages/AgentStore";
import { Loader2 } from "lucide-react";

export function DomainRouter({ children }: { children: React.ReactNode }) {
  const [domainSlug, setDomainSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkDomain = async () => {
      const hostname = window.location.hostname;
      
      // Skip checking for localhost, local IPs, or Vercel default subdomains if possible
      // However, it's safer to just query the DB for the hostname.
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        setLoading(false);
        return;
      }

      try {
        const { data } = await supabase
          .from("agent_profiles")
          .select("store_slug")
          .eq("custom_domain", hostname)
          .maybeSingle();

        if (data?.store_slug) {
          setDomainSlug(data.store_slug);
        }
      } catch (e) {
        console.error("Failed to check custom domain:", e);
      } finally {
        setLoading(false);
      }
    };

    checkDomain();
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-slate-950 text-white">
        <Loader2 className="h-8 w-8 animate-spin text-rose-500" />
        <p className="mt-4 text-xs font-semibold text-slate-400 animate-pulse">Loading Storefront...</p>
      </div>
    );
  }

  // If a custom domain maps to a store slug, render the AgentStorePage directly
  // and pass the slug. We'll need to modify AgentStorePage to accept a slug prop
  // or handle it gracefully.
  if (domainSlug) {
    return <AgentStorePage customDomainSlug={domainSlug} />;
  }

  // Otherwise, render the normal application routes
  return <>{children}</>;
}
