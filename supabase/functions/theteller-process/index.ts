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

interface ProcessBody {
  purpose: Purpose;
  bundle_id?: string;
  recipient_phone?: string;
  agent_slug?: string | null;
  momo_number: string;
  momo_network: string; // MTN, TELECEL, AT
  amount?: number;
  coupon_code?: string | null;
  subscribe?: boolean;
  frequency?: "weekly" | "monthly";
  points_redeemed?: number;
}

function toTellerProvider(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (["MTN", "M"].includes(normalized)) return "mtn";
  if (["TELECEL", "VODAFONE", "VODA", "VOD", "T", "TCL"].includes(normalized)) return "vod";
  if (["AIRTELTIGO", "AT", "AIRTEL", "TIGO", "A"].includes(normalized)) return "tgo";
  return "mtn";
}

function formatTo233(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0")) {
    return "233" + digits.slice(1);
  }
  if (digits.startsWith("233")) {
    return digits;
  }
  return "233" + digits;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as ProcessBody & { email?: string };

    const merchantId = await dbGetTellerMerchantId();
    const apiKey = await dbGetTellerApiKey();
    const apiUser = await dbGetTellerApiUser();
    if (!merchantId || !apiKey) {
      return json({
        error: "Missing theTeller secrets. Set THETELLER_MERCHANT_ID and THETELLER_API_KEY.",
      }, 500);
    }

    if (!body?.purpose) return json({ error: "purpose is required" }, 400);
    if (!body?.momo_number || !body?.momo_network) return json({ error: "momo_number and momo_network are required" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader) {
      try {
        const safeAnonKey = anonKey || serviceKey;
        const userClient = createClient(supabaseUrl, safeAnonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: ud } = await userClient.auth.getUser();
        userId = ud.user?.id ?? null;
        userEmail = ud.user?.email ?? null;
      } catch (err) {
        console.warn("Failed to get user from auth header", err);
      }
    }

    let amount = 0;
    let payload: Record<string, unknown> = {};

    if (body.purpose === "order") {
      const type = (body as any).type || "data";

      if (type === "data") {
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
          const { data: agentProfile } = await admin
            .from("agent_profiles")
            .select("id, activation_paid")
            .eq("store_slug", body.agent_slug)
            .maybeSingle();

          if (agentProfile) {
            source = "agent_store";
            if (agentProfile.activation_paid) {
              const { data: ap } = await admin
                .from("agent_bundle_prices")
                .select("sell_price")
                .eq("agent_id", agentProfile.id)
                .eq("bundle_id", bundle.id)
                .maybeSingle();
              if (ap) amount = Number(ap.sell_price);
            }
          }
        }

        let discountAmount = 0;
        if (body.coupon_code) {
          const { data: coupon } = await admin
            .from("coupons")
            .select("*")
            .eq("code", String(body.coupon_code).trim().toUpperCase())
            .eq("active", true)
            .maybeSingle();

          if (coupon && Number(coupon.current_uses) < Number(coupon.max_uses)) {
            let isValidForStore = true;
            if (coupon.agent_id && body.agent_slug) {
              const { data: agentProfile } = await admin
                .from("agent_profiles")
                .select("id")
                .eq("store_slug", body.agent_slug)
                .maybeSingle();
              if (!agentProfile || agentProfile.id !== coupon.agent_id) {
                isValidForStore = false;
              }
            } else if (coupon.agent_id && !body.agent_slug) {
              isValidForStore = false;
            }

            if (isValidForStore) {
              discountAmount = Math.min(amount, Number(coupon.discount_amount));
            }
          }
        }

        let loyaltyDiscount = 0;
        if (body.points_redeemed && body.points_redeemed > 0 && userId && body.agent_slug) {
          const { data: agentProfile } = await admin
            .from("agent_profiles")
            .select("id")
            .eq("store_slug", body.agent_slug)
            .maybeSingle();

          if (agentProfile) {
            const { data: loyaltyRow } = await admin
              .from("loyalty_points")
              .select("points_balance")
              .eq("user_id", userId)
              .eq("agent_id", agentProfile.id)
              .maybeSingle();

            const pointsAvailable = loyaltyRow?.points_balance ?? 0;
            const maxPointsToDeduct = Math.floor(pointsAvailable / 10);
            
            if (maxPointsToDeduct > 0) {
              loyaltyDiscount = Math.min(body.points_redeemed, maxPointsToDeduct);
              loyaltyDiscount = Math.min(loyaltyDiscount, amount - discountAmount - 1);
            }
          }
        }

        const baseAmount = Math.max(1, amount - discountAmount - loyaltyDiscount);
        const fee = baseAmount * 0.03;
        amount = baseAmount + fee;

        payload = {
          type,
          bundle_id: body.bundle_id,
          recipient_phone: body.recipient_phone,
          agent_slug: body.agent_slug ?? null,
          source,
          base_amount: baseAmount,
          fee,
          coupon_code: body.coupon_code || null,
          coupon_discount: discountAmount,
          subscribe: body.subscribe || false,
          frequency: body.frequency || null,
          points_redeemed: loyaltyDiscount > 0 ? loyaltyDiscount : null,
        };
      } else {
        // airtime or bill
        if (!body.recipient_phone || !body.amount || Number(body.amount) <= 0) {
          return json({ error: "recipient_phone and positive amount are required" }, 400);
        }

        const baseAmount = Number(body.amount);
        const fee = baseAmount * 0.03;
        amount = baseAmount + fee;

        payload = {
          type,
          recipient_phone: body.recipient_phone,
          agent_slug: body.agent_slug ?? null,
          source: body.agent_slug ? "agent_store" : "direct",
          base_amount: baseAmount,
          fee,
          network_code: (body as any).network_code,
          bill_type: (body as any).bill_type,
          sender_name: (body as any).sender_name,
        };
      }
    }

    if (body.purpose === "agent_activation") {
      if (!userId) return json({ error: "Unauthorized" }, 401);

      const { data: feeRow } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "agent_activation_fee")
        .maybeSingle();

      amount = Number(feeRow?.value ?? 50);
      payload = { user_id: userId, ref_slug: (body as any).ref_slug };
    } else if (body.purpose === "wallet_deposit") {
      if (!userId) return json({ error: "Authentication required for wallet deposit" }, 401);
      const rawAmount = body.amount ?? (body as any).deposit_amount;
      if (!rawAmount || Number(rawAmount) < 1) return json({ error: "Valid amount required" }, 400);
      
      const depositAmount = Number(rawAmount);
      const fee = depositAmount * 0.03;
      amount = depositAmount + fee;
      
      payload = { user_id: userId, deposit_amount: depositAmount, fee };
    }

    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);

    const provider = toTellerProvider(body.momo_network);
    const reference = Math.floor(100000000000 + Math.random() * 900000000000).toString(); // theTeller requires a 12-digit numeric transaction id

    const authString = btoa(`${apiUser}:${apiKey}`);

    let rSwitch = "MTN";
    if (provider === "vod") rSwitch = "VDF";
    else if (provider === "tgo") rSwitch = "TGO";

    // Call theTeller Process transaction API
    let processRes: Response;
    try {
      processRes = await fetch("https://prod.theteller.net/v1.1/transaction/process", {
        method: "POST",
        headers: {
          "Authorization": `Basic ${authString}`,
          "Content-Type": "application/json",
          "Merchant-Id": merchantId
        },
        body: JSON.stringify({
          amount: Math.round(amount * 100).toString().padStart(12, "0"), // theTeller requires amount padded to 12 digits in minor units (e.g. "000000005000")
          processing_code: "000200",
          transaction_id: reference,
          desc: `${body.purpose} payment`,
          merchant_id: merchantId,
          subscriber_number: formatTo233(body.momo_number),
          "r-switch": rSwitch
        }),
      });
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
      console.error("theTeller fetch failed:", msg);
      return json({ error: `Could not reach payment gateway. ${msg}` }, 200);
    }

    let processData;
    try {
      processData = await processRes.json();
    } catch (e) {
      console.error("theTeller API returned non-JSON:", processRes.status);
      return json({ error: `theTeller API Error ${processRes.status}.` }, 200);
    }

    // theTeller returns status code '000' for success, '100' for pending (awaiting momo authorize PIN)
    const resCode = String(processData?.code ?? "");
    if (resCode !== "000" && resCode !== "100") {
      console.error("theTeller Process Failed:", processData);
      
      await admin.from("payments").insert({
        reference,
        user_id: userId,
        purpose: body.purpose,
        amount,
        currency: "GHS",
        status: "failed",
        payload: {
          ...payload,
          gateway: "theteller",
          error_message: processData?.reason ?? "Unable to initialize payment",
          gateway_response: processData
        },
      });

      return json({ error: processData?.reason ?? "Unable to initialize payment" }, 200);
    }

    // Insert payment record as initialized
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
      status: String(processData?.code ?? "") === "000" ? "success" : "pending",
      message: processData?.reason || "Please authorize the transaction on your phone.",
    });
  } catch (e: any) {
    console.error("theteller-process error", e);
    return json({
      error: e?.message ?? "Internal error",
      details: e?.stack ?? String(e)
    }, 500);
  }
});
