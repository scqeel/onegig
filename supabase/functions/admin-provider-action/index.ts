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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    let body: any = {};
    try {
      body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      body = {};
    }

    const action = body.action;

    // Fetch active provider credentials
    const { data: dpData } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "data_providers")
      .maybeSingle();

    const config = (dpData?.value as any) ?? {};
    const activeProviderKey = config?.active_data || config?.active || "datahub";
    let providerConfig = config?.providers?.[activeProviderKey] ?? {};

    // Fallback to DataHub if current active provider config has no API key
    if (!providerConfig?.api_key && config?.providers?.datahub?.api_key) {
      providerConfig = config.providers.datahub;
    }

    const PROVIDER_BASE_URL = providerConfig?.base_url || "https://user.datahubgh.com/api/external";
    const PROVIDER_API_KEY = providerConfig?.api_key || "";

    // Public action handling for recipient number verification
    if (action === "verify_number") {
      const { phone, is_ported_number } = body;
      if (!phone) return json({ error: "phone is required" }, 400);

      // If active provider is not DataHub or missing API Key, return standard success
      if (activeProviderKey !== "datahub" || !PROVIDER_API_KEY) {
        return json({ success: true, verified: true, message: "Number validated" });
      }

      const verifyUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/purchases/verify-number`;
      const verifyRes = await fetch(verifyUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PROVIDER_API_KEY}`,
          "X-API-Key": PROVIDER_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ phone, is_ported_number: !!is_ported_number }),
      });
      const verifyData = await verifyRes.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json(verifyData);
    }

    // Verify authentication and admin authorization for administrative actions
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized: Missing token" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: ud, error: udErr } = await userClient.auth.getUser();
    if (udErr || !ud.user?.id) return json({ error: "Unauthorized: Invalid token" }, 401);

    const userId = ud.user.id;
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });

    if (!isAdmin) return json({ error: "Forbidden: Admin access required" }, 403);

    if (!PROVIDER_API_KEY) {
      return json({ success: false, error: "Provider API Key is not configured in integrations settings" }, 200);
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${PROVIDER_API_KEY}`,
      "X-API-Key": PROVIDER_API_KEY,
      "Content-Type": "application/json",
    };

    if (action === "get_balance") {
      let mainBalance = 0;
      let apiBalance = 0;
      let currency = "GHS";

      if (activeProviderKey === "datahub") {
        const dhRes = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/balance`, { headers });
        const dhData = await dhRes.json().catch(() => null);
        if (dhData?.success) {
          mainBalance = Number(dhData.data?.balance ?? dhData.balance ?? 0);
          apiBalance = mainBalance;
          currency = dhData.data?.currency || dhData.currency || "GHS";
        }
      } else if (activeProviderKey === "swiftdata") {
        const swiftRes = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/v1/balance`, { headers });
        const swiftData = await swiftRes.json().catch(() => null);
        if (swiftData?.success) {
          mainBalance = Number(swiftData.balance);
          currency = swiftData.currency || "GHS";
        }
        
        // Fetch swft balance as API balance since we use it for airtime/bills
        const swftConfig = config?.providers?.["swft"] ?? {};
        const swftUrl = swftConfig.base_url || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
        const swftKey = swftConfig.api_key || "";
        if (swftKey) {
          const swftRes = await fetch(`${swftUrl.replace(/\/$/, "")}/balance`, {
            headers: {
              "Authorization": `Bearer ${swftKey}`,
              "X-API-Key": swftKey,
              "Content-Type": "application/json",
            }
          });
          const swftData = await swftRes.json().catch(() => null);
          if (swftData?.success) {
            apiBalance = Number(swftData.api_balance ?? swftData.balance);
          }
        }
      } else {
        const balRes = await fetch(`${PROVIDER_BASE_URL.replace(/\/$/, "")}/balance`, { headers });
        const balanceData = await balRes.json().catch(() => null);
        if (balanceData?.success) {
          mainBalance = Number(balanceData.balance);
          apiBalance = Number(balanceData.api_balance);
          currency = balanceData.currency || "GHS";
        }
      }

      return json({
        success: true,
        balance: {
          success: true,
          mainBalance,
          apiBalance,
          currency
        },
        wallets: []
      });

    } else if (action === "get_plans") {
      let plansUrl = "";
      if (activeProviderKey === "swiftdata") {
        plansUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/v1/packages`;
      } else {
        plansUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/plans`;
      }

      const plansRes = await fetch(plansUrl, { headers });
      const plansData = await plansRes.json().catch(() => ({ success: false }));
      return json(plansData);

    } else if (action === "sync_plans") {
      let plansUrl = "";
      if (activeProviderKey === "swiftdata") {
        plansUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/v1/packages`;
      } else {
        plansUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/plans`;
      }

      const plansRes = await fetch(plansUrl, { headers });
      const rawText = await plansRes.text();
      let plansData: any = null;
      try {
        plansData = rawText ? JSON.parse(rawText) : null;
      } catch (err) {
        return json({ error: `JSON Parse failed: ${err.message}. Raw: ${rawText.slice(0, 100)}` }, 400);
      }

      if (!plansRes.ok || !plansData || (activeProviderKey === "swiftdata" ? !plansData.packages : !plansData.plans)) {
        return json({ error: `Fetch failed with status ${plansRes.status}. Body: ${rawText.slice(0, 150)}` }, 400);
      }

      // Fetch existing bundles
      const { data: dbBundles, error: dbErr } = await admin
        .from("bundles")
        .select("id, size_label, base_price, active, network_id");
      if (dbErr || !dbBundles) return json({ error: "Failed to fetch bundles from database" }, 500);

      const items = activeProviderKey === "swiftdata" ? plansData.packages : plansData.plans;
      const upsertData: any[] = [];

      for (const pkg of items) {
        let netCode = "";
        let sizeGb = 0;
        let price = 0;

        if (activeProviderKey === "swiftdata") {
          netCode = pkg.network;
          sizeGb = Number(pkg.size_gb);
          price = Number(pkg.price);
        } else {
          if (pkg.is_unavailable) continue;
          netCode = pkg.network;
          const parsedGb = extractGb(pkg.package_size);
          if (parsedGb === null) continue;
          sizeGb = parsedGb;
          price = Number(pkg.api_price);
        }

        const netId = getNetworkId(netCode);
        if (!netId) continue;

        // Find matching bundle in DB
        const match = dbBundles.find((r: any) => {
          if (r.network_id !== netId) return false;
          const matchGb = r.size_label.match(/(\d+(?:\.\d+)?)\s*(gb)/i);
          if (!matchGb) return false;
          const dbGb = Number(matchGb[1]);
          if (Math.abs(dbGb - sizeGb) > 0.05) return false;

          // For AirtelTigo on swiftdata, match iShare vs Bigtime
          if (activeProviderKey === "swiftdata" && netId === "95d17299-3cd8-4d15-9d3e-47009ee8edda") {
            const isIShareDb = r.size_label.toLowerCase().includes("ishare");
            const isISharePkg = netCode === "at_ishare";
            return isIShareDb === isISharePkg;
          }
          return true;
        });

        const labelPrefix = getPrettyNetworkName(netCode);
        const prettyLabel = activeProviderKey === "swiftdata" 
          ? `${sizeGb}GB Non-Expiry (${labelPrefix})`
          : `${pkg.package_size} Non-Expiry`;

        const sizeMb = Math.round(sizeGb * 1000);
        const item: any = {
          network_id: netId,
          size_label: prettyLabel,
          size_mb: sizeMb,
          base_price: price,
          active: true,
        };

        if (match) {
          item.id = match.id;
        } else {
          item.id = crypto.randomUUID();
          item.user_price = price + (activeProviderKey === "swiftdata" ? 0.50 : 1.00);
          item.sort_order = 10;
        }

        upsertData.push(item);
      }

      // Upsert bundles
      if (upsertData.length > 0) {
        const { error: upsertErr } = await admin.from("bundles").upsert(upsertData);
        if (upsertErr) return json({ error: `Failed to upsert bundles: ${upsertErr.message}` }, 500);
      }

      // Deactivate other bundles of MTN, Telecel, AirtelTigo
      const activeUpsertedIds = upsertData.map(d => d.id);
      const inactiveBundles = dbBundles.filter((r: any) => 
        ["ee41ae80-e124-4cf7-8007-ef26c99e6be7", "a169c4f5-de22-4a3e-b6b1-05635ac10c1d", "95d17299-3cd8-4d15-9d3e-47009ee8edda"].includes(r.network_id) &&
        !activeUpsertedIds.includes(r.id)
      );

      if (inactiveBundles.length > 0) {
        const { error: deacErr } = await admin
          .from("bundles")
          .update({ active: false })
          .in("id", inactiveBundles.map(r => r.id));
        if (deacErr) return json({ error: `Failed to deactivate old bundles: ${deacErr.message}` }, 500);
      }

      return json({ success: true, count: upsertData.length, deactivated: inactiveBundles.length });

    } else if (action === "wallet_transfer") {
      const { from, to, amount } = body;
      if (!from || !to || !amount || Number(amount) <= 0) {
        return json({ error: "from, to, and positive amount are required" }, 400);
      }

      let transferUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/wallet/transfer`;
      let transferHeaders = headers;

      if (activeProviderKey === "swiftdata") {
        const swftConfig = config?.providers?.["swft"] ?? {};
        const swftUrl = swftConfig.base_url || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
        const swftKey = swftConfig.api_key || "";
        if (swftKey) {
          transferUrl = `${swftUrl.replace(/\/$/, "")}/wallet/transfer`;
          transferHeaders = {
            "Authorization": `Bearer ${swftKey}`,
            "X-API-Key": swftKey,
            "Content-Type": "application/json",
          };
        }
      }

      const res = await fetch(transferUrl, {
        method: "POST",
        headers: transferHeaders,
        body: JSON.stringify({ from, to, amount: Number(amount) }),
      });

      const data = await res.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json({ success: res.status === 200, ...data });

    } else if (action === "service_status") {
      if (activeProviderKey === "datahub") {
        return json({
          success: true,
          status: "online",
          mtn: "online",
          telecel: "online",
          airteltigo: "online",
          provider: "datahub",
          message: "DataHub GH system online",
        });
      }

      let statusUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/service-status`;
      let serviceHeaders = headers;
      
      if (activeProviderKey === "swiftdata") {
        const swftConfig = config?.providers?.["swft"] ?? {};
        const swftUrl = swftConfig.base_url || "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
        const swftKey = swftConfig.api_key || "";
        if (swftKey) {
          statusUrl = `${swftUrl.replace(/\/$/, "")}/service-status`;
          serviceHeaders = {
            "Authorization": `Bearer ${swftKey}`,
            "X-API-Key": swftKey,
            "Content-Type": "application/json",
          };
        }
      }

      const res = await fetch(statusUrl, { headers: serviceHeaders }).catch(() => null);
      if (!res || !res.ok) {
        return json({
          success: true,
          status: "online",
          mtn: "online",
          telecel: "online",
          airteltigo: "online",
        });
      }
      const data = await res.json().catch(() => ({ success: true, status: "online" }));
      return json(data);

    } else if (action === "check_order_status") {
      const { reference, orderNumber, order_id } = body;
      const ref = reference || orderNumber;
      
      let targetOrder: any = null;

      // Find target order if order_id or reference provided
      if (order_id) {
        const { data } = await admin.from("orders").select("*, bundle:bundles(size_label), network:networks(name)").eq("id", order_id).maybeSingle();
        targetOrder = data;
      } else if (ref) {
        const { data } = await admin.from("orders").select("*, bundle:bundles(size_label), network:networks(name)").or(`reference.eq.${ref},id.eq.${ref}`).maybeSingle();
        targetOrder = data;
        if (!targetOrder) {
          const { data: oByNotes } = await admin.from("orders").select("*, bundle:bundles(size_label), network:networks(name)").like("notes", `%${ref}%`).maybeSingle();
          if (oByNotes) targetOrder = oByNotes;
        }
      }

      // Extract DataHub order number from targetOrder.notes if available (e.g. "Provider Ref: 1574625")
      let dhOrderNum = "";
      if (targetOrder?.notes) {
        const match = String(targetOrder.notes).match(/(?:Provider Ref:\s*|Order #\s*|Ref:\s*)(\d+)/i) || String(targetOrder.notes).match(/\b(\d{5,8})\b/);
        if (match) dhOrderNum = match[1];
      }

      const lookupRef = orderNumber || dhOrderNum || ref || targetOrder?.reference || targetOrder?.id;
      if (!lookupRef) {
        return json({ error: "reference, orderNumber, or order_id is required" }, 400);
      }

      const queryParam = String(lookupRef).match(/^\d+$/) 
        ? `orderNumber=${encodeURIComponent(lookupRef)}` 
        : `reference=${encodeURIComponent(lookupRef)}`;

      const statusUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/order-status?${queryParam}`;
      const statusRes = await fetch(statusUrl, { headers });
      const statusData = await statusRes.json().catch(() => ({ success: false, error: "Failed to parse API response" }));

      const rawStatus = String(statusData?.data?.status || statusData?.status || "").toLowerCase();
      let mappedStatus: "delivered" | "failed" | "processing" = "processing";
      
      if (["completed", "delivered", "success", "fulfilled", "paid"].includes(rawStatus)) {
        mappedStatus = "delivered";
      } else if (["failed", "canceled", "cancelled", "rejected", "declined"].includes(rawStatus)) {
        mappedStatus = "failed";
      }

      // Update database if target order found
      if (targetOrder) {
        const providerRef = statusData?.data?.orderNumber
          ? String(statusData.data.orderNumber)
          : (statusData?.data?.reference || statusData?.order_id || statusData?.reference || lookupRef);

        const { error: updateErr } = await admin
          .from("orders")
          .update({
            status: mappedStatus,
            notes: statusData?.message || statusData?.data?.message || targetOrder.notes || null,
          })
          .eq("id", targetOrder.id);

        if (updateErr) {
          console.error("Failed to sync order status in DB:", updateErr);
        }

        // Send SMS notification if transitioned to delivered
        if (mappedStatus === "delivered" && targetOrder.status !== "delivered" && targetOrder.recipient_phone) {
          try {
            const bundleLabel = targetOrder.bundle?.size_label || "Data Bundle";
            const networkName = targetOrder.network?.name || "Network";
            const smsMessage = `Your ${bundleLabel} (${networkName}) order for ${targetOrder.recipient_phone} has been delivered successfully! Ref: ${providerRef}. Thank you for choosing OneGig!`;
            
            // Dynamic import helper to send SMS
            const { sendSMS } = await import("../_shared/sms.ts");
            await sendSMS({ to: targetOrder.recipient_phone, message: smsMessage });
          } catch (smsErr) {
            console.warn("SMS dispatch failed on status sync:", smsErr);
          }
        }
      }

      return json({
        success: true,
        status: mappedStatus,
        provider_status: rawStatus || "unknown",
        order_id: targetOrder?.id || null,
        provider_ref: lookupRef,
        data: statusData,
      });

    } else if (action === "register_webhook") {
      const webhookUrl = body.webhook_url || `${supabaseUrl.replace(/\/$/, "")}/functions/v1/datahub-webhook`;
      const registerUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/webhook`;
      const regRes = await fetch(registerUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: webhookUrl,
          secret: PROVIDER_API_KEY,
          events: ["order.status.changed"],
          description: "OneGig Platform Auto-Webhook",
          isActive: true,
        }),
      });
      const regData = await regRes.json().catch(() => ({ success: true, message: "Webhook active" }));
      return json({
        success: true,
        message: regData?.message || regData?.error || "Webhook URL active on DataHub GH",
        data: regData?.data || regData,
      }, 200);

    } else if (action === "purchase_voucher") {
      const { voucher_type, recipient, quantity } = body;
      if (!voucher_type || !recipient) {
        return json({ error: "voucher_type and recipient are required" }, 400);
      }
      const vUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/voucher-purchase`;
      const vRes = await fetch(vUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          VoucherType: String(voucher_type).toUpperCase(),
          Recipient: recipient,
          Quantity: Number(quantity || 1),
        }),
      });
      const vData = await vRes.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json(vData);

    } else if (action === "report_order") {
      const { reference, description } = body;
      if (!reference || !description) {
        return json({ error: "reference and description are required" }, 400);
      }
      const repUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/order-report`;
      const repRes = await fetch(repUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({ reference, description }),
      });
      const repData = await repRes.json().catch(() => ({ success: false, error: "Failed to parse API response" }));
      return json(repData);

    } else if (action === "check_balance") {
      const bUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/user`;
      const bRes = await fetch(bUrl, { headers });
      const bData = await bRes.json().catch(() => ({ success: false, error: "Failed to parse balance response" }));
      const balance = Number(bData?.data?.walletBalance || bData?.data?.balance || bData?.balance || 0);
      return json({
        success: true,
        balance,
        currency: "GHS",
        raw: bData,
      });

    } else if (action === "retry_order") {
      const { order_id } = body;
      if (!order_id) return json({ error: "order_id is required for retry" }, 400);

      const { data: targetOrder, error: oErr } = await admin
        .from("orders")
        .select("*, bundle:bundles(*), network:networks(*)")
        .eq("id", order_id)
        .maybeSingle();

      if (oErr || !targetOrder) {
        return json({ error: "Order not found" }, 404);
      }

      // Reset status to processing
      await admin.from("orders").update({ status: "processing", notes: "Manual Retry Triggered by Admin" }).eq("id", order_id);

      const netCode = targetOrder.network?.code || "MTN";
      const sizeLabel = targetOrder.bundle?.size_label || "";
      const recipient = targetOrder.recipient_phone;

      // Dispatch via DataHub
      const netKey = (netCode.toUpperCase() === "MTN") ? "yello" : (netCode.toUpperCase() === "TELECEL" ? "red" : "blue");
      const gbMatch = String(sizeLabel).match(/(\d+(?:\.\d+)?)\s*gb/i);
      const capacity = gbMatch ? gbMatch[1] : "1";

      const retryUrl = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/data-purchase`;
      const retryRes = await fetch(retryUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          networkKey: netKey,
          recipient,
          capacity,
          reference: targetOrder.id,
        }),
      });

      const retryData = await retryRes.json().catch(() => ({ success: false, message: "Provider request sent" }));
      const rawStatus = String(retryData?.data?.status || retryData?.status || "processing").toLowerCase();
      const isDelivered = ["completed", "delivered", "success", "fulfilled", "paid"].includes(rawStatus);

      const finalStatus = isDelivered ? "delivered" : "processing";
      const providerRef = retryData?.data?.orderNumber
        ? String(retryData.data.orderNumber)
        : (retryData?.data?.reference || retryData?.order_id || targetOrder.id);

      await admin
        .from("orders")
        .update({
          status: finalStatus,
          notes: `Retried via DataHub (Order #${providerRef}) - ${retryData?.message || "Submitted"}`,
        })
        .eq("id", targetOrder.id);

      if (isDelivered) {
        sendSMS({
          to: recipient,
          message: `Your OneGig order for ${recipient} (${sizeLabel}) has been successfully processed & delivered! Thank you for your patience.`,
        }).catch((e) => console.error("SMS retry notify error:", e));
      }

      return json({
        success: true,
        message: isDelivered ? "Order successfully retried and delivered!" : "Order retried and submitted to provider.",
        status: finalStatus,
        data: retryData,
      });

    } else {
      return json({ error: `Invalid action: ${action}` }, 400);
    }
  } catch (err: any) {
    console.error("admin-provider-action error:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});

function extractGb(label: string): number | null {
  const match = String(label).match(/(\d+(?:\.\d+)?)\s*(gb)/i);
  if (match) return Number(match[1]);
  const matchMb = String(label).match(/(\d+(?:\.\d+)?)\s*(mb)/i);
  if (matchMb) return Number(matchMb[1]) / 1024;
  return null;
}

function getNetworkId(netCode: string): string | null {
  const normalized = String(netCode).toLowerCase();
  if (normalized === "yello" || normalized === "mtn") return "ee41ae80-e124-4cf7-8007-ef26c99e6be7";
  if (normalized === "telecel" || normalized === "red") return "a169c4f5-de22-4a3e-b6b1-05635ac10c1d";
  if (normalized === "at_ishare" || normalized === "at_bigtime" || normalized === "blue" || normalized === "at") {
    return "95d17299-3cd8-4d15-9d3e-47009ee8edda";
  }
  return null;
}

function getPrettyNetworkName(netCode: string): string {
  const normalized = String(netCode).toLowerCase();
  if (normalized === "yello" || normalized === "mtn") return "MTN";
  if (normalized === "telecel" || normalized === "red") return "Telecel";
  if (normalized === "at_ishare") return "AirtelTigo iShare";
  if (normalized === "at_bigtime") return "AirtelTigo Bigtime";
  if (normalized === "blue" || normalized === "at") return "AirtelTigo";
  return "Unknown";
}
