import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getTellerMerchantId as dbGetTellerMerchantId, getTellerApiKey as dbGetTellerApiKey, getTellerApiUser as dbGetTellerApiUser } from "../_shared/settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Purpose = "order" | "agent_activation" | "wallet_deposit";

interface InitiateBody {
  purpose: Purpose;
  bundle_id?: string;
  recipient_phone?: string;
  agent_slug?: string | null;
  amount?: number;
  email?: string;
  return_url?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as InitiateBody;

    const merchantId = await dbGetTellerMerchantId();
    const apiKey = await dbGetTellerApiKey();
    const apiUser = await dbGetTellerApiUser();
    if (!merchantId || !apiKey) {
      return json({ error: "Missing theTeller secrets." }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;

    if (authHeader) {
      try {
        const safeAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
        const userClient = createClient(supabaseUrl, safeAnonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: ud } = await userClient.auth.getUser();
        userId = ud.user?.id ?? null;
      } catch (err) {
        console.warn("Failed to get user from auth header", err);
      }
    }

    let amount = 0;
    let payload: Record<string, unknown> = {};

    if (body.purpose === "order") {
      if (!body.bundle_id || !body.recipient_phone) {
        return json({ error: "bundle_id and recipient_phone are required" }, 400);
      }

      const { data: bundle } = await admin
        .from("bundles")
        .select("id, base_price, user_price")
        .eq("id", body.bundle_id)
        .maybeSingle();

      if (!bundle) return json({ error: "Bundle not found" }, 404);

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

        if (agent) {
          source = "agent_store";
          if (agent.activation_paid) {
            const { data: ap } = await admin
              .from("agent_bundle_prices")
              .select("sell_price")
              .eq("agent_id", agent.id)
              .eq("bundle_id", bundle.id)
              .maybeSingle();
            if (ap?.sell_price != null) amount = Number(ap.sell_price);
          }
        }
      }

      const fee = amount * 0.03;
      amount = amount + fee;

      payload = {
        bundle_id: body.bundle_id,
        recipient_phone: body.recipient_phone,
        agent_slug: body.agent_slug ?? null,
        source,
        base_amount: amount - fee,
        fee,
      };
    } else if (body.purpose === "agent_activation") {
      if (!userId) return json({ error: "Unauthorized" }, 401);
      const { data: feeRow } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "agent_activation_fee")
        .maybeSingle();

      amount = Number(feeRow?.value ?? 50);
      payload = { user_id: userId, ref_slug: (body as any).ref_slug || null };
    } else if (body.purpose === "wallet_deposit") {
      if (!userId) return json({ error: "Unauthorized" }, 401);
      if (!body.amount) return json({ error: "Amount required" }, 400);

      const depositAmount = Number(body.amount);
      const fee = depositAmount * 0.03;
      amount = depositAmount + fee;
      payload = { user_id: userId, deposit_amount: depositAmount, fee };
    }

    const reference = Math.floor(100000000000 + Math.random() * 900000000000).toString();
    const authString = btoa(`${apiUser}:${apiKey}`);

    let frontendOrigin = "https://mtopup.shop";
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        frontendOrigin = new URL(referer).origin;
      } catch (_) {}
    }
    const redirectUrl = body.return_url || `${frontendOrigin}/track`;

    // Call theTeller checkout initiation API
    const initiateRes = await fetch("https://checkout.theteller.net/initiate", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${authString}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchant_id: merchantId,
        transaction_id: reference,
        amount: Math.round(amount * 100).toString().padStart(12, "0"),
        redirect_url: redirectUrl,
        desc: `${body.purpose} redirect checkout`,
        email: body.email || "customer@mtopup.shop", // redirect checkout requires email
      }),
    });

    const initiateData = await initiateRes.json();
    if (!initiateRes.ok || Number(initiateData?.code) !== 200) {
      console.error("theTeller Redirect Initiate Failed:", initiateData);
      let errMsg = "Failed to initiate redirect checkout";
      if (initiateData?.reason) {
        if (typeof initiateData.reason === "object") {
          errMsg = Object.entries(initiateData.reason)
            .map(([key, val]) => `${key}: ${val}`)
            .join(", ");
        } else {
          errMsg = String(initiateData.reason);
        }
      }
      return json({ error: errMsg }, 200);
    }

    // Insert initialized payment record
    await admin.from("payments").insert({
      reference,
      user_id: userId,
      purpose: body.purpose,
      amount,
      currency: "GHS",
      status: "initialized",
      payload: {
        ...payload,
        gateway: "theteller"
      },
    });

    return json({
      ok: true,
      reference,
      authorization_url: initiateData.checkout_url,
    });
  } catch (e: any) {
    console.error("theteller-initiate error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
