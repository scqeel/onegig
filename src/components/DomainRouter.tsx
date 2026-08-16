import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AgentStorePage from "@/pages/AgentStore";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

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
    return <LoadingScreen message="Loading Storefront..." submessage="Connecting to custom domain store" variant="dark" />;
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
