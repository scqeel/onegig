import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";

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

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const { audience, message, testNumber } = await req.json();
  if (!message) return json({ error: "Message is required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  // 1. Verify Caller is Admin
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: canAdmin } = await admin.rpc("has_role", { _user_id: ud.user.id, _role: "admin" });
  if (!canAdmin) return json({ error: "Forbidden" }, 403);

  // 2. Fetch Audience
  let phones = new Set<string>();

  if (audience === "test" && testNumber) {
    phones.add(testNumber);
  } else if (audience === "agents") {
    // Get all agents
    const { data: agentUsers } = await admin
      .from("user_roles")
      .select("user_id")
      .eq("role", "agent");
    
    if (agentUsers?.length) {
      const ids = agentUsers.map(a => a.user_id);
      const { data: profiles } = await admin.from("profiles").select("phone").in("id", ids).not("phone", "is", null);
      profiles?.forEach(p => p.phone && phones.add(p.phone));
    }
  } else if (audience === "all") {
    // Get all users
    const { data: profiles } = await admin.from("profiles").select("phone").not("phone", "is", null);
    profiles?.forEach(p => p.phone && phones.add(p.phone));
  }

  const phoneArray = Array.from(phones);
  
  if (phoneArray.length === 0) {
    return json({ error: "No recipients found" }, 400);
  }

  // 3. Send SMS asynchronously
  // TXTConnect might complain if we blast concurrently, so we do chunks or sequentially.
  // For safety and speed, we do sequential batches of 10.
  let sent = 0;
  for (const phone of phoneArray) {
    await sendSMS({ to: phone, message });
    sent++;
  }

  return json({ ok: true, sent });
});
