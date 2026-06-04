import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const safeJsonStringify = (obj: any) => 
  JSON.stringify(obj, (_, v) => typeof v === "bigint" ? Number(v) : v, 2);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  const urlObj = new URL(req.url);
  const sqlParam = urlObj.searchParams.get("exec_sql");
  
  const dbUrl = Deno.env.get("SUPABASE_DB_URL");
  if (!dbUrl) {
    return new Response(JSON.stringify({ ok: false, error: "SUPABASE_DB_URL not configured in environment" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let client;
  try {
    client = new Client(dbUrl);
    await client.connect();
  } catch (connectErr: any) {
    return new Response(JSON.stringify({ ok: false, error: "DB Connect Failed: " + connectErr.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    if (sqlParam) {
      console.log("Executing SQL:", sqlParam);
      const result = await client.queryObject(sqlParam);
      await client.end();
      return new Response(safeJsonStringify({ ok: true, result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: return database overview
    const profilesRes = await client.queryObject("SELECT count(*) as count FROM public.profiles");
    const agentsRes = await client.queryObject("SELECT count(*) as count FROM public.agent_profiles");
    const rolesRes = await client.queryObject("SELECT count(*) as count FROM public.user_roles WHERE role = 'agent'");
    
    // Find active agent profiles missing the 'agent' role
    const missingRolesRes = await client.queryObject(`
      SELECT ap.user_id, ap.store_name 
      FROM public.agent_profiles ap
      LEFT JOIN public.user_roles ur ON ur.user_id = ap.user_id AND ur.role = 'agent'
      WHERE ap.activation_paid = true AND ur.role IS NULL
    `);

    // Get active gateway
    const gatewayRes = await client.queryObject("SELECT value FROM public.app_settings WHERE key = 'active_payment_gateway'");

    // Get failed orders
    const failedOrdersRes = await client.queryObject("SELECT id, reference, recipient_phone, sell_price, notes, created_at FROM public.orders WHERE status = 'failed' ORDER BY created_at DESC LIMIT 10");

    // Get active policies
    const policiesRes = await client.queryObject("SELECT tablename, policyname, cmd, qual FROM pg_policies WHERE schemaname = 'public'");

    await client.end();

    return new Response(safeJsonStringify({
      ok: true,
      active_payment_gateway: (gatewayRes.rows[0] as any)?.value || "paystack",
      total_profiles: (profilesRes.rows[0] as any)?.count || 0,
      total_agents: (agentsRes.rows[0] as any)?.count || 0,
      total_agent_roles: (rolesRes.rows[0] as any)?.count || 0,
      anomalies: {
        missing_agent_roles: missingRolesRes.rows
      },
      policies: policiesRes.rows,
      failedOrders: failedOrdersRes.rows
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    if (client) {
      try { await client.end(); } catch (_) {}
    }
    return new Response(JSON.stringify({ ok: false, error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
