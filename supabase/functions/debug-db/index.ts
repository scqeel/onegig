import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );
  const urlObj = new URL(req.url);
  const switchTo = urlObj.searchParams.get("switch_to");
  let switchResult: any = null;
  let switchError: any = null;

  if (switchTo === "paystack" || switchTo === "theteller") {
    const { data, error } = await admin
      .from("app_settings")
      .update({ value: switchTo })
      .eq("key", "active_payment_gateway")
      .select();
    switchResult = data;
    switchError = error;
  }

  // 1. Get recent agent_profiles
  const { data: agents, error: agentsErr } = await admin
    .from("agent_profiles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  // 2. Get recent user_roles
  const { data: roles, error: rolesErr } = await admin
    .from("user_roles")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  // 3. Get recent orders
  const { data: orders, error: ordersErr } = await admin
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  // 4. Get recent payments
  const { data: payments, error: paymentsErr } = await admin
    .from("payments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);

  return new Response(JSON.stringify({
    agents,
    agentsErr,
    roles,
    rolesErr,
    orders,
    ordersErr,
    payments,
    paymentsErr,
    switchResult,
    switchError
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
