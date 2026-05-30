import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
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

const getPaystackSecret = () =>
  Deno.env.get("PAYSTACK_SECRET_KEY") ||
  Deno.env.get("PAYSTACK_SECRET") ||
  Deno.env.get("PAYSTACK_LIVE_SECRET_KEY") ||
  "";

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
  if (sizeLabel && /gb/i.test(sizeLabel)) return String(sizeLabel).replace(/\s+/g, "").toUpperCase();
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

async function activateAgent(admin: ReturnType<typeof createClient>, userId: string, refSlug?: string | null) {
  console.log(`Activating agent with userId: ${userId}`);

  // 1. Check if they already have an agent profile record
  const { data: existingAgent, error: checkErr } = await admin
    .from("agent_profiles")
    .select("id, activation_paid, store_slug, store_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (checkErr) {
    console.error("Error checking existing agent profile:", checkErr);
  }

  let finalAgentId = existingAgent?.id || null;

  if (existingAgent) {
    console.log(`User already has an agent profile (id: ${existingAgent.id}, paid: ${existingAgent.activation_paid})`);
    
    if (existingAgent.activation_paid) {
      // Already activated! Ensure they have the role and return.
      console.log("Agent profile already marked as active. Ensuring role...");
      await admin.from("user_roles").upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
      return existingAgent.id;
    }

    let parentAgentId = null;
    if (refSlug) {
      const { data: parentAgent } = await admin
        .from("agent_profiles")
        .select("id")
        .eq("store_slug", refSlug)
        .maybeSingle();
      if (parentAgent?.id) {
        parentAgentId = parentAgent.id;
      }
    }

    // Update existing inactive profile to active
    console.log(`Updating existing agent profile to paid... Parent: ${parentAgentId}`);
    const { data: updatedAgent, error: updateErr } = await admin
      .from("agent_profiles")
      .update({
        activation_paid: true,
        activation_paid_at: new Date().toISOString(),
        parent_agent_id: parentAgentId,
      })
      .eq("id", existingAgent.id)
      .select("id")
      .single();

    if (updateErr) {
      console.error("Error updating existing agent profile:", updateErr);
      throw updateErr;
    }
    finalAgentId = updatedAgent?.id;
  } else {
    // Create a new agent profile
    console.log("No existing agent profile found. Creating a new one...");
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, username")
      .eq("id", userId)
      .maybeSingle();

    const slugify = (s: string) =>
      s
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .slice(0, 40) || "store";

    const baseSlug = slugify(profile?.username || profile?.full_name || `agent-${userId.slice(0, 6)}`);
    let slug = baseSlug;
    let n = 0;
    while (true) {
      const { data: exists } = await admin.from("agent_profiles").select("id").eq("store_slug", slug).maybeSingle();
      if (!exists) break;
      n++;
      slug = `${baseSlug}-${n}`;
      if (n > 50) break;
    }

    let parentAgentId = null;
    if (refSlug) {
      const { data: parentAgent } = await admin
        .from("agent_profiles")
        .select("id")
        .eq("store_slug", refSlug)
        .maybeSingle();
      if (parentAgent?.id) {
        parentAgentId = parentAgent.id;
      }
    }

    console.log(`Inserting new agent profile with slug: ${slug}, parent: ${parentAgentId}`);
    const { data: newAgent, error: insertErr } = await admin
      .from("agent_profiles")
      .insert({
        user_id: userId,
        store_slug: slug,
        store_name: `${profile?.full_name || "My"} Store`,
        activation_paid: true,
        activation_paid_at: new Date().toISOString(),
        parent_agent_id: parentAgentId,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Error inserting new agent profile:", insertErr);
      throw insertErr;
    }
    finalAgentId = newAgent?.id;
  }

  // 2. Ensure they have the agent user role
  console.log("Upserting agent role in user_roles...");
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
  if (roleErr) {
    console.error("Error upserting user role:", roleErr);
    throw roleErr;
  }

  // 3. Seed default agent bundle prices (base + 1 cedi markup, or parent's sell price + 1)
  console.log("Seeding default agent bundle prices...");
  const { data: bundles } = await admin.from("bundles").select("id, base_price").eq("active", true);
  if (bundles?.length && finalAgentId) {
    const rows = await Promise.all(bundles.map(async (b: any) => {
      let baseCost = Number(b.base_price);
      if (parentAgentId) {
        const { data: parentAp } = await admin
          .from("agent_bundle_prices")
          .select("sell_price")
          .eq("agent_id", parentAgentId)
          .eq("bundle_id", b.id)
          .maybeSingle();
        if (parentAp) baseCost = Number(parentAp.sell_price);
      }
      return {
        agent_id: finalAgentId,
        bundle_id: b.id,
        sell_price: baseCost + 1,
        active: true,
      };
    }));
    
    const { error: priceErr } = await admin
      .from("agent_bundle_prices")
      .upsert(rows, { onConflict: "agent_id,bundle_id" });
    if (priceErr) {
      console.error("Error seeding bundle prices:", priceErr);
    } else {
      console.log("Successfully seeded bundle prices!");
    }
  }

  console.log("Activation completed successfully!");
  return finalAgentId;
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
  let sellPrice = Number(payload.base_amount ?? payment.amount ?? bundle.user_price ?? bundle.base_price);
  let agentProfit = 0;
  let parentAgentProfit = 0;
  let source: "direct" | "agent_store" = "direct";

  if (agentSlug) {
    const { data: agent } = await admin
      .from("agent_profiles")
      .select("id, user_id, activation_paid, parent_agent_id")
      .eq("store_slug", agentSlug)
      .maybeSingle();

    if (agent?.activation_paid) {
      agentId = agent.id;
      parentAgentId = agent.parent_agent_id;
      source = "agent_store";
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
          const { data: parentAp } = await admin
            .from("agent_bundle_prices")
            .select("sell_price")
            .eq("agent_id", parentAgentId)
            .eq("bundle_id", bundle.id)
            .maybeSingle();
          if (parentAp) {
            parentSellPrice = Number(parentAp.sell_price);
          }
          agentProfit = Math.max(0, sellPrice - parentSellPrice);
          parentAgentProfit = Math.max(0, parentSellPrice - Number(bundle.base_price));
        } else {
          agentProfit = Math.max(0, sellPrice - Number(bundle.base_price));
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

  if (delivery.ok) {
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

    if (customerUserId) {
      await admin.from("app_notifications").insert({
        title: "Purchase Successful",
        message: `${bundle.size_label} has been successfully delivered to ${recipient}.`,
        type: "success",
        sound_name: "paystack",
        target_user_id: customerUserId,
        is_global: false
      });
    }
  }

  return order.id;
}

async function verifyAndProcess(reference: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const paystackSecret = getPaystackSecret();
  if (!paystackSecret) throw new Error("Missing Paystack secret");

  const admin = createClient(supabaseUrl, serviceKey);

  const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${paystackSecret}` },
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok || !verifyData?.status) {
    throw new Error(verifyData?.message ?? "Unable to verify payment");
  }

  const trx = verifyData.data;

  let metadata = trx?.metadata ?? {};
  if (typeof metadata === "string") {
    try {
      metadata = JSON.parse(metadata);
    } catch (e) {
      metadata = {};
    }
  }

  const purpose = 
    metadata?.purpose === "agent_activation" ? "agent_activation" :
    metadata?.purpose === "wallet_deposit" ? "wallet_deposit" :
    "order";

  const fallbackPayload = purpose === "order"
    ? {
        bundle_id: metadata?.bundle_id || null,
        recipient_phone: metadata?.recipient_phone || null,
        agent_slug: metadata?.agent_slug || null,
        source: metadata?.source || "direct",
      }
    : { user_id: metadata?.user_id || null };

  const { data: paymentRow, error: paymentReadErr } = await admin
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  const paymentsTableAvailable = !paymentReadErr || !/payments/i.test(paymentReadErr.message ?? "");

  // If payments table is unavailable (migration not yet applied), continue with stateless verification
  // so checkout and fulfillment still work.
  if (!paymentsTableAvailable) {
    if (["pay_offline", "pending", "send_otp", "ongoing"].includes(trx?.status)) {
      return { ok: false, status: "pending", reason: "Payment is pending authorization" };
    }
    if (trx?.status !== "success") {
      return { ok: false, status: trx?.status ?? "failed" };
    }

    let orderId: string | null = null;

    if (purpose === "order") {
      orderId = await fulfillOrder(admin, {
        reference,
        user_id: metadata?.user_id || null,
        payload: fallbackPayload,
      });
    }

    if (purpose === "agent_activation") {
      const userId = metadata?.user_id;
      if (!userId) throw new Error("Missing user for activation payment");
      await activateAgent(admin, String(userId), metadata?.ref_slug || null);
    }

    if (purpose === "wallet_deposit") {
      const userId = metadata?.user_id;
      if (!userId) throw new Error("Missing user for deposit");
      
      const paidAmount = Number(trx?.amount ?? 0) / 100;
      const depositAmount = Number(metadata?.deposit_amount ?? (paidAmount / 1.03).toFixed(2));
      
      const { error: wErr } = await admin.from("wallet_transactions").insert({
        user_id: userId,
        type: "adjustment",
        amount: depositAmount,
        status: "completed",
        description: `Wallet Deposit via Paystack (${reference})`,
      });
      if (wErr) throw new Error("Wallet insert failed: " + wErr.message);
    }

    return { ok: true, purpose, order_id: orderId, payments_logged: false };
  }

  let payment = paymentRow;

  if (!payment) {
    const payload = fallbackPayload;

    const amountFromPaystack = Number(trx?.amount ?? 0) / 100;
    const { data: inserted } = await admin
      .from("payments")
      .insert({
        reference,
        user_id: metadata?.user_id || null,
        purpose,
        amount: amountFromPaystack,
        currency: String(trx?.currency || "GHS"),
        status: "initialized",
        payload,
      })
      .select("*")
      .maybeSingle();
    payment = inserted ?? null;
  }

  if (!payment) throw new Error("Payment record unavailable");

  if (payment.status === "paid") {
    return { ok: true, already_processed: true, purpose: payment.purpose, order_id: payment.order_id ?? null };
  }

  if (["pay_offline", "pending", "send_otp", "ongoing"].includes(trx?.status)) {
    return { ok: false, status: "pending", reason: "Payment is pending authorization" };
  }

  if (trx?.status !== "success") {
    await admin.from("payments").update({ status: "failed" }).eq("id", payment.id);
    return { ok: false, status: trx?.status ?? "failed" };
  }

  const paidAmount = Number(trx.amount ?? 0) / 100;
  if (Math.round(paidAmount * 100) < Math.round(Number(payment.amount) * 100)) {
    throw new Error("Paid amount is less than expected");
  }

  let orderId: string | null = null;

  if (payment.purpose === "order") {
    orderId = await fulfillOrder(admin, payment);
  }

  if (payment.purpose === "agent_activation") {
    const userId = payment.user_id;
    if (!userId) throw new Error("Missing user for activation payment");
    let payloadData = payment.payload;
    if (typeof payloadData === "string") {
      try { payloadData = JSON.parse(payloadData); } catch(e) { payloadData = {}; }
    }
    await activateAgent(admin, userId, (payloadData as any)?.ref_slug || metadata?.ref_slug || null);
  }

  if (payment.purpose === "wallet_deposit") {
    const userId = payment.user_id;
    if (!userId) throw new Error("Missing user for deposit");
    
    let payloadData = payment.payload;
    if (typeof payloadData === "string") {
      try { payloadData = JSON.parse(payloadData); } catch(e) { payloadData = {}; }
    }
    
    const depositAmount = Number(payloadData?.deposit_amount ?? metadata?.deposit_amount ?? (paidAmount / 1.03).toFixed(2));

    const { error: wErr } = await admin.from("wallet_transactions").insert({
      user_id: userId,
      type: "adjustment",
      amount: depositAmount,
      status: "completed",
      description: `Wallet Deposit via Paystack (${reference})`,
    });
    if (wErr) throw new Error("Wallet insert failed: " + wErr.message);
  }

  await admin
    .from("payments")
    .update({ status: "paid", order_id: orderId })
    .eq("id", payment.id);

  return { ok: true, purpose: payment.purpose, order_id: orderId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    const reference = String(body?.reference ?? "").trim();
    const checkOnly = !!body?.check_only;
    
    if (!reference) return json({ error: "reference is required" }, 400);

    if (checkOnly) {
      const paystackSecret = getPaystackSecret();
      const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: { Authorization: `Bearer ${paystackSecret}` },
      });
      const verifyData = await verifyRes.json();
      return json({ ok: true, status: verifyData?.data?.status ?? "failed" });
    }

    const result = await verifyAndProcess(reference);
    return json(result);
  } catch (e: any) {
    console.error("paystack-verify error", e);
    return json({ ok: false, status: "pending", error: e?.message ?? "Internal error" }, 200);
  }
});
