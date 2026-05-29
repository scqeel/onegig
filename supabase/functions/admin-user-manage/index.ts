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
    
    // Authenticate the caller
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud, error: udErr } = await userClient.auth.getUser();
    if (udErr || !ud.user?.id) return json({ error: "Unauthorized" }, 401);
    
    const admin = createClient(supabaseUrl, serviceKey);

    // Verify caller is an admin
    const { data: canAdmin } = await admin.rpc("has_role", { _user_id: ud.user.id, _role: "admin" });
    if (!canAdmin) return json({ error: "Forbidden: Admins only" }, 403);

    const body = await req.json();
    const { action, target_user_id } = body;

    if (!target_user_id) return json({ error: "target_user_id is required" }, 400);

    if (action === "adjust_wallet") {
      const amount = Number(body.amount);
      if (isNaN(amount) || amount === 0) return json({ error: "Valid non-zero amount required" }, 400);

      const description = body.description || (amount > 0 ? "Admin Manual Credit" : "Admin Manual Debit");
      
      const { error: txErr } = await admin.from("wallet_transactions").insert({
        user_id: target_user_id,
        type: amount > 0 ? "deposit" : "withdrawal",
        amount: amount, 
        status: "completed",
        description,
      });

      if (txErr) throw new Error(txErr.message);

      return json({ ok: true, message: `Wallet ${amount > 0 ? 'credited' : 'debited'} successfully` });

    } else if (action === "reset_password") {
      const { new_password } = body;
      if (!new_password || new_password.length < 6) return json({ error: "Password must be at least 6 characters" }, 400);

      const { data: authData, error: authErr } = await admin.auth.admin.updateUserById(target_user_id, {
        password: new_password
      });

      if (authErr) throw new Error(authErr.message);

      return json({ ok: true, message: "Password updated successfully" });

    } else {
      return json({ error: "Invalid action specified" }, 400);
    }
    
  } catch (e: any) {
    console.error("admin-user-manage error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
