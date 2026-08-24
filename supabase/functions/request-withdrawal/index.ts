import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const body = await req.json();
  const amount = Number(body?.amount);
  const momo_number = String(body?.momo_number ?? "").trim();
  const momo_name = String(body?.momo_name ?? "").trim();
  const momo_network = String(body?.momo_network ?? "").trim();
  if (!amount || amount <= 0 || !momo_number || !momo_name || !momo_network) {
    return json({ ok: false, error: "Please fill in all fields (amount, network, number, and account name)" }, 200);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud.user) return json({ ok: false, error: "Session expired. Please log in again." }, 200);

  const admin = createClient(supabaseUrl, serviceKey);

  const { data: balance } = await admin.rpc("get_wallet_balance", { _user_id: ud.user.id });
  const currentBal = Number(balance ?? 0);
  const { data: minRow } = await admin.from("app_settings").select("value").eq("key", "min_withdrawal").maybeSingle();
  const minWithdrawal = Number(minRow?.value ?? 50);

  if (currentBal < minWithdrawal) {
    return json({ ok: false, error: `Minimum balance required for withdrawal is GH₵ ${minWithdrawal.toFixed(2)}. Your current balance is GH₵ ${currentBal.toFixed(2)}.` }, 200);
  }
  if (amount > currentBal) {
    return json({ ok: false, error: `Withdrawal amount (GH₵ ${amount.toFixed(2)}) exceeds your available balance (GH₵ ${currentBal.toFixed(2)}).` }, 200);
  }
  if (amount < minWithdrawal) {
    return json({ ok: false, error: `Minimum withdrawal amount is GH₵ ${minWithdrawal.toFixed(2)}.` }, 200);
  }

  const { data: w, error: wErr } = await admin
    .from("withdrawals")
    .insert({
      user_id: ud.user.id,
      amount,
      momo_number,
      momo_name,
      momo_network,
      status: "pending",
    })
    .select("*")
    .single();
  if (wErr) return json({ ok: false, error: wErr.message }, 200);

  // Lock funds via pending withdrawal tx
  await admin.from("wallet_transactions").insert({
    user_id: ud.user.id,
    type: "withdrawal",
    amount,
    status: "pending",
    description: `Withdrawal request to ${momo_network} ${momo_number}`,
  });

  return json({ ok: true, withdrawal: w });
});