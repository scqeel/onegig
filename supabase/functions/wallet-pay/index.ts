import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";
import { sendWebPushNotification } from "../_shared/push.ts";

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

function toSwiftDataNetwork(networkCode: string, sizeLabel: string | null | undefined): string {
  const net = String(networkCode || "").toUpperCase();
  if (net === "MTN") return "yello";
  if (net === "TELECEL" || net === "VODAFONE") return "telecel";
  if (net === "AT" || net === "AIRTELTIGO") {
    const label = String(sizeLabel || "").toLowerCase();
    if (label.includes("non-expiry") || label.includes("ishare") || label.includes("non expiry")) {
      return "at_ishare";
    }
    return "at_bigtime";
  }
  return "yello";
}

function toSizeGb(sizeLabel: string | null | undefined, sizeMb: number): number {
  if (sizeLabel) {
    const match = String(sizeLabel).match(/(\d+(?:\.\d+)?)\s*(gb)/i);
    if (match) {
      return Number(match[1]);
    }
    const matchMb = String(sizeLabel).match(/(\d+(?:\.\d+)?)\s*(mb)/i);
    if (matchMb) {
      return Number(matchMb[1]) / 1024;
    }
  }
  return Number(sizeMb) / 1024;
}

async function deliverData(
  admin: ReturnType<typeof createClient>,
  args: {
    recipient: string;
    network_code?: string;
    size_label?: string | null;
    size_mb?: number;
    amount?: number;
    bill_type?: string;
    sender_name?: string;
    type?: "data" | "airtime" | "bill";
    force_provider?: string;
    request_id?: string;
    customer_phone?: string;
  }
): Promise<{ ok: boolean; provider_ref?: string; status?: string; message?: string }> {
  const { data: dpData } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "data_providers")
    .maybeSingle();

  const config = (dpData?.value as any) ?? {};
  const activeProviderKey = args.force_provider || config?.active || "mtopup";
  
  // Fallback airtime/bills from "swiftdata" (Reseller REST API) to "swft" (Developer API)
  let effectiveProviderKey = activeProviderKey;
  if (activeProviderKey === "swiftdata" && (args.type === "airtime" || args.type === "bill")) {
    effectiveProviderKey = "swft";
  }

  const providerConfig = config?.providers?.[effectiveProviderKey] ?? {};

  const PROVIDER_BASE_URL = providerConfig.base_url || Deno.env.get("DEVELOPER_API_BASE_URL") || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
  const PROVIDER_API_KEY = providerConfig.api_key || Deno.env.get("DEVELOPER_API_KEY") || "";

  const requestId = args.request_id || crypto.randomUUID();
  let endpoint = "";
  let payload: any = {};

  if (effectiveProviderKey === "swiftdata") {
    // New Reseller REST API (Data purchases only)
    endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/v1/buy-data`;
    const net = toSwiftDataNetwork(args.network_code || "MTN", args.size_label);
    const sizeGb = toSizeGb(args.size_label, args.size_mb || 0);
    payload = {
      phone: normalizePhone(args.recipient),
      size_gb: sizeGb,
      network: net,
      reference: requestId
    };
  } else if (effectiveProviderKey === "swft") {
    if (args.type === "airtime") {
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/airtime`;
      payload = {
        network: toProviderNetwork(args.network_code || "MTN"),
        phone: normalizePhone(args.recipient),
        amount: Number(args.amount),
        request_id: requestId,
        allow_duplicate: true
      };
    } else if (args.type === "bill") {
      if (args.bill_type === "ECG") {
        endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/ecg`;
        payload = {
          phoneNumber: normalizePhone(args.customer_phone || args.recipient),
          accountNumber: args.recipient,
          amount: Number(args.amount)
        };
      } else {
        endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/bills/pay`;
        payload = {
          customerNumber: args.recipient,
          billType: args.bill_type,
          amount: Number(args.amount),
          senderName: args.sender_name || "CUSTOMER"
        };
      }
    } else {
      // Default: Data bundle
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/data`;
      const plan = toPlanId(args.size_label, args.size_mb || 0).toLowerCase();
      const net = toProviderNetwork(args.network_code || "MTN");
      let prefix = "yellow";
      if (net === "TELECEL") prefix = "red";
      if (net === "AT") prefix = "blue";
      
      payload = {
        package_id: `${prefix}_${plan}`,
        phone: normalizePhone(args.recipient),
        request_id: requestId,
        allow_duplicate: true
      };
    }
  } else {
    // MTopUp / fallback provider
    if (args.type === "airtime") {
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/airtime`;
      payload = {
        network: toProviderNetwork(args.network_code || "MTN"),
        amount: Number(args.amount),
        phone: normalizePhone(args.recipient),
        request_id: requestId
      };
    } else {
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/airtime`;
      payload = {
        network: toProviderNetwork(args.network_code || "MTN"),
        plan_id: toPlanId(args.size_label, args.size_mb || 0),
        phone: normalizePhone(args.recipient),
        request_id: requestId
      };
    }
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "X-API-Key": PROVIDER_API_KEY,
      "Authorization": `Bearer ${PROVIDER_API_KEY}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": requestId
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

  if (response.status !== 200 || (parsed && parsed.success === false)) {
    return {
      ok: false,
      provider_ref: requestId,
      message: parsed?.error || parsed?.message || rawText || `Provider failed with HTTP ${response.status}`,
    };
  }

  return {
    ok: true,
    status: parsed?.status || "delivered",
    provider_ref: parsed?.order_id || parsed?.transaction_id || parsed?.reference || requestId,
    message: parsed?.message || null,
  };
}

