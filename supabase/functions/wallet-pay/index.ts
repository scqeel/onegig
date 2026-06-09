import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";
import { sendWebPushNotification } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function toProviderNetwork(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (["MTN", "M"].includes(normalized)) return "MTN";
  if (["TELECEL", "VODAFONE", "VODA", "VOD", "T", "TCL"].includes(normalized)) return "TELECEL";
  if (["AT", "AIRTELTIGO", "AIRTEL", "TIGO", "A"].includes(normalized)) return "AT";
  return normalized || "MTN";
}

function toPlanId(sizeLabel: string | null | undefined, sizeMb: number) {
  if (sizeLabel) {
    const match = String(sizeLabel).match(/(\d+(?:\.\d+)?)\s*(gb|mb)/i);
    if (match) {
      return (match[1] + match[2]).toUpperCase();
    }
  }
  const gb = Number(sizeMb) / 1024;
  const safeGb = Number.isInteger(gb) ? String(gb) : gb.toFixed(1).replace(/\.0$/, "");
  return `${safeGb}GB`;
}

async function deliverData(
  admin: ReturnType<typeof createClient>,
  args: {
    recipient: string;
    network_code: string;
    size_label?: string | null;
    size_mb: number;
  }
): Promise<{ ok: boolean; provider_ref?: string; message?: string }> {
  const { data: dpData } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "data_providers")
    .maybeSingle();

  const config = (dpData?.value as any) ?? {};
  const activeProviderKey = config?.active ?? "mtopup";
  const providerConfig = config?.providers?.[activeProviderKey] ?? {};

  const PROVIDER_BASE_URL = providerConfig.base_url || Deno.env.get("DEVELOPER_API_BASE_URL") || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
  const PROVIDER_API_KEY = providerConfig.api_key || Deno.env.get("DEVELOPER_API_KEY") || "";

  const requestId = crypto.randomUUID();
  let endpoint = "";
  let payload: any = {};

  if (activeProviderKey === "swft") {
    endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/data`;
    const plan = toPlanId(args.size_label, args.size_mb).toLowerCase();
    const net = toProviderNetwork(args.network_code);
    let prefix = "yellow";
    if (net === "TELECEL") prefix = "red";
    if (net === "AT") prefix = "blue";
    
    payload = {
      package_id: `${prefix}_${plan}`,
      phone: normalizePhone(args.recipient),
      request_id: requestId,
    };
  } else {
    endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/airtime`;
    payload = {
      network: toProviderNetwork(args.network_code),
      plan_id: toPlanId(args.size_label, args.size_mb),
      phone: normalizePhone(args.recipient),
      request_id: requestId,
    };
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-API-Key": PROVIDER_API_KEY,
      "Authorization": `Bearer ${PROVIDER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const rawText = await response.text();
  let parsed: any = null;
  try {
    parsed = rawText ? JSON.parse(rawText) : null;
  } catch {
    parsed = null;
  }

  if (response.status !== 200) {
    return {
      ok: false,
      provider_ref: requestId,
      message: parsed?.message || rawText || `Provider failed with HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    provider_ref: parsed?.request_id || parsed?.reference || requestId,
    message: parsed?.message || null,
  };
}

