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
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify authentication and admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized: Missing token" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ud, error: udErr } = await userClient.auth.getUser();
    if (udErr || !ud.user?.id) return json({ error: "Unauthorized: Invalid token" }, 401);

    const userId = ud.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden: Admin access required" }, 403);

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
      return json({ error: "Provider API Key is not configured in integrations settings" }, 400);
    }

    const body = await req.json();
    const action = body.action;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${PROVIDER_API_KEY}`,
      "X-API-Key": PROVIDER_API_KEY,
      "Content-Type": "application/json",
    };

    if (action === "get_balance") {
      // Fetch balance and wallets breakdown
      const balRes = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/balance`, { headers });
      const walletRes = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/wallets`, { headers });

      const balanceData = await balRes.json().catch(() => ({ success: false }));
      const walletsData = await walletRes.json().catch(() => ({ success: false }));

      return json({
        success: true,
        balance: {
          success: true,
          mainBalance: balanceData.balance !== undefined ? balanceData.balance : balanceData.mainBalance,
          apiBalance: balanceData.api_balance !== undefined ? balanceData.api_balance : balanceData.apiBalance,
          currency: balanceData.currency
        },
        wallets: walletsData,
      });

    } else if (action === "get_plans") {
      let plansUrl = "";
      if (activeProviderKey === "swiftdata") {
        plansUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/v1/packages`;
      } else {
        plansUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/plans`;
      }

      const plansRes = await fetch(plansUrl, { headers });
      const plansData = await plansRes.json().catch(() => ({ success: false }));
      return json(plansData);

    } else if (action === "wallet_transfer") {
      const { from, to, amount } = body;
      if (!from || !to || !amount || Number(amount) <= 0) {
        return json({ error: "from, to, and positive amount are required" }, 400);
      }

      const res = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/wallet/transfer`, {
        method: "POST",
        headers,
        body: JSON.stringify({ from, to, amount: Number(amount) }),
      });

      const data = await res.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json({ success: res.status === 200, ...data });

    } else if (action === "service_status") {
      const res = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/service-status`, { headers });
      const data = await res.json().catch(() => ({ success: false }));
      return json(data);

    } else {
      return json({ error: `Invalid action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("admin-provider-action error:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