async function fulfillOrder(admin: ReturnType<typeof createClient>, payment: any) {
  let payload = payment.payload ?? {};
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      payload = {};
    }
  }

  const type = payload.type || "data";
  const recipient = String(payload.recipient_phone || "");
  const agentSlug = payload.agent_slug ? String(payload.agent_slug) : null;
  const customerUserId = payment.user_id || null;
  const paymentReference = String(payment.reference || "").trim();

  const bundleId = payload.bundle_id ? String(payload.bundle_id) : null;
  if (type === "data" && !bundleId) throw new Error("Invalid order payment payload: Missing bundle_id");
  if (!recipient) throw new Error("Invalid order payment payload: Missing recipient");

  if (paymentReference) {
    const { data: existingByPaymentRef } = await admin
      .from("orders")
      .select("id")
      .eq("payment_reference", paymentReference)
      .maybeSingle();
    if (existingByPaymentRef?.id) return { id: existingByPaymentRef.id, ok: true, status: "delivered" };
  }

  let bundle: any = null;
  if (type === "data" && bundleId) {
    const { data: bData, error: bErr } = await admin
      .from("bundles")
      .select("id, base_price, user_price, size_label, size_mb, network_id, networks:networks(code)")
      .eq("id", bundleId)
      .maybeSingle();
    if (bErr || !bData) throw new Error("Bundle not found");
    bundle = bData;
  }

  let agentId: string | null = null;
  let parentAgentId: string | null = null;
  let grandparentAgentId: string | null = null;
  
  let sellPrice = Number(payment.amount);
  let basePrice = bundle ? Number(bundle.base_price) : sellPrice;

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

      // Profit pool calculation only for data bundles
      if (agent.activation_paid && type === "data" && bundle) {
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

  // Determine network ID for airtime
  let networkId: string | null = bundle ? bundle.network_id : null;
  if (type === "airtime") {
    const { data: netRow } = await admin
      .from("networks")
      .select("id")
      .eq("code", toProviderNetwork(payload.network_code || "MTN"))
      .maybeSingle();
    networkId = netRow?.id || null;
  }

  const { data: order, error: oErr } = await admin
    .from("orders")
    .insert({
      customer_user_id: customerUserId || null,
      customer_phone: customerPhone,
      recipient_phone: recipient,
      network_id: networkId,
      bundle_id: bundle ? bundle.id : null,
      agent_id: agentId || null,
      parent_agent_id: parentAgentId || null,
      source,
      base_price: basePrice,
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
      if (existingAfterRace?.id) return { id: existingAfterRace.id, ok: true, status: "delivered" };
    }
    throw new Error(oErr?.message ?? "Order create failed");
  }

  // Send Processing SMS
  if (customerPhone && type !== "airtime") {
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

    let detailText = bundle ? bundle.size_label : (type === "airtime" ? `GHS ${sellPrice} Airtime` : `${payload.bill_type} Bill Payment`);
    const msg = isSelf 
      ? `Your OneGig order for ${detailText} is processing and may take 10-60 mins to reflect. Join our WhatsApp channel for updates: ${waLink}`
      : `Your OneGig order of ${detailText} for ${recipient} is processing and may take 10-60 mins to reflect. Join our WhatsApp channel: ${waLink}`;
    
    sendSMS({ to: customerPhone, message: msg }).catch((err) => console.error("SMS Error:", err));
  }

  // Fulfill via SwiftData
  let delivery;
  if (type === "airtime") {
    delivery = await deliverData(admin, {
      recipient,
      network_code: payload.network_code || "MTN",
      amount: sellPrice,
      type: "airtime",
      request_id: order.id
    });
  } else if (type === "bill") {
    delivery = await deliverData(admin, {
      recipient,
      bill_type: payload.bill_type,
      amount: sellPrice,
      sender_name: payload.sender_name,
      type: "bill",
      request_id: order.id,
      customer_phone: payload.customer_phone,
    });
  } else {
    const networkCode = (bundle.networks as any)?.code ?? "MTN";
    delivery = await deliverData(admin, {
      recipient,
      network_code: networkCode,
      size_label: bundle.size_label,
      size_mb: bundle.size_mb,
      type: "data",
      request_id: order.id
    });
  }

  const finalStatus = delivery.ok 
    ? (delivery.status === "fulfilled" || delivery.status === "delivered" ? "delivered" : "processing")
    : "failed";

  await admin
    .from("orders")
    .update({ 
      status: finalStatus, 
      notes: delivery.message || (delivery.provider_ref ? `Provider Ref: ${delivery.provider_ref}` : null) 
    })
    .eq("id", order.id);

  if (delivery.ok && finalStatus === "delivered") {
    if (agentId && agentProfit > 0) {
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
          message: `You earned GHS ${agentProfit.toFixed(2)} profit from a sale of ${bundle?.size_label || "bundle"} to ${recipient}.`,
          type: "success",
          sound_name: "paystack",
          target_user_id: agentRow.user_id,
          is_global: false
        });
        
        await sendWebPushNotification(admin, agentRow.user_id, {
          title: "New Store Sale!",
          message: `You earned GHS ${agentProfit.toFixed(2)} profit from a sale of ${bundle?.size_label || "bundle"} to ${recipient}.`,
          url: "/agent"
        });
      }
    }

    if (parentAgentId && parentAgentProfit > 0) {
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
          message: `You earned GHS ${parentAgentProfit.toFixed(2)} network profit from a sale of ${bundle?.size_label || "bundle"}.`,
          type: "success",
          sound_name: "paystack",
          target_user_id: parentAgentRow.user_id,
          is_global: false
        });
        
        await sendWebPushNotification(admin, parentAgentRow.user_id, {
          title: "Sub-Agent Sale!",
          message: `You earned GHS ${parentAgentProfit.toFixed(2)} network profit from a sale of ${bundle?.size_label || "bundle"}.`,
          url: "/agent"
        });
      }
    }

    if (grandparentAgentId && grandparentAgentProfit > 0) {
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
  }

  if (delivery.ok && finalStatus === "delivered" && customerPhone) {
    let detailText = bundle ? bundle.size_label : (type === "airtime" ? `GHS ${sellPrice} Airtime` : `${payload.bill_type} Bill Payment`);
    sendSMS({
      to: customerPhone,
      message: `Your OneGig purchase of ${detailText} for ${recipient} was successfully delivered! Thank you for choosing OneGig.`,
    }).catch((err) => console.error("Success SMS Error:", err));
  }

  if (delivery.ok && customerUserId) {
    let successMsg = bundle 
      ? `${bundle.size_label} has been successfully delivered to ${recipient}.`
      : (type === "airtime" ? `GHS ${sellPrice} Airtime has been delivered to ${recipient}.` : `Bill Payment of GHS ${sellPrice} to ${recipient} was successful.`);
    
    await admin.from("app_notifications").insert({
      title: "Purchase Successful",
      message: successMsg,
      type: "success",
      sound_name: "paystack",
      target_user_id: customerUserId,
      is_global: false
    });
  }

  return { id: order.id, ok: delivery.ok, status: finalStatus, message: delivery.message };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, error: "Unauthorized" }, 401);
    
    let userId: string | null = null;
    try {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: ud, error: udErr } = await userClient.auth.getUser();
      if (!udErr && ud.user) {
        userId = ud.user.id;
      }
    } catch (err) {
      console.warn("Failed to verify JWT payload via GoTrue", err);
    }

    if (!userId) return json({ ok: false, error: "Unauthorized" }, 401);
    const body = await req.json();
    
    const type = body.type || "data";
    const recipient_phone = body.recipient_phone;
    const agent_slug = body.agent_slug;
    
    if (!recipient_phone) return json({ ok: false, error: "Missing recipient phone/number" }, 200);

    let sellPrice = 0;
    let bundle_id = null;

    if (type === "data") {
      bundle_id = body.bundle_id;
      if (!bundle_id) return json({ ok: false, error: "Missing required bundle_id" }, 200);
      
      const { data: bundle } = await admin.from("bundles").select("base_price, user_price").eq("id", bundle_id).maybeSingle();
      if (!bundle) return json({ ok: false, error: "Bundle not found" }, 200);

      sellPrice = Number(bundle.user_price ?? bundle.base_price);
      
      if (agent_slug) {
        const { data: agent } = await admin.from("agent_profiles").select("id, user_id").eq("store_slug", agent_slug).maybeSingle();
        if (agent?.id) {
          const { data: ap } = await admin.from("agent_bundle_prices").select("sell_price").eq("agent_id", agent.id).eq("bundle_id", bundle_id).maybeSingle();
          if (ap) sellPrice = Number(ap.sell_price);
        }
      }
    } else {
      // airtime or bill
      const amount = Number(body.amount);
      if (!amount || amount <= 0) return json({ ok: false, error: "Amount must be greater than 0" }, 200);
      sellPrice = amount;
    }

    // 1. Check wallet balance
    const { data: balanceData, error: balanceErr } = await admin.rpc("get_wallet_balance", { _user_id: userId });
    if (balanceErr) return json({ ok: false, error: "Could not read wallet balance: " + balanceErr.message }, 200);
    const balance = Number(balanceData || 0);

    if (balance < sellPrice) {
      return json({ ok: false, error: "Insufficient wallet balance (Balance: GHS " + balance.toFixed(2) + ", Required: GHS " + sellPrice.toFixed(2) + ")", required: sellPrice, balance }, 200);
    }

    // 2. Deduct from wallet
    const reference = `WP-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    let description = "";
    if (type === "data") {
      description = `Wallet Purchase: Bundle for ${recipient_phone} (${reference})`;
    } else if (type === "airtime") {
      description = `Wallet Purchase: GHS ${sellPrice} Airtime for ${recipient_phone} (${reference})`;
    } else {
      description = `Wallet Purchase: ${body.bill_type} payment of GHS ${sellPrice} for ${recipient_phone} (${reference})`;
    }

    const { data: tx, error: txErr } = await admin.from("wallet_transactions").insert({
      user_id: userId,
      type: "purchase",
      amount: sellPrice,
      status: "completed",
      description: description,
    }).select("id").single();
    
    if (txErr || !tx) return json({ ok: false, error: "Failed to deduct wallet balance: " + (txErr?.message || "No tx returned") }, 200);

    // 3. Create dummy payment record for fulfillOrder
    const { data: payment, error: paymentError } = await admin.from("payments").insert({
      reference,
      user_id: userId,
      purpose: "order",
      amount: sellPrice,
      currency: "GHS",
      status: "paid",
      payload: {
        type,
        bundle_id,
        recipient_phone,
        agent_slug,
        amount: sellPrice,
        network_code: body.network_code,
        bill_type: body.bill_type,
        sender_name: body.sender_name,
        customer_phone: body.customer_phone,
        source: agent_slug ? "agent_store" : "direct"
      }
    }).select("id, purpose, reference, amount, currency, status, user_id, created_at, payload").single();

    if (paymentError) console.error("Payment insert error:", paymentError);
    if (!payment) return json({ ok: false, error: "Failed to create payment record: " + (paymentError?.message || "Unknown error") }, 200);

    // 4. Fulfill order
    const fulfillment = await fulfillOrder(admin, payment);
    if (!fulfillment || !fulfillment.ok || fulfillment.status === "failed") {
      // Refund if fulfill failed (wallet payment only)
      await admin.from("wallet_transactions").insert({
        user_id: userId,
        type: "refund",
        amount: sellPrice,
        status: "completed",
        description: `Refund for Failed Purchase (${reference})`,
      });
      return json({ ok: false, error: fulfillment.message || "Order fulfillment failed" }, 200);
    }
    
    await admin.from("payments").update({ order_id: fulfillment.id }).eq("id", payment.id);

    return json({ ok: true, order_id: fulfillment.id, reference, message: "Purchase successful!" });
  } catch (err: any) {
    console.error("wallet-pay error:", err);
    return json({ ok: false, error: err.message || "Internal Server Error" }, 200);
  }
});