async function fulfillOrder(admin: ReturnType<typeof createClient>, payment: any) {
  const payload = payment.payload ?? {};
  const bundleId = String(payload.bundle_id || "");
  const recipient = String(payload.recipient_phone || "");
  const agentSlug = payload.agent_slug ? String(payload.agent_slug) : null;
  const customerUserId = payment.user_id || null;
  const paymentReference = String(payment.reference || "").trim();

  if (!bundleId || !recipient) throw new Error("Invalid order payment payload");

  if (paymentReference) {
    const { data: existingByPaymentRef } = await admin
      .from("orders")
      .select("id")
      .eq("payment_reference", paymentReference)
      .maybeSingle();
    if (existingByPaymentRef?.id) return existingByPaymentRef.id;
  }

  const { data: bundle, error: bErr } = await admin
    .from("bundles")
    .select("id, base_price, user_price, size_label, size_mb, network_id, networks:networks(code)")
    .eq("id", bundleId)
    .maybeSingle();

  if (bErr || !bundle) throw new Error("Bundle not found");

  let agentId: string | null = null;
  let parentAgentId: string | null = null;
  let grandparentAgentId: string | null = null;
  let sellPrice = Number(payment.amount ?? bundle.user_price ?? bundle.base_price);
  let agentProfit = 0;
  let parentAgentProfit = 0;
  let grandparentAgentProfit = 0;
  let source: "direct" | "agent_store" = "direct";

  if (agentSlug) {
    const { data: agent } = await admin
      .from("agent_profiles")
      .select("id, user_id, activation_paid, parent_agent_id")
      .eq("store_slug", agentSlug)
      .maybeSingle();

    if (agent) {
      agentId = agent.id;
      parentAgentId = agent.parent_agent_id;
      source = "agent_store";
      if (agent.activation_paid) {
        const { data: ap } = await admin
          .from("agent_bundle_prices")
          .select("sell_price")
          .eq("agent_id", agent.id)
          .eq("bundle_id", bundle.id)
          .maybeSingle();
        if (ap) {
          sellPrice = Number(ap.sell_price);
          
          let parentSellPrice = Number(bundle.base_price);
          if (parentAgentId) {
            // Check for custom wholesale override first
            const { data: override } = await admin
              .from("sub_agent_wholesale_overrides")
              .select("wholesale_price")
              .eq("sub_agent_id", agent.id)
              .eq("bundle_id", bundle.id)
              .maybeSingle();

            if (override?.wholesale_price) {
              parentSellPrice = Number(override.wholesale_price);
            } else {
              const { data: parentAp } = await admin
                .from("agent_bundle_prices")
                .select("sell_price")
                .eq("agent_id", parentAgentId)
                .eq("bundle_id", bundle.id)
                .maybeSingle();
              if (parentAp) {
                parentSellPrice = Number(parentAp.sell_price);
              }
            }
            agentProfit = Math.max(0, sellPrice - parentSellPrice);
            parentAgentProfit = Math.max(0, parentSellPrice - Number(bundle.base_price));
          } else {
            agentProfit = Math.max(0, sellPrice - Number(bundle.base_price));
          }

          if (parentAgentId) {
            const { data: parentAgent } = await admin
              .from("agent_profiles")
              .select("id, parent_agent_id")
              .eq("id", parentAgentId)
              .maybeSingle();
            if (parentAgent?.parent_agent_id) {
              grandparentAgentId = parentAgent.parent_agent_id;
            }
          }

          if (grandparentAgentId) {
            const totalProfitPool = Math.max(0, sellPrice - Number(bundle.base_price));
            agentProfit = Number((totalProfitPool * 0.65).toFixed(2));
            parentAgentProfit = Number((totalProfitPool * 0.25).toFixed(2));
            grandparentAgentProfit = Number((totalProfitPool * 0.10).toFixed(2));
          }
        }
      }
    }
  }

  let customerPhone = recipient;
  if (customerUserId) {
    const { data: prof } = await admin.from("profiles").select("phone").eq("id", customerUserId).maybeSingle();
    customerPhone = prof?.phone ?? recipient;
  }

  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      customer_user_id: customerUserId || null,
      customer_phone: customerPhone,
      recipient_phone: recipient,
      network_id: bundle.network_id || null,
      bundle_id: bundle.id || null,
      agent_id: agentId || null,
      parent_agent_id: parentAgentId || null,
      source,
      base_price: bundle.base_price,
      sell_price: sellPrice,
      agent_profit: agentProfit,
      parent_agent_profit: parentAgentProfit,
      status: "processing",
      payment_status: "paid",
      payment_reference: paymentReference || null,
    })
    .select("*")
    .single();

  if (oErr || !order) {
    if ((oErr as any)?.code === "23505" && paymentReference) {
      const { data: existingAfterRace } = await admin
        .from("orders")
        .select("id")
        .eq("payment_reference", paymentReference)
        .maybeSingle();
      if (existingAfterRace?.id) return existingAfterRace.id;
    }
    throw new Error(oErr?.message ?? "Order create failed");
  }

  // Send Processing SMS
  if (customerPhone) {
    const isSelf = customerPhone === recipient;
    let waLink = "https://whatsapp.com/channel/0029VbDOyktLdQelDfBClj3y";
    try {
      const { data: waRow } = await admin
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_group_link")
        .maybeSingle();
      if (waRow?.value) {
        waLink = String(waRow.value).trim();
      }
    } catch (err) {
      console.error("Error fetching whatsapp_group_link:", err);
    }

    const msg = isSelf 
      ? `Your OneGig order for ${bundle.size_label} is processing and may take 10-60 mins to reflect. Join our WhatsApp channel for updates: ${waLink}`
      : `Your OneGig order of ${bundle.size_label} for ${recipient} is processing and may take 10-60 mins to reflect. Join our WhatsApp channel: ${waLink}`;
    
    // Fire and forget
    sendSMS({ to: customerPhone, message: msg }).catch((err) => console.error("SMS Error:", err));
  }

  const networkCode = (bundle.networks as any)?.code ?? "MTN";
  const delivery = await deliverData(admin, {
    recipient,
    network_code: networkCode,
    size_label: bundle.size_label,
    size_mb: bundle.size_mb,
  });

  const finalStatus = delivery.ok ? "delivered" : "failed";
  await admin
    .from("orders")
    .update({ status: finalStatus, notes: delivery.message ?? null })
    .eq("id", order.id);

  if (delivery.ok && agentId && agentProfit > 0) {
    const { data: agentRow } = await admin.from("agent_profiles").select("user_id").eq("id", agentId).maybeSingle();
    if (agentRow?.user_id) {
      await admin.from("wallet_transactions").insert({
        user_id: agentRow.user_id,
        type: "earning",
        amount: agentProfit,
        status: "completed",
        related_order_id: order.id,
        description: `Profit from order ${order.reference}`,
      });
      
      await admin.from("app_notifications").insert({
        title: "New Store Sale!",
        message: `You earned GHS ${agentProfit.toFixed(2)} profit from a sale of ${bundle.size_label} to ${recipient}.`,
        type: "success",
        sound_name: "paystack",
        target_user_id: agentRow.user_id,
        is_global: false
      });
      
      await sendWebPushNotification(admin, agentRow.user_id, {
        title: "New Store Sale!",
        message: `You earned GHS ${agentProfit.toFixed(2)} profit from a sale of ${bundle.size_label} to ${recipient}.`,
        url: "/agent"
      });
    }
  }

  if (delivery.ok && parentAgentId && parentAgentProfit > 0) {
    const { data: parentAgentRow } = await admin.from("agent_profiles").select("user_id").eq("id", parentAgentId).maybeSingle();
    if (parentAgentRow?.user_id) {
      await admin.from("wallet_transactions").insert({
        user_id: parentAgentRow.user_id,
        type: "earning",
        amount: parentAgentProfit,
        status: "completed",
        related_order_id: order.id,
        description: `Network profit from sub-agent order ${order.reference}`,
      });
      
      await admin.from("app_notifications").insert({
        title: "Sub-Agent Sale!",
        message: `You earned GHS ${parentAgentProfit.toFixed(2)} network profit from a sale of ${bundle.size_label}.`,
        type: "success",
        sound_name: "paystack",
        target_user_id: parentAgentRow.user_id,
        is_global: false
      });
      
      await sendWebPushNotification(admin, parentAgentRow.user_id, {
        title: "Sub-Agent Sale!",
        message: `You earned GHS ${parentAgentProfit.toFixed(2)} network profit from a sale of ${bundle.size_label}.`,
        url: "/agent"
      });
    }
  }

  if (delivery.ok && grandparentAgentId && grandparentAgentProfit > 0) {
    const { data: grandparentAgentRow } = await admin.from("agent_profiles").select("user_id").eq("id", grandparentAgentId).maybeSingle();
    if (grandparentAgentRow?.user_id) {
      await admin.from("wallet_transactions").insert({
        user_id: grandparentAgentRow.user_id,
        type: "earning",
        amount: grandparentAgentProfit,
        status: "completed",
        related_order_id: order.id,
        description: `Grandparent Recruiter profit from downline order ${order.reference}`,
      });
      
      await admin.from("app_notifications").insert({
        title: "Downline Recruiter Earning!",
        message: `You earned GHS ${grandparentAgentProfit.toFixed(2)} grandparent recruiter profit from a downline purchase.`,
        type: "success",
        sound_name: "paystack",
        target_user_id: grandparentAgentRow.user_id,
        is_global: false
      });
      
      await sendWebPushNotification(admin, grandparentAgentRow.user_id, {
        title: "Downline Recruiter Earning!",
        message: `You earned GHS ${grandparentAgentProfit.toFixed(2)} grandparent recruiter profit from a downline purchase.`,
        url: "/agent"
      });
    }
  }

  if (delivery.ok && customerUserId) {
    await admin.from("app_notifications").insert({
      title: "Purchase Successful",
      message: `${bundle.size_label} has been successfully delivered to ${recipient}.`,
      type: "success",
      sound_name: "paystack",
      target_user_id: customerUserId,
      is_global: false
    });
  }

  return order.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Unauthorized" }, 200);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud, error: udErr } = await userClient.auth.getUser();
    if (udErr || !ud.user?.id) return json({ ok: false, error: "Unauthorized" }, 200);
    
    const userId = ud.user.id;
    const body = await req.json();
    
    const { bundle_id, recipient_phone, agent_slug } = body;
    if (!bundle_id || !recipient_phone) return json({ ok: false, error: "Missing required fields" }, 200);

    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Check wallet balance
    const { data: balanceData, error: balanceErr } = await admin.rpc("get_wallet_balance", { _user_id: userId });
    if (balanceErr) return json({ ok: false, error: "Could not read wallet balance: " + balanceErr.message }, 200);
    const balance = Number(balanceData || 0);

    // 2. Fetch bundle price
    const { data: bundle } = await admin.from("bundles").select("base_price, user_price").eq("id", bundle_id).maybeSingle();
    if (!bundle) return json({ ok: false, error: "Bundle not found" }, 200);

    let sellPrice = Number(bundle.user_price ?? bundle.base_price);
    
    if (agent_slug) {
      const { data: agent } = await admin.from("agent_profiles").select("id, user_id").eq("store_slug", agent_slug).maybeSingle();
      if (agent?.id) {
        const { data: ap } = await admin.from("agent_bundle_prices").select("sell_price").eq("agent_id", agent.id).eq("bundle_id", bundle_id).maybeSingle();
        if (ap) sellPrice = Number(ap.sell_price);
      }
    }

    if (balance < sellPrice) {
      return json({ ok: false, error: "Insufficient wallet balance (Balance: GHS " + balance + ", Required: GHS " + sellPrice + ")", required: sellPrice, balance }, 200);
    }

    // 3. Deduct from wallet
    const reference = `WP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    const { data: tx, error: txErr } = await admin.from("wallet_transactions").insert({
      user_id: userId,
      type: "purchase",
      amount: sellPrice,
      status: "completed",
      description: `Wallet Purchase: Bundle for ${recipient_phone} (${reference})`,
    }).select("id").single();
    
    if (txErr || !tx) return json({ ok: false, error: "Failed to deduct wallet balance: " + (txErr?.message || "No tx returned") }, 200);

    // 4. Create dummy payment record for fulfillOrder
    const { data: payment, error: paymentError } = await admin.from("payments").insert({
      reference,
      user_id: userId,
      purpose: "order",
      amount: sellPrice,
      currency: "GHS",
      status: "paid",
      payload: {
        bundle_id,
        recipient_phone,
        agent_slug,
        source: agent_slug ? "agent_store" : "direct"
      }
    }).select("id, purpose, reference, amount, currency, status, user_id, created_at, payload").single();

    if (paymentError) console.error("Payment insert error:", paymentError);
    if (!payment) return json({ ok: false, error: "Failed to create payment record: " + (paymentError?.message || "Unknown error") }, 200);

    // 5. Fulfill order
    const orderId = await fulfillOrder(admin, payment);
    if (!orderId) {
      // Refund if fulfill failed (wallet payment only)
      await admin.from("wallet_transactions").insert({
        user_id: userId,
        type: "refund",
        amount: sellPrice,
        status: "completed",
        description: `Refund for Failed Purchase (${reference})`,
      });
      return json({ ok: false, error: "Order fulfillment failed" }, 200);
    }
    
    await admin.from("payments").update({ order_id: orderId }).eq("id", payment.id);

    return json({ ok: true, order_id: orderId, reference, message: "Purchase successful!" });
  } catch (err: any) {
    console.error("wallet-pay error:", err);
    return json({ ok: false, error: err.message || "Internal Server Error" }, 200);
  }
});
