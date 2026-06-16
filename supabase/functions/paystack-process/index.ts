import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaystackSecretKey } from "../_shared/settings.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

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

function normalizeGhanaPhone(phone: string): string {
  let cleaned = phone.replace(/\D/g, ""); // Only numbers
  if (cleaned.startsWith("00233") && cleaned.length > 11) {
    cleaned = cleaned.slice(5);
  }
  if (cleaned.startsWith("233") && cleaned.length > 9) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.startsWith("0")) {
    if (cleaned.length > 10) {
      cleaned = cleaned.slice(0, 10);
    }
  } else {
    if (cleaned.length === 9) {
      cleaned = "0" + cleaned;
    }
  }
  return cleaned;
}

function toPaystackProvider(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (["MTN", "M"].includes(normalized)) return "mtn";
  if (["TELECEL", "VODAFONE", "VODA", "VOD", "T", "TCL"].includes(normalized)) return "vod";
  if (["AIRTELTIGO", "AT", "AIRTEL", "TIGO", "A"].includes(normalized)) return "atl";
  return "mtn";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as ProcessBody & { email?: string };

    const paystackSecret = await getPaystackSecretKey();
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

    const authHeader = req.headers.get("Authorization");
    let userId: string | null = null;
    let userEmail: string | null = null;

    if (authHeader && authHeader.startsWith("Bearer ") && authHeader.substring(7).trim() !== "" && authHeader !== "Bearer null" && authHeader !== "Bearer undefined") {
      try {
        const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
        const userClient = createClient(supabaseUrl, anonKey, {
          global: { headers: { Authorization: authHeader } },
        });
        const { data: ud, error: udErr } = await userClient.auth.getUser();
        if (udErr || !ud.user) {
          return json({ error: "Unauthorized: Invalid token" }, 401);
        }
        userId = ud.user.id;
        userEmail = ud.user.email ?? null;
      } catch (err) {
        console.warn("Failed to verify JWT payload via GoTrue", err);
        return json({ error: "Unauthorized: Token verification failed" }, 401);
      }
    }

    let amount = 0;
    let payload: Record<string, unknown> = {};

    if (body.purpose === "order") {
      if (!body.bundle_id || !body.recipient_phone) {
        return json({ error: "bundle_id and recipient_phone are required" }, 400);
      }

      // Query bundle, user role, agent profile, and coupon in parallel
      const bundlePromise = admin
        .from("bundles")
        .select("id, base_price, user_price, size_label, network_id")
        .eq("id", body.bundle_id)
        .maybeSingle();

      const rolePromise = userId
        ? admin
            .from("user_roles")
            .select("role")
            .eq("user_id", userId)
            .eq("role", "agent")
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const agentPromise = body.agent_slug
        ? admin
            .from("agent_profiles")
            .select("id, activation_paid, user_id")
            .eq("store_slug", body.agent_slug)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const couponPromise = body.coupon_code
        ? admin
            .from("coupons")
            .select("*")
            .eq("code", String(body.coupon_code).trim().toUpperCase())
            .eq("active", true)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [bundleRes, roleRes, agentRes, couponRes] = await Promise.all([
        bundlePromise,
        rolePromise,
        agentPromise,
        couponPromise,
      ]);

      const bundle = bundleRes.data;
      if (bundleRes.error || !bundle) return json({ error: "Bundle not found" }, 404);

      amount = Number(bundle.user_price ?? bundle.base_price);
      let source: "direct" | "agent_store" = "direct";

      const roleRow = roleRes.data;
      if (roleRow?.role === "agent") {
        amount = Number(bundle.base_price);
      }

      const agent = agentRes.data;
      if (agent) {
        source = "agent_store";
      }

      // Now query agent bundle price if agent is active, and loyalty points if points are redeemed
      const agentPricePromise = (agent && agent.activation_paid)
        ? admin
            .from("agent_bundle_prices")
            .select("sell_price")
            .eq("agent_id", agent.id)
            .eq("bundle_id", bundle.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const loyaltyPromise = (body.points_redeemed && body.points_redeemed > 0 && userId && agent)
        ? admin
            .from("loyalty_points")
            .select("points_balance")
            .eq("user_id", userId)
            .eq("agent_id", agent.id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null });

      const [agentPriceRes, loyaltyRes] = await Promise.all([
        agentPricePromise,
        loyaltyPromise,
      ]);

      if (agentPriceRes.data?.sell_price != null) {
        amount = Number(agentPriceRes.data.sell_price);
      }

      // Secure Server-side Coupon Validation
      let discountAmount = 0;
      const coupon = couponRes.data;
      if (coupon) {
        if (Number(coupon.current_uses) < Number(coupon.max_uses)) {
          let isValidForStore = true;
          if (coupon.agent_id) {
            if (agent) {
              if (agent.id !== coupon.agent_id) {
                isValidForStore = false;
              }
            } else {
              isValidForStore = false;
            }
          }

          if (isValidForStore) {
            discountAmount = Math.min(amount, Number(coupon.discount_amount));
          }
        }
      }

      let loyaltyDiscount = 0;
      const loyaltyRow = loyaltyRes.data;
      if (loyaltyRow && body.points_redeemed) {
        const pointsAvailable = loyaltyRow.points_balance ?? 0;
        const maxPointsToDeduct = Math.floor(pointsAvailable / 10); // max discount in GHS
        
        if (maxPointsToDeduct > 0) {
          loyaltyDiscount = Math.min(body.points_redeemed, maxPointsToDeduct);
          // Cap discount so that the customer pays at least GHS 1.00 before transaction fee
          loyaltyDiscount = Math.min(loyaltyDiscount, amount - discountAmount - 1);
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

    let email = (body.email || userEmail || "guest@mtopup.shop").trim().toLowerCase();
    if (email === "guest@mtopup.shop") {
      email = `guest-${crypto.randomUUID().slice(0, 8)}@mtopup.shop`;
    }
    const reference = `DH-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    let processRes: Response;
    try {
      processRes = await fetch("https://api.paystack.co/charge", {
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
            phone: normalizeGhanaPhone(body.momo_number),
            provider: toPaystackProvider(body.momo_network),
          },
          metadata: {
            purpose: body.purpose,
            user_id: userId,
            ...payload,
          },
        }),
      });
    } catch (fetchErr: unknown) {
      const msg = fetchErr instanceof Error ? fetchErr.message : "Network error";
      console.error("Paystack fetch failed:", msg);
      return json({ error: `Could not reach payment gateway. ${msg}` }, 200);
    }

    let processData;
    try {
      processData = await processRes.json();
    } catch (e) {
      console.error("Paystack API returned non-JSON:", processRes.status);
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
      // Insert a failed payment record so we can track it
      const { error: failedPaymentErr } = await admin.from("payments").insert({
        reference,
        user_id: userId,
        purpose: body.purpose,
        amount,
        currency: "GHS",
        status: "failed",
        payload: {
          ...payload,
          error_message: processData?.message ?? "Unable to initialize payment"
        },
      });
      if (failedPaymentErr) {
        console.error("Failed to insert failed payment:", failedPaymentErr.message);
      }
      
      let errorMsg = processData?.message ?? "Unable to initialize payment";
      if (errorMsg === "Charge attempted") {
        errorMsg = "A payment prompt is already active on your phone. Please check your phone and enter your PIN — do not tap Pay again.";
      } else if (errorMsg === "Unable to perform transaction, try again") {
        errorMsg = "Payment declined by mobile operator. Please verify you have sufficient funds and your wallet is active, then try again.";
      } else if (errorMsg.toLowerCase().includes("insufficient") && errorMsg.toLowerCase().includes("fund")) {
        errorMsg = "Your mobile money wallet has insufficient funds to complete this payment. Please top up and try again.";
      }
      
      return json({ error: errorMsg, gateway_response: processData?.data?.gateway_response }, 200);
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
    return json({
      error: e?.message ?? "Internal error",
      details: e?.stack ?? String(e)
    }, 500);
  }
});

// Trigger redeployment

