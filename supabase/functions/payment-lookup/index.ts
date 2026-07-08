import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch active provider credentials
    const { data: dpData } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "data_providers")
      .maybeSingle();

    const config = (dpData?.value as any) ?? {};
    const activeProviderKey = config?.active || "swft";
    const providerConfig = config?.providers?.[activeProviderKey] ?? {};

    const PROVIDER_BASE_URL = providerConfig.base_url || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
    const PROVIDER_API_KEY = providerConfig.api_key || "";

    if (!PROVIDER_API_KEY) {
      return json({ error: "Provider is not configured" }, 400);
    }

    const body = await req.json();
    const { action, customerNumber, billType, accountNumber } = body;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${PROVIDER_API_KEY}`,
      "X-API-Key": PROVIDER_API_KEY,
      "Content-Type": "application/json",
    };

    if (action === "validate") {
      if (!customerNumber || !billType) {
        return json({ error: "customerNumber and billType are required" }, 400);
      }

      const res = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/bills/validate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ customerNumber, billType })
      });

      const data = await res.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json(data);

    } else if (action === "ecg_lookup") {
      if (!accountNumber) {
        return json({ error: "accountNumber is required" }, 400);
      }

      const res = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/ecg/lookup`, {
        method: "POST",
        headers,
        body: JSON.stringify({ accountNumber })
      });

      const data = await res.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json(data);

    } else {
      return json({ error: `Invalid action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("payment-lookup error:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
