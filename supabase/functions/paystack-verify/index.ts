import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaystackSecretKey } from "../_shared/settings.ts";
import { sendWebPushNotification } from "../_shared/push.ts";
import { sendSMS } from "../_shared/sms.ts";

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

// Removed local getPaystackSecret

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

async function activateAgent(admin: ReturnType<typeof createClient>, userId: string, refSlug?: string | null) {
  console.log(`Activating agent with userId: ${userId}`);

  // Resolve parent agent ID (using refSlug if present, falling back to referred_by in profiles)
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
  
  if (!parentAgentId) {
    const { data: prof } = await admin
      .from("profiles")
      .select("referred_by")
      .eq("id", userId)
      .maybeSingle();
      
    if (prof?.referred_by) {
      const { data: parentAgent } = await admin
        .from("agent_profiles")
        .select("id")
        .eq("user_id", prof.referred_by)
        .maybeSingle();
      if (parentAgent?.id) {
        parentAgentId = parentAgent.id;
      }
    }
  }

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
  let payload = payment.payload ?? {};
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch (_) {
      payload = {};
    }
  }
  const bundleId = String(payload.bundle_id || "");
  const recipient = String(payload.recipient_phone || "");
  const agentSlug = payload.agent_slug ? String(payload.agent_slug) : null;
  const customerUserId = payment.user_id || null;
  const paymentReference = String(payment.reference || "").trim();

  const orderType = payload.type || "data";

  if (!recipient) throw new Error("Recipient phone is required");
  if (orderType === "data" && !bundleId) throw new Error("Invalid order payment payload: Missing bundle ID");

  if (paymentReference) {
    const { data: existingByPaymentRef } = await admin
      .from("orders")
      .select("id")
      .eq("payment_reference", paymentReference)
      .maybeSingle();
    if (existingByPaymentRef?.id) return existingByPaymentRef.id;
  }

  let bundle: any = null;
  if (orderType === "data") {
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
  let sellPrice = Number(payload.base_amount ?? payment.amount);
  let basePrice = sellPrice;
  let agentProfit = 0;
  let parentAgentProfit = 0;
  let grandparentAgentProfit = 0;
  let source: "direct" | "agent_store" = "direct";

  if (orderType === "data" && bundle) {
    sellPrice = Number(payload.base_amount ?? payment.amount ?? bundle.user_price ?? bundle.base_price);
    basePrice = Number(bundle.base_price);

    // Coupon settlement resolution
    const couponCode = payload.coupon_code || null;
    const couponDiscount = Number(payload.coupon_discount || 0);
    let isGlobalCoupon = true;

    if (couponCode) {
      // 1. Fetch coupon details to verify store-specific vs global
      const { data: couponToIncrement } = await admin
        .from("coupons")
        .select("id, current_uses, agent_id")
        .eq("code", couponCode)
        .maybeSingle();

      if (couponToIncrement) {
        // 2. Increment coupon uses in database
        await admin
          .from("coupons")
          .update({ current_uses: (couponToIncrement.current_uses || 0) + 1 })
          .eq("id", couponToIncrement.id);
        
        if (couponToIncrement.agent_id) {
          isGlobalCoupon = false;
        }
      }
    }

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

            // Apply Coupon discounts to agent profits and sell prices
            if (couponDiscount > 0) {
              if (!isGlobalCoupon) {
                // Sponsored by the store agent - deduct from their margin
                agentProfit = Math.max(0, agentProfit - couponDiscount);
              }
              sellPrice = Math.max(0, sellPrice - couponDiscount);
            }
          }
        }
      }
    } else {
      // Direct purchase discount adjustment
      if (couponDiscount > 0) {
        sellPrice = Math.max(0, sellPrice - couponDiscount);
      }
    }
  } else if (agentSlug) {
    const { data: agent } = await admin
      .from("agent_profiles")
      .select("id, parent_agent_id")
      .eq("store_slug", agentSlug)
      .maybeSingle();
    if (agent) {
      agentId = agent.id;
      parentAgentId = agent.parent_agent_id;
      source = "agent_store";
    }
  }

  let customerPhone = recipient;
  if (customerUserId) {
    const { data: prof } = await admin.from("profiles").select("phone").eq("id", customerUserId).maybeSingle();
    customerPhone = prof?.phone ?? recipient;
  }

  let networkId = bundle?.network_id || null;
  if (!networkId && orderType === "airtime") {
    const networkCode = payload.network_code || "MTN";
    const { data: netRow } = await admin
      .from("networks")
      .select("id")
      .eq("code", networkCode)
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
      bundle_id: bundle?.id || null,
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
      if (existingAfterRace?.id) return existingAfterRace.id;
    }
    throw new Error(oErr?.message ?? "Order create failed");
  }

  const sizeLabel = orderType === "data" ? bundle?.size_label : (orderType === "airtime" ? "Airtime Top-up" : (payload.bill_type || "Bill Payment"));

  // Send Processing SMS
  if (customerPhone && orderType !== "airtime") {
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
      ? `Your OneGig order for ${sizeLabel} is processing and may take 10-60 mins to reflect. Join our WhatsApp channel for updates: ${waLink}`
      : `Your OneGig order of ${sizeLabel} for ${recipient} is processing and may take 10-60 mins to reflect. Join our WhatsApp channel: ${waLink}`;
    
    // Fire and forget
    sendSMS({ to: customerPhone, message: msg }).catch((err) => console.error("SMS Error:", err));
  }

  const networkCode = orderType === "data" ? ((bundle?.networks as any)?.code ?? "MTN") : (payload.network_code || "MTN");
  const delivery = await deliverData(admin, {
    recipient,
    network_code: networkCode,
    size_label: orderType === "data" ? bundle?.size_label : undefined,
    size_mb: orderType === "data" ? bundle?.size_mb : undefined,
    amount: sellPrice,
    bill_type: payload.bill_type,
    sender_name: payload.sender_name,
    type: orderType,
    request_id: order.id,
    customer_phone: payload.customer_phone,
  });

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
    if (customerPhone) {
      let detailText = bundle ? bundle.size_label : (orderType === "airtime" ? `GHS ${sellPrice} Airtime` : `${payload.bill_type} Bill Payment`);
      sendSMS({
        to: customerPhone,
        message: `Your OneGig purchase of ${detailText} for ${recipient} was successfully delivered! Thank you for choosing OneGig.`,
      }).catch((err) => console.error("Success SMS Error:", err));
    }

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

    // 🎮 Loyalty Rewards Points settle
    if (customerUserId && agentId) {
      const pointsToCredit = Math.floor(sellPrice * 10); // 10 points per GHS 1.00 spent
      const pointsToDeduct = payload.points_redeemed ? Math.round(Number(payload.points_redeemed) * 10) : 0;
      const netPointsChange = pointsToCredit - pointsToDeduct;

      const { data: loyaltyRow } = await admin
        .from("loyalty_points")
        .select("points_balance")
        .eq("user_id", customerUserId)
        .eq("agent_id", agentId)
        .maybeSingle();

      const currentPoints = loyaltyRow?.points_balance ?? 0;
      const newPoints = Math.max(0, currentPoints + netPointsChange);

      await admin
        .from("loyalty_points")
        .upsert({
          user_id: customerUserId,
          agent_id: agentId,
          points_balance: newPoints
        }, { onConflict: "user_id,agent_id" });

      console.log(`Processed loyalty points: credited ${pointsToCredit}, deducted ${pointsToDeduct}. New balance: ${newPoints}`);
    }

    // 🔄 Momo Subscription (Recurring Delivery) insertion
    if (payload.subscribe && customerUserId && agentId) {
      const freq = payload.frequency === "weekly" ? "weekly" : "monthly";
      const days = freq === "weekly" ? 7 : 30;
      const nextBillingDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

      await admin
        .from("momo_subscriptions")
        .insert({
          user_id: customerUserId,
          agent_id: agentId,
          bundle_id: bundle.id,
          recipient_phone: recipient,
          frequency: freq,
          status: "active",
          next_billing_at: nextBillingDate
        });

      console.log(`Created new active recurring Momo subscription for user ${customerUserId}`);
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
  const paystackSecret = await getPaystackSecretKey();
  if (!paystackSecret) throw new Error("Missing Paystack secret");

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
        coupon_code: metadata?.coupon_code || null,
        coupon_discount: metadata?.coupon_discount || null,
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
        type: "deposit",
        amount: depositAmount,
        status: "completed",
        reference: reference,
        description: `Wallet Deposit via Paystack (${reference})`,
      });
      if (wErr) throw new Error("Wallet insert failed: " + wErr.message);

      const { data: uProf } = await admin.from("profiles").select("phone").eq("id", userId).maybeSingle();
      if (uProf?.phone) {
        sendSMS({ to: uProf.phone, message: `Your OneGig wallet deposit of GHS ${depositAmount} was successful!` }).catch((err) => console.error("SMS Error:", err));
      }
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
    let pLoad = payment.payload;
    if (typeof pLoad === "string") {
      try { pLoad = JSON.parse(pLoad); } catch(e) { pLoad = {}; }
    }
    
    // Self-healing: if the payment is paid, but it was a wallet_deposit or agent_activation, 
    // verify if the corresponding wallet transaction or activation was actually completed.
    if (payment.purpose === "wallet_deposit") {
      const userId = payment.user_id;
      if (userId) {
        const { data: existingTx } = await admin
          .from("wallet_transactions")
          .select("id")
          .eq("user_id", userId)
          .eq("type", "deposit")
          .ilike("description", `%${reference}%`)
          .maybeSingle();
        
        if (!existingTx) {
          console.log(`Self-healing: Payment ${reference} is marked paid but wallet transaction was missing. Creating transaction now.`);
          const depositAmount = Number(pLoad?.deposit_amount || payment.amount);
          const { error: wErr } = await admin.from("wallet_transactions").insert({
            user_id: userId,
            type: "deposit",
            amount: depositAmount,
            status: "completed",
            reference: reference,
            description: `Wallet Deposit via Paystack (${reference})`,
          });
          if (wErr) {
            console.error("Wallet deposit insert failed during self-healing:", wErr);
            throw new Error("Wallet deposit insert failed: " + wErr.message);
          }
        }
      }
    } else if (payment.purpose === "agent_activation") {
      const userId = payment.user_id;
      if (userId) {
        const { data: existingRole } = await admin
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "agent")
          .maybeSingle();
        
        if (!existingRole) {
          console.log(`Self-healing: Payment ${reference} is marked paid but agent role was missing. Activating agent now.`);
          await activateAgent(admin, String(userId), pLoad?.ref_slug || null);
        }
      }
    }
    return { ok: true, already_processed: true, purpose: payment.purpose, order_id: payment.order_id ?? null };
  }

  if (["pay_offline", "pending", "send_otp", "ongoing"].includes(trx?.status)) {
    return { ok: false, status: "pending", reason: "Payment is pending authorization" };
  }

  if (trx?.status !== "success") {
    const errorMsg = trx?.gateway_response || trx?.message || trx?.status || "Payment failed";
    let pLoad = payment.payload;
    if (typeof pLoad === "string") {
      try { pLoad = JSON.parse(pLoad); } catch(e) { pLoad = {}; }
    }
    await admin.from("payments").update({ 
      status: "failed",
      payload: { ...(pLoad || {}), error_message: errorMsg }
    }).eq("id", payment.id);
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
      type: "deposit",
      amount: depositAmount,
      status: "completed",
      reference: reference,
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
      const paystackSecret = await getPaystackSecretKey();
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
