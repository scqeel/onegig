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

type Purpose = "order" | "agent_activation";

interface InitiateBody {
  purpose: Purpose;
  bundle_id?: string;
  recipient_phone?: string;
  agent_slug?: string | null;
  email?: string;
  return_url?: string;
}

const getPaystackSecret = () =>
  Deno.env.get("PAYSTACK_SECRET_KEY") ||
  Deno.env.get("PAYSTACK_SECRET") ||
  Deno.env.get("PAYSTACK_LIVE_SECRET_KEY") ||
  "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as InitiateBody;
    if (!body?.purpose) return json({ error: "purpose is required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const paystackSecret = getPaystackSecret();
    if (!paystackSecret) {
      return json({
        error: "Missing Paystack secret. Set PAYSTACK_SECRET_KEY in Supabase function secrets.",
      }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader) {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
      const { data: ud } = await userClient.auth.getUser();
      userId = ud.user?.id ?? null;
      userEmail = ud.user?.email ?? null;
    }

    let amount = 0;
    let payload: Record<string, unknown> = {};

    if (body.purpose === "order") {
      if (!body.bundle_id || !body.recipient_phone) {
        return json({ error: "bundle_id and recipient_phone are required" }, 400);
      }

      const { data: bundle, error: bundleErr } = await admin
        .from("bundles")
        .select("id, base_price, user_price, size_label, network_id")
        .eq("id", body.bundle_id)
        .maybeSingle();

      if (bundleErr || !bundle) return json({ error: "Bundle not found" }, 404);

      amount = Number(bundle.user_price ?? bundle.base_price);
      let source: "direct" | "agent_store" = "direct";

      if (userId) {
        const { data: roleRow } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "agent")
          .maybeSingle();
        if (roleRow?.role === "agent") {
          amount = Number(bundle.base_price);
        }
      }

      if (body.agent_slug) {
        const { data: agent } = await admin
          .from("agent_profiles")
          .select("id, activation_paid")
          .eq("store_slug", body.agent_slug)
          .maybeSingle();

        if (agent?.activation_paid) {
          source = "agent_store";
          const { data: ap } = await admin
            .from("agent_bundle_prices")
            .select("sell_price")
            .eq("agent_id", agent.id)
            .eq("bundle_id", bundle.id)
            .maybeSingle();
          if (ap?.sell_price != null) amount = Number(ap.sell_price);
        }
      }

      payload = {
        bundle_id: body.bundle_id,
        recipient_phone: body.recipient_phone,
        agent_slug: body.agent_slug ?? null,
        source,
      };
    }

    if (body.purpose === "agent_activation") {
      if (!userId) return json({ error: "Unauthorized" }, 401);

      const { data: feeRow } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "agent_activation_fee")
        .maybeSingle();

      amount = Number(feeRow?.value ?? 50);
      payload = { user_id: userId };
    }

    if (body.purpose === "wallet_deposit") {
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const depositAmount = Number((body as any).deposit_amount);
      if (!depositAmount || depositAmount <= 0) return json({ error: "Invalid deposit amount" }, 400);

      // Add 3% processing fee
      amount = depositAmount * 1.03;
      payload = { user_id: userId, deposit_amount: depositAmount };
    }

    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);

    const email = (body.email ?? userEmail ?? "").trim().toLowerCase();
    if (!email) return json({ error: "Email is required for payment" }, 400);

    const reference = `DH-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const callbackUrl = body.return_url || Deno.env.get("PAYSTACK_CALLBACK_URL") || "";

    const initRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        currency: "GHS",
        reference,
        callback_url: callbackUrl || undefined,
        metadata: {
          purpose: body.purpose,
          user_id: userId,
          ...payload,
        },
      }),
    });

    const initData = await initRes.json();
    if (!initRes.ok || !initData?.status) {
      return json({ error: initData?.message ?? "Unable to initialize payment" }, 500);
    }

    // Do not block checkout redirection if DB logging fails.
    const { error: paymentInsertError } = await admin.from("payments").insert({
      reference,
      user_id: userId,
      purpose: body.purpose,
      amount,
      currency: "GHS",
      status: "initialized",
      payload,
    });
    if (paymentInsertError) {
      console.warn("payments insert warning", paymentInsertError.message);
    }

    return json({
      ok: true,
      reference,
      authorization_url: initData.data.authorization_url,
      access_code: initData.data.access_code,
    });
  } catch (e: any) {
    console.error("paystack-initiate error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
