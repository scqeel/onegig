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

  const { data: pay, error: payErr } = await admin.from("payments").select("*").order("created_at", { ascending: false }).limit(5);
  const { data: wal, error: walErr } = await admin.from("wallet_transactions").select("*").order("created_at", { ascending: false }).limit(5);
  
  // Try querying a balance for the most recent wallet transaction user
  let bal = null;
  let balErr = null;
  if (wal && wal.length > 0) {
     const { data, error } = await admin.rpc("get_wallet_balance", { _user_id: wal[0].user_id });
     bal = data;
     balErr = error;
  }

  return new Response(JSON.stringify({
    payments: pay,
    payErr,
    wallet_transactions: wal,
    walErr,
    last_user_balance: bal,
    balErr
  }, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
