import { useEffect, useState } from "react";
import { Route, Routes } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AgentStorePage from "@/pages/AgentStore";
import CustomerAuthPage from "@/pages/CustomerAuth";
import PaymentCallbackPage from "@/pages/PaymentCallback";
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
    return <LoadingScreen message="Loading Storefront..." submessage="Connecting to custom domain store" />;
  }

  // A custom domain only ever shows its store, plus the two pages a store
  // customer can be sent to: login, and the return from a wallet top-up.
  if (domainSlug) {
    return (
      <Routes>
        <Route path="/store-auth/:slug" element={<CustomerAuthPage />} />
        <Route path="/payment/callback" element={<PaymentCallbackPage />} />
        <Route path="*" element={<AgentStorePage customDomainSlug={domainSlug} />} />
      </Routes>
    );
  }

  // Otherwise, render the normal application routes
  return <>{children}</>;
}
