import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendWebPushNotification } from "../_shared/push.ts";
import { sendSMS } from "../_shared/sms.ts";
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

// Removed local getTellerMerchantId and getTellerApiKey helper

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

async function activateAgent(admin: ReturnType<typeof createClient>, userId: string, refSlug?: string | null) {
  console.log(`Activating agent with userId: ${userId}`);

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
    if (existingAgent.activation_paid) {
      await admin.from("user_roles").upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
      return existingAgent.id;
    }

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

    if (updateErr) throw updateErr;
    finalAgentId = updatedAgent?.id;
  } else {
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

    if (insertErr) throw insertErr;
    finalAgentId = newAgent?.id;
  }

  await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });

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
    
    await admin.from("agent_bundle_prices").upsert(rows, { onConflict: "agent_id,bundle_id" });
  }

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
  let grandparentAgentId: string | null = null;
  let sellPrice = Number(payload.base_amount ?? payment.amount ?? bundle.user_price ?? bundle.base_price);
  let agentProfit = 0;
  let parentAgentProfit = 0;
  let grandparentAgentProfit = 0;
  let source: "direct" | "agent_store" = "direct";

  const couponCode = payload.coupon_code || null;
  const couponDiscount = Number(payload.coupon_discount || 0);
  let isGlobalCoupon = true;

  if (couponCode) {
    const { data: couponToIncrement } = await admin
      .from("coupons")
      .select("id, current_uses, agent_id")
      .eq("code", couponCode)
      .maybeSingle();

    if (couponToIncrement) {
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

          if (couponDiscount > 0) {
            if (!isGlobalCoupon) {
              agentProfit = Math.max(0, agentProfit - couponDiscount);
            }
            sellPrice = Math.max(0, sellPrice - couponDiscount);
          }
        }
      }
    }
  } else {
    if (couponDiscount > 0) {
      sellPrice = Math.max(0, sellPrice - couponDiscount);
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

    if (customerUserId && agentId) {
      const pointsToCredit = Math.floor(sellPrice * 10);
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
    }

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
  const merchantId = await dbGetTellerMerchantId();
  const apiKey = await dbGetTellerApiKey();
  const apiUser = await dbGetTellerApiUser();
  if (!merchantId || !apiKey) throw new Error("Missing theTeller configurations");

  const admin = createClient(supabaseUrl, serviceKey);

  const authString = btoa(`${apiUser}:${apiKey}`);

  // Call theTeller status verify API
  const verifyRes = await fetch(`https://prod.theteller.net/v1.1/users/transactions/${encodeURIComponent(reference)}/status`, {
    headers: {
      "Authorization": `Basic ${authString}`,
      "Merchant-Id": merchantId
    },
  });

  const verifyData = await verifyRes.json();
  if (!verifyRes.ok) {
    throw new Error(verifyData?.reason || "Unable to verify payment via theTeller");
  }

  const resCode = String(verifyData?.code ?? "");
  const isSuccess = resCode === "000";
  const isPending = resCode === "111" || resCode === "100" || verifyData?.status === "pending";

  const { data: paymentRow } = await admin
    .from("payments")
    .select("*")
    .eq("reference", reference)
    .maybeSingle();

  if (!paymentRow) throw new Error("Payment record unavailable");

  let payment = paymentRow;

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
            description: `Wallet Deposit via theTeller (${reference})`,
          });
          if (wErr) {
            console.error("Wallet deposit insert failed during self-healing:", wErr);
            throw new Error("Wallet deposit insert failed: " + wErr.message);
          }
          const { data: uProf } = await admin.from("profiles").select("phone").eq("id", userId).maybeSingle();
          if (uProf?.phone) {
            sendSMS({ to: uProf.phone, message: `Your OneGig wallet deposit of GHS ${depositAmount} was successful!` }).catch((err) => console.error("SMS Error:", err));
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

  if (isPending) {
    return { ok: false, status: "pending", reason: "Payment is pending authorization" };
  }

  if (!isSuccess) {
    const errorMsg = verifyData.reason || "Payment failed";
    let pLoad = payment.payload;
    if (typeof pLoad === "string") {
      try { pLoad = JSON.parse(pLoad); } catch(e) { pLoad = {}; }
    }
    await admin
      .from("payments")
      .update({
        status: "failed",
        payload: {
          ...pLoad,
          error_message: errorMsg,
          gateway_response: verifyData
        }
      })
      .eq("id", payment.id);

    return { ok: false, status: "failed", reason: errorMsg };
  }

  // Mark payment as paid
  let pLoad = payment.payload;
  if (typeof pLoad === "string") {
    try { pLoad = JSON.parse(pLoad); } catch(e) { pLoad = {}; }
  }
  await admin
    .from("payments")
    .update({
      status: "paid",
      payload: {
        ...pLoad,
        gateway_response: verifyData
      }
    })
    .eq("id", payment.id);

  let orderId: string | null = null;

  if (payment.purpose === "order") {
    orderId = await fulfillOrder(admin, payment);
    await admin.from("payments").update({ order_id: orderId }).eq("id", payment.id);
  }

  if (payment.purpose === "agent_activation") {
    const userId = payment.user_id;
    if (!userId) throw new Error("Missing user ID for activation payment");
    await activateAgent(admin, String(userId), pLoad?.ref_slug || null);
  }

  if (payment.purpose === "wallet_deposit") {
    const userId = payment.user_id;
    if (!userId) throw new Error("Missing user ID for deposit");
    
    const depositAmount = Number(pLoad?.deposit_amount || payment.amount);
    
    const { error: wErr } = await admin.from("wallet_transactions").insert({
      user_id: userId,
      type: "deposit",
      amount: depositAmount,
      status: "completed",
      description: `Wallet Deposit via theTeller (${reference})`,
    });

    if (wErr) {
      console.error("Wallet deposit insert failed:", wErr);
      throw new Error("Wallet deposit insert failed: " + wErr.message);
    }

    const { data: uProf } = await admin.from("profiles").select("phone").eq("id", userId).maybeSingle();
    if (uProf?.phone) {
      sendSMS({ to: uProf.phone, message: `Your OneGig wallet deposit of GHS ${depositAmount} was successful!` }).catch((err) => console.error("SMS Error:", err));
    }
  }

  return { ok: true, purpose: payment.purpose, order_id: orderId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const { reference } = await req.json();
    if (!reference) return json({ error: "reference is required" }, 400);

    const result = await verifyAndProcess(reference);
    return json(result);
  } catch (e: any) {
    console.error("theteller-verify error", e);
    return json({
      error: e?.message ?? "Internal error",
      details: e?.stack ?? String(e)
    }, 500);
  }
});
