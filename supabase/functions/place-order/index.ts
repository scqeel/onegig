import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";
import { sendWebPushNotification } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PlaceOrderBody {
  recipient_phone: string;
  customer_phone?: string;
  bundle_id: string;
  agent_slug?: string | null;
  force_provider?: string;
  retry_order_id?: string;
  manual_fulfill?: boolean;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });



function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function isSamePhoneNumber(num1?: string | null, num2?: string | null): boolean {
  if (!num1 || !num2) return false;
  const clean1 = num1.replace(/\D/g, "").slice(-9);
  const clean2 = num2.replace(/\D/g, "").slice(-9);
  return clean1.length >= 9 && clean1 === clean2;
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

function toDataHubNetworkKey(networkCode: string, sizeLabel?: string | null): string {
  const net = String(networkCode || "").toUpperCase();
  const label = String(sizeLabel || "").toLowerCase();
  if (net === "MTN") {
    if (label.includes("express") || label.includes("xpress")) {
      return "MTN_XPRESS";
    }
    return "YELLO";
  }
  if (net === "TELECEL" || net === "VODAFONE") {
    return "TELECEL";
  }
  if (net === "AT" || net === "AIRTELTIGO") {
    if (label.includes("bigtime") || label.includes("big time")) {
      return "AT_BIGTIME";
    }
    return "AT_PREMIUM";
  }
  return "YELLO";
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
  }
): Promise<{ ok: boolean; provider_ref?: string; status?: string; message?: string }> {
  const { data: dpData } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "data_providers")
    .maybeSingle();

  const config = (dpData?.value as any) ?? {};
  
  let effectiveProviderKey = args.force_provider || config?.active || "datahub";
  if (!args.force_provider) {
    if (args.type === "airtime") {
      effectiveProviderKey = config.active_airtime || config.active || "datahub";
    } else if (args.type === "bill") {
      effectiveProviderKey = config.active_utility || config.active || "datahub";
    } else {
      effectiveProviderKey = config.active_data || config.active || "datahub";
    }
  }

  let providerConfig = config?.providers?.[effectiveProviderKey] ?? {};
  if (!providerConfig?.api_key && config?.providers?.datahub?.api_key) {
    effectiveProviderKey = "datahub";
    providerConfig = config.providers.datahub;
  }

  let defaultBaseUrl = "https://user.datahubgh.com/api/external";
  if (effectiveProviderKey === "swiftdata") defaultBaseUrl = "https://reseller.swiftdata.com";

  const PROVIDER_BASE_URL = providerConfig.base_url || defaultBaseUrl;
  const PROVIDER_API_KEY = providerConfig.api_key || Deno.env.get("DEVELOPER_API_KEY") || "";

  const requestId = args.request_id || crypto.randomUUID();
  let endpoint = "";
  let payload: any = {};

  if (effectiveProviderKey === "datahub") {
    const netUpper = String(args.network_code || "").toUpperCase();
    const labelUpper = String(args.size_label || "").toUpperCase();

    if (netUpper === "RESULT_CHECKER" || netUpper === "RESULT_CHECKERS" || netUpper === "WAEC" || netUpper === "CHECKER" || labelUpper.includes("CHECKER") || labelUpper.includes("VOUCHER") || labelUpper.includes("PLACEMENT")) {
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/voucher-purchase`;
      let vType = "WASSCE";
      if (labelUpper.includes("BECE")) vType = "BECE";
      if (labelUpper.includes("CSSPS") || labelUpper.includes("PLACEMENT")) vType = "CSSPS";
      if (labelUpper.includes("NOVDEC")) vType = "NOVDEC";

      const phone = normalizePhone(args.recipient);

      payload = {
        VoucherType: vType,
        voucher_type: vType,
        Recipient: phone,
        recipient: phone,
        phone: phone,
        Quantity: 1,
        quantity: 1,
        reference: requestId,
        request_id: requestId,
      };
    } else {
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/data-purchase`;
      const netKey = toDataHubNetworkKey(args.network_code || "MTN", args.size_label);
      const sizeGb = toSizeGb(args.size_label, args.size_mb || 0);
      payload = {
        networkKey: netKey,
        recipient: normalizePhone(args.recipient),
        capacity: String(sizeGb),
        reference: requestId,
      };
    }
  } else if (effectiveProviderKey === "swiftdata") {
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
          phoneNumber: normalizePhone(args.recipient),
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

  const isHttpOk = response.ok;
  const isJsonError = parsed && (parsed.success === false || parsed.status === "failed" || parsed.status === "error");

  if (!isHttpOk || isJsonError) {
    let cleanMessage = parsed?.error || parsed?.message || parsed?.msg;
    if (!cleanMessage) {
      if (rawText && (rawText.trim().startsWith("<!DOCTYPE") || rawText.trim().startsWith("<html"))) {
        cleanMessage = `Provider API (${effectiveProviderKey}) returned an HTML error page. Please check API URL settings in Admin Integrations.`;
      } else {
        cleanMessage = rawText || `Provider failed with HTTP ${response.status}`;
      }
    }
    return {
      ok: false,
      provider_ref: requestId,
      message: cleanMessage,
    };
  }

  const rawStatus = String(parsed?.data?.status || parsed?.status || "processing").toLowerCase();
  const isDelivered = ["completed", "delivered", "success", "fulfilled", "paid"].includes(rawStatus);
  const providerRef = parsed?.data?.orderNumber
    ? String(parsed.data.orderNumber)
    : (parsed?.data?.reference || parsed?.order_id || parsed?.transaction_id || parsed?.reference || requestId);

  return {
    ok: true,
    status: isDelivered ? "delivered" : "processing",
    provider_ref: providerRef,
    message: parsed?.message || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = (await req.json()) as PlaceOrderBody;
    if (!body?.recipient_phone) {
      return json({ error: "recipient_phone is required" }, 400);
    }
    if (!body?.bundle_id && !body?.retry_order_id) {
      return json({ error: "bundle_id or retry_order_id is required" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve caller and enforce Admin-only access
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized: Missing authorization header" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: ud } = await userClient.auth.getUser();
    const userId = ud.user?.id ?? null;
    let userPhone: string | null = null;
    
    if (!userId) return json({ error: "Unauthorized: Invalid token" }, 401);

    // Explicit Admin Check
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) {
      return json({ error: "Forbidden: Admin access required" }, 403);
    }

    const { data: prof } = await admin.from("profiles").select("phone").eq("id", userId).maybeSingle();
    userPhone = prof?.phone ?? null;

    let bundle: any = null;
    let agentId: string | null = null;
    let sellPrice = 0;
    let agentProfit = 0;
    let source: "direct" | "agent_store" = "direct";
    let order: any = null;
    let oErr: any = null;

    if (body.retry_order_id) {
      // Fetch existing order instead of creating new
      const { data: existingOrder, error: fetchErr } = await admin
        .from("orders")
        .select("*, bundle:bundles(*, networks(*)), network:networks(*)")
        .eq("id", body.retry_order_id)
        .maybeSingle();
      if (fetchErr || !existingOrder) return json({ error: "Failed to fetch order to retry" }, 404);
      order = existingOrder;
      bundle = order.bundle;
      sellPrice = Number(order.sell_price);
      agentProfit = Number(order.agent_profit);
      agentId = order.agent_id;
      source = order.source;

      // Reset order status to processing
      const { error: resetErr } = await admin
        .from("orders")
        .update({ status: "processing" })
        .eq("id", order.id);
      if (resetErr) return json({ error: "Failed to reset order status" }, 500);
    } else {
      // Bundle lookup for new order
      const { data: bData, error: bErr } = await admin
        .from("bundles")
        .select("id, base_price, size_label, size_mb, network_id, networks:networks(code)")
        .eq("id", body.bundle_id)
        .maybeSingle();
      if (bErr || !bData) return json({ error: "Bundle not found" }, 404);
      bundle = bData;
      sellPrice = Number(bundle.base_price);

      if (body.agent_slug) {
        const { data: agent } = await admin
          .from("agent_profiles")
          .select("id, user_id, activation_paid")
          .eq("store_slug", body.agent_slug)
          .maybeSingle();
        if (agent && agent.activation_paid) {
          agentId = agent.id;
          source = "agent_store";
          const { data: ap } = await admin
            .from("agent_bundle_prices")
            .select("sell_price")
            .eq("agent_id", agent.id)
            .eq("bundle_id", bundle.id)
            .maybeSingle();
          if (ap) {
            sellPrice = Number(ap.sell_price);
            agentProfit = Math.max(0, sellPrice - Number(bundle.base_price));
          }
        }
      }

      const customerPhone = body.customer_phone || userPhone || body.recipient_phone;

      // Insert new order
      const res = await admin
        .from("orders")
        .insert({
          customer_user_id: userId,
          customer_phone: customerPhone,
          recipient_phone: body.recipient_phone,
          network_id: bundle.network_id,
          bundle_id: bundle.id,
          agent_id: agentId,
          source,
          base_price: bundle.base_price,
          sell_price: sellPrice,
          agent_profit: agentProfit,
          status: "processing",
          payment_status: "paid", // mock payment
          payment_reference: `MOCK-${Date.now()}`,
        })
        .select("*")
        .single();
      order = res.data;
      oErr = res.error;
      
      if (oErr || !order) return json({ error: oErr?.message ?? "Order setup failed" }, 500);

      const targetPhone = customerPhone || body.customer_phone || body.recipient_phone;

      // Send Processing SMS to Customer & Recipient
      if (targetPhone) {
        const isSelf = isSamePhoneNumber(targetPhone, body.recipient_phone);
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

        const sizeLabel = bundle?.size_label || "Data Bundle";
        const msg = isSelf 
          ? `Your OneGig order for ${sizeLabel} is processing and will reflect shortly. Join our channel: ${waLink}`
          : `Your OneGig order of ${sizeLabel} for ${body.recipient_phone} is processing and will reflect shortly. Join channel: ${waLink}`;
        
        // Dispatch Processing SMS
        sendSMS({ to: targetPhone, message: msg }).catch((err) => console.error("SMS Error:", err));

        // If recipient is different, notify recipient as well
        if (!isSelf && body.recipient_phone) {
          const recipMsg = `A OneGig ${sizeLabel} package for your line (${body.recipient_phone}) is processing and will be delivered shortly!`;
          sendSMS({ to: body.recipient_phone, message: recipMsg }).catch((err) => console.error("Recipient SMS Error:", err));
        }
      }
    }

    const customerPhone = order.customer_phone || body.customer_phone || body.recipient_phone;

    // Deliver via stub adapter
    let delivery;
    if (body.manual_fulfill) {
      delivery = { ok: true, status: "delivered", message: "Manually marked as delivered", provider_ref: `MANUAL-${Date.now()}` };
    } else {
      // Determine delivery parameters dynamically
      let orderType: "data" | "airtime" | "bill" = "data";
      let billType: string | undefined = undefined;
      let notesText = String(order.notes || "");
      
      if (notesText.includes("Utility Bill")) {
        orderType = "bill";
        billType = notesText.split(" - ")[0].replace("Utility Bill: ", "").trim();
      } else if (notesText.includes("Airtime")) {
        orderType = "airtime";
      }

      const networkCode = bundle ? ((bundle.networks as any)?.code ?? "MTN") : (order.network?.code ?? "MTN");

      delivery = await deliverData(admin, {
        recipient: body.recipient_phone || order.recipient_phone,
        network_code: networkCode,
        size_label: bundle?.size_label,
        size_mb: bundle?.size_mb,
        amount: sellPrice,
        bill_type: billType,
        type: orderType,
        force_provider: body.force_provider,
        request_id: order.id,
      });
    }

    const finalStatus = delivery.ok
      ? (delivery.status === "fulfilled" || delivery.status === "delivered" ? "delivered" : "processing")
      : "failed";

    // Build final notes
    let notesPrefix = "";
    if (order.notes) {
      notesPrefix = order.notes.split(" - ")[0] + " - ";
    } else if (order.bundle_id === null) {
      if (order.network_id) {
        notesPrefix = "Airtime Top-up - ";
      } else {
        notesPrefix = "Utility Bill - ";
      }
    }

    await admin
      .from("orders")
      .update({
        status: finalStatus,
        notes: `${notesPrefix}${delivery.message || (delivery.provider_ref ? `Provider Ref: ${delivery.provider_ref}` : "Pending")}`,
      })
      .eq("id", order.id);

    // Credit agent profit
    if (delivery.ok && agentId && agentProfit > 0) {
      const { data: agentRow } = await admin
        .from("agent_profiles")
        .select("user_id")
        .eq("id", agentId)
        .maybeSingle();
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
          message: `You earned GHS ${agentProfit.toFixed(2)} profit from a sale of ${bundle.size_label} to ${body.recipient_phone}.`,
          type: "success",
          sound_name: "paystack",
          target_user_id: agentRow.user_id,
          is_global: false
        });
        
        await sendWebPushNotification(admin, agentRow.user_id, {
          title: "New Store Sale!",
          message: `You earned GHS ${agentProfit.toFixed(2)} profit from a sale of ${bundle.size_label} to ${body.recipient_phone}.`,
          url: "/agent"
        });
      }
    }

    return json({
      ok: delivery.ok,
      order: { ...order, status: finalStatus },
    });
  } catch (e: any) {
    console.error("place-order error", e);
    return json({ ok: false, error: e?.message ?? "Internal error" }, 200);
  }
});