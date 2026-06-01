import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) return new Response(JSON.stringify({ error: "payment_id required" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud } = await userClient.auth.getUser();
    const userId = ud.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // Fetch payment
    const { data: payment } = await admin.from("payments").select("*").eq("id", payment_id).maybeSingle();
    if (!payment) return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: corsHeaders });

    if (payment.status === "paid") {
      return new Response(JSON.stringify({ ok: true, message: "Payment already marked as paid" }), { headers: corsHeaders });
    }

    let pLoad = payment.payload;
    if (typeof pLoad === "string") {
      try { pLoad = JSON.parse(pLoad); } catch(e) { pLoad = {}; }
    }
    
    // Clear the error message and set a resolved flag
    if (pLoad && typeof pLoad === "object") {
      delete (pLoad as any).error_message;
      (pLoad as any).resolved_manually = true;
    }

    // Mark as paid
    await admin.from("payments").update({ status: "paid", payload: pLoad }).eq("id", payment_id);

    return new Response(JSON.stringify({ ok: true, payment: { ...payment, status: "paid", payload: pLoad } }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
