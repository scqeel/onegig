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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization header" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud, error: udErr } = await userClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (udErr || !ud.user?.id) return json({ error: "Unauthorized", details: udErr?.message }, 401);
    
    const userId = ud.user.id;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: agent } = await admin.from("agent_profiles").select("id").eq("user_id", userId).maybeSingle();
    if (!agent?.id) return json({ error: "Not an active agent" }, 403);

    const body = await req.json();
    const action = body.action || "list";
    const settingKey = `crm_agent_${agent.id}`;

    const { data: settings } = await admin.from("app_settings").select("value").eq("key", settingKey).maybeSingle();
    let customers: any[] = settings?.value || [];

    if (action === "list") {
      return json({ ok: true, customers });
    } else if (action === "add" || action === "update") {
      const name = body.customer?.name || body.name;
      const phone = body.customer?.phone || body.phone;
      const id = body.customer?.id || body.id;
      if (!name || !phone) return json({ error: "Missing name or phone" }, 400);
      const cleanPhone = phone.replace(/\D/g, "");
      
      // Remove existing with same phone to update
      customers = customers.filter((c) => c.phone !== cleanPhone && c.id !== id);
      customers.push({ id: id || crypto.randomUUID(), name, phone: cleanPhone, created_at: new Date().toISOString() });
      
      await admin.from("app_settings").upsert({ key: settingKey, value: customers });
      return json({ ok: true, customers });
    } else if (action === "delete") {
      const id = body.customer?.id || body.id;
      const phone = body.customer?.phone || body.phone;
      if (id) {
        customers = customers.filter((c) => c.id !== id);
      } else if (phone) {
        const cleanPhone = phone.replace(/\D/g, "");
        customers = customers.filter((c) => c.phone !== cleanPhone);
      }
      await admin.from("app_settings").upsert({ key: settingKey, value: customers });
      return json({ ok: true, customers });
    }

    return json({ error: "Invalid action" }, 400);
  } catch (e: any) {
    console.error("crm-manage error", e);
    return json({ ok: false, error: e?.message ?? "Internal error" }, 500);
  }
});
