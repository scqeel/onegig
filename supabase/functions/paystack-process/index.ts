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

type Purpose = "order" | "agent_activation" | "wallet_deposit";

interface ProcessBody {
  action?: "submit_otp";
  otp?: string;
  reference?: string;
  purpose: Purpose;
  bundle_id?: string;
  recipient_phone?: string;
  agent_slug?: string | null;
  momo_number: string;
  momo_network: string; // MTN, VDF, ATL, TGO
  amount?: number;
  coupon_code?: string | null;
  subscribe?: boolean;
  frequency?: "weekly" | "monthly";
  points_redeemed?: number;
}

const getPaystackSecret = () =>
  Deno.env.get("PAYSTACK_SECRET_KEY") ||
  Deno.env.get("PAYSTACK_SECRET") ||
  Deno.env.get("PAYSTACK_LIVE_SECRET_KEY") ||
  "";

function toPaystackProvider(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (["MTN", "M"].includes(normalized)) return "mtn";
  if (["TELECEL", "VODAFONE", "VODA", "VOD", "T", "TCL"].includes(normalized)) return "vod";
  if (["AIRTELTIGO", "AT", "AIRTEL", "TIGO", "A"].includes(normalized)) return "tgo";
  return "mtn";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as ProcessBody & { email?: string };

    const paystackSecret = getPaystackSecret();
    if (!paystackSecret) {
      return json({
        error: "Missing Paystack secrets. Set PAYSTACK_SECRET_KEY.",
      }, 500);
    }

    if (body?.action === "submit_otp") {
      if (!body.otp || !body.reference) return json({ error: "otp and reference are required" }, 400);
      
      const otpRes = await fetch("https://api.paystack.co/charge/submit_otp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${paystackSecret}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          otp: body.otp,
          reference: body.reference,
        }),
      });

      const otpData = await otpRes.json().catch(() => null);
      if (!otpRes.ok || !otpData?.status) {
        return json({ error: otpData?.message ?? "Failed to submit OTP" }, 200);
      }

      return json({
        ok: true,
        reference: body.reference,
        status: otpData?.data?.status ?? "success",
        message: otpData?.data?.display_text || otpData?.message,
      });
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
          .select("id, activation_paid, user_id")
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

      // Secure Server-side Coupon Validation
      let discountAmount = 0;
      if (body.coupon_code) {
        const cleanCouponCode = String(body.coupon_code).trim().toUpperCase();
        const { data: coupon } = await admin
          .from("coupons")
          .select("*")
          .eq("code", cleanCouponCode)
          .eq("active", true)
          .maybeSingle();

        if (coupon) {
          if (Number(coupon.current_uses) < Number(coupon.max_uses)) {
            let isValidForStore = true;
            if (coupon.agent_id) {
              if (body.agent_slug) {
                const { data: agentProfile } = await admin
                  .from("agent_profiles")
                  .select("id")
                  .eq("store_slug", body.agent_slug)
                  .maybeSingle();
                
                if (!agentProfile || agentProfile.id !== coupon.agent_id) {
                  isValidForStore = false;
                }
              } else {
                isValidForStore = false;
              }
            }

            if (isValidForStore) {
              // Ensure discount does not exceed the storefront base price (prevent negative/free order checkouts)
              discountAmount = Math.min(amount, Number(coupon.discount_amount));
            }
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
          const maxPointsToDeduct = Math.floor(pointsAvailable / 10); // max discount in GHS
          
          if (maxPointsToDeduct > 0) {
            loyaltyDiscount = Math.min(body.points_redeemed, maxPointsToDeduct);
            // Cap discount so that the customer pays at least GHS 1.00 before transaction fee
            loyaltyDiscount = Math.min(loyaltyDiscount, amount - discountAmount - 1);
          }
        }
      }

      const baseAmount = Math.max(1, amount - discountAmount - loyaltyDiscount);
      const fee = baseAmount * 0.03;
      amount = baseAmount + fee; // Add 3% payment fee

      payload = {
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
      if (!body.amount || body.amount < 1) return json({ error: "Valid amount required" }, 400);
      
      const depositAmount = Number(body.amount);
      const fee = depositAmount * 0.03;
      amount = depositAmount + fee; // Total to charge
      
      payload = { user_id: userId, deposit_amount: depositAmount, fee };
    }

    if (!amount || amount <= 0) return json({ error: "Invalid amount" }, 400);

    const email = (body.email || userEmail || "guest@mtopup.shop").trim().toLowerCase();
    const reference = `DH-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const processRes = await fetch("https://api.paystack.co/charge", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100),
        reference,
        currency: "GHS",
        mobile_money: {
          phone: body.momo_number.replace(/\D/g, ""),
          provider: toPaystackProvider(body.momo_network)
        },
        metadata: {
          purpose: body.purpose,
          user_id: userId,
          ...payload,
        }
      }),
    });

    let processData;
    try {
      processData = await processRes.json();
    } catch (e) {
      const text = await processRes.text().catch(() => "");
      console.error("Paystack API returned non-JSON:", processRes.status, text);
      return json({ error: `Paystack API Error ${processRes.status}.` }, 200);
    }

    if (!processRes.ok || !processData?.status) {
      console.error("Paystack Process Failed:", processData);
      
      // Handle OTP requirement gracefully
      if (processData?.data?.status === "send_otp") {
        // Record payment early so webhook works if they authorize somehow
        await admin.from("payments").insert({
          reference,
          user_id: userId,
          purpose: body.purpose,
          amount,
          currency: "GHS",
          status: "initialized",
          payload,
        });
        
        return json({
          ok: true,
          reference,
          status: "send_otp",
          message: processData?.data?.display_text || "Please enter the OTP sent to your phone."
        });
      }
      
      return json({ error: processData?.message ?? "Unable to initialize payment" }, 200);
    }

    // Insert payment record
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
      status: processData?.data?.status,
      message: processData?.data?.display_text || processData?.message,
    });
  } catch (e: any) {
    console.error("paystack-process error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});

