import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export function normalizePhone(phone: string): string {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.startsWith("233") && digits.length === 12) {
    digits = "0" + digits.slice(3);
  } else if (digits.startsWith("00233") && digits.length === 14) {
    digits = "0" + digits.slice(5);
  }
  return digits;
}

export function toProviderNetwork(code: string): string {
  const normalized = String(code || "").trim().toUpperCase();
  if (["MTN", "M"].includes(normalized)) return "MTN";
  if (["TELECEL", "VODAFONE", "VODA", "VOD", "T", "TCL"].includes(normalized)) return "TELECEL";
  if (["AT", "AIRTELTIGO", "AIRTEL", "TIGO", "A"].includes(normalized)) return "AT";
  return normalized || "MTN";
}

export function toPlanId(sizeLabel: string | null | undefined, sizeMb: number): string {
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

export function toSwiftDataNetwork(networkCode: string, sizeLabel: string | null | undefined): string {
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

export function toSizeGb(sizeLabel: string | null | undefined, sizeMb: number): number {
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

export function toDataHubNetworkKey(networkCode: string, sizeLabel?: string | null): string {
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

export interface DeliverDataArgs {
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

export interface DeliverDataResult {
  ok: boolean;
  provider_ref?: string;
  status?: string;
  message?: string;
}

export async function deliverData(
  admin: ReturnType<typeof createClient>,
  args: DeliverDataArgs
): Promise<DeliverDataResult> {
  const { data: dpData } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "data_providers")
    .maybeSingle();

  const config = (dpData?.value as any) ?? {};
  const requestId = args.request_id || crypto.randomUUID();

  // 1. Determine primary provider
  let primaryProviderKey = args.force_provider;
  if (!primaryProviderKey) {
    if (args.type === "airtime") {
      primaryProviderKey = config.active_airtime || config.active || "datahub";
    } else if (args.type === "bill") {
      primaryProviderKey = config.active_utility || config.active || "datahub";
    } else {
      primaryProviderKey = config.active_data || config.active || "datahub";
    }
  }

  // 2. Build candidate list for auto-failover
  // For data: Try primary first, then fallback to alternate providers (datahub <-> swiftdata/swft)
  let candidateKeys: string[] = [];
  if (args.force_provider) {
    candidateKeys = [args.force_provider];
  } else if (args.type === "data" || !args.type) {
    if (primaryProviderKey === "datahub") {
      candidateKeys = ["datahub", "swiftdata", "swft"];
    } else if (primaryProviderKey === "swiftdata" || primaryProviderKey === "swft") {
      candidateKeys = [primaryProviderKey, "datahub", primaryProviderKey === "swiftdata" ? "swft" : "swiftdata"];
    } else {
      candidateKeys = [primaryProviderKey, "datahub", "swiftdata"];
    }
  } else if (args.type === "airtime") {
    candidateKeys = [primaryProviderKey, primaryProviderKey === "datahub" ? "swft" : "datahub"];
  } else {
    candidateKeys = [primaryProviderKey, "swft", "datahub"];
  }

  // Filter candidates to only those with configured providers or valid keys
  const validCandidates: { key: string; apiKey: string; baseUrl: string }[] = [];
  for (const k of candidateKeys) {
    let pConfig = config?.providers?.[k];
    let defaultBaseUrl = "https://user.datahubgh.com/api/external";
    if (k === "swiftdata" || k === "swft" || k === "mtopup") {
      defaultBaseUrl = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
    }

    const baseUrl = pConfig?.base_url || defaultBaseUrl;
    let apiKey = pConfig?.api_key || "";
    if (!apiKey && k === "datahub") {
      apiKey = Deno.env.get("DATAHUB_API_KEY") || "";
    }
    if (!apiKey && (k === "swiftdata" || k === "swft")) {
      apiKey = Deno.env.get("DEVELOPER_API_KEY") || "";
    }

    if (apiKey && !validCandidates.some((c) => c.key === k)) {
      validCandidates.push({ key: k, apiKey, baseUrl });
    }
  }

  // Fallback: If no providers have keys found in filter, at least attempt datahub
  if (validCandidates.length === 0) {
    validCandidates.push({
      key: "datahub",
      apiKey: config?.providers?.datahub?.api_key || Deno.env.get("DATAHUB_API_KEY") || "",
      baseUrl: config?.providers?.datahub?.base_url || "https://user.datahubgh.com/api/external",
    });
  }

  console.log(`[deliverData] Attempting delivery for request ${requestId}. Failover sequence:`, validCandidates.map((c) => c.key));

  let lastError = "";
  const attemptedProviders: string[] = [];
  const providerErrors: Record<string, string> = {};

  for (let i = 0; i < validCandidates.length; i++) {
    const { key: providerKey, apiKey: PROVIDER_API_KEY, baseUrl: PROVIDER_BASE_URL } = validCandidates[i];
    attemptedProviders.push(providerKey);

    let endpoint = "";
    let payload: any = {};

    if (providerKey === "datahub") {
      const netUpper = String(args.network_code || "").toUpperCase();
      const labelUpper = String(args.size_label || "").toUpperCase();

      if (
        netUpper === "RESULT_CHECKER" ||
        netUpper === "RESULT_CHECKERS" ||
        netUpper === "WAEC" ||
        netUpper === "CHECKER" ||
        labelUpper.includes("CHECKER") ||
        labelUpper.includes("VOUCHER") ||
        labelUpper.includes("PLACEMENT")
      ) {
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
    } else if (providerKey === "swiftdata" || providerKey === "swft") {
      if (args.type === "airtime") {
        endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/airtime`;
        payload = {
          action: "buy",
          network: toProviderNetwork(args.network_code || "MTN"),
          phone: normalizePhone(args.recipient),
          amount: Number(args.amount),
          request_id: requestId,
          allow_duplicate: true,
        };
      } else if (args.type === "bill") {
        if (args.bill_type === "ECG") {
          endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/ecg`;
          payload = {
            phoneNumber: normalizePhone(args.customer_phone || args.recipient),
            accountNumber: args.recipient,
            amount: Number(args.amount),
          };
        } else {
          endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/bills/pay`;
          payload = {
            customerNumber: args.recipient,
            billType: args.bill_type,
            amount: Number(args.amount),
            senderName: args.sender_name || "CUSTOMER",
          };
        }
      } else {
        const sizeGb = toSizeGb(args.size_label, args.size_mb || 0);

        if (
          PROVIDER_BASE_URL.includes("/api/v1") ||
          PROVIDER_BASE_URL.includes("ihrvvniomtoofrjkmalb") ||
          PROVIDER_BASE_URL.endsWith("/buy-data")
        ) {
          // SwiftData Reseller API (/buy-data)
          endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}${PROVIDER_BASE_URL.endsWith("/buy-data") ? "" : "/buy-data"}`;
          const net = toSwiftDataNetwork(args.network_code, args.size_label);
          payload = {
            phone: normalizePhone(args.recipient),
            network: net,
            size_gb: sizeGb,
            reference: requestId,
          };
        } else {
          // SwiftData Developer API fallback (/payment/data)
          endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/payment/data`;
          const plan = toPlanId(args.size_label, args.size_mb || 0).toLowerCase();
          const net = toProviderNetwork(args.network_code || "MTN");
          let prefix = "yellow";
          if (net === "TELECEL") prefix = "red";
          if (net === "AT") prefix = "blue";

          payload = {
            action: "buy",
            package_id: `${prefix}_${plan}`,
            package_size: `${sizeGb}GB`,
            size_gb: sizeGb,
            capacity: sizeGb,
            network: net,
            phone: normalizePhone(args.recipient),
            request_id: requestId,
            reference: requestId,
            allow_duplicate: true,
          };
        }
      }
    } else {
      // Default / MTopUp fallback
      endpoint = `${PROVIDER_BASE_URL.replace(/\/$/, "")}/airtime`;
      payload = {
        network: toProviderNetwork(args.network_code || "MTN"),
        plan_id: toPlanId(args.size_label, args.size_mb || 0),
        phone: normalizePhone(args.recipient),
        request_id: requestId,
      };
    }

    try {
      console.log(`[deliverData] Attempt ${i + 1}/${validCandidates.length}: calling ${providerKey} at ${endpoint}`);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 18000); // 18s timeout

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "X-API-Key": PROVIDER_API_KEY,
          "Authorization": `Bearer ${PROVIDER_API_KEY}`,
          "Content-Type": "application/json",
          "X-Idempotency-Key": requestId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

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
            cleanMessage = `Provider API (${providerKey}) returned an HTML error page.`;
          } else {
            cleanMessage = rawText || `Provider failed with HTTP ${response.status}`;
          }
        }

        lastError = cleanMessage;
        providerErrors[providerKey] = cleanMessage;
        console.warn(`[deliverData] Provider ${providerKey} failed: ${cleanMessage}. Checking next provider in failover sequence...`);
        continue; // Try next candidate in the failover chain
      }

      // Successful response from provider
      const rawStatus = String(parsed?.order?.status || parsed?.data?.status || parsed?.status || "processing").toLowerCase();
      const isDelivered = ["completed", "delivered", "success", "fulfilled", "paid"].includes(rawStatus);
      const providerRef = parsed?.order?.reference
        ? String(parsed.order.reference)
        : (parsed?.data?.orderNumber
        ? String(parsed.data.orderNumber)
        : (parsed?.data?.reference || parsed?.order_id || parsed?.transaction_id || parsed?.reference || requestId));

      const failoverNote = i > 0 ? ` (Auto-failover from ${attemptedProviders[0]}: ${lastError})` : "";
      const successMessage = parsed?.message ? `${parsed.message}${failoverNote}` : (failoverNote ? `Fulfilled via ${providerKey}${failoverNote}` : null);

      console.log(`[deliverData] Successfully delivered order via ${providerKey}! Provider ref: ${providerRef}`);
      return {
        ok: true,
        status: isDelivered ? "delivered" : "processing",
        provider_ref: providerRef,
        message: successMessage,
      };
    } catch (fetchErr: any) {
      lastError = fetchErr?.name === "AbortError" ? "Request timed out" : (fetchErr?.message || String(fetchErr));
      providerErrors[providerKey] = lastError;
      console.warn(`[deliverData] Provider ${providerKey} threw network error: ${lastError}. Checking next provider...`);
      continue;
    }
  }

  // If we reach here, all candidate providers were attempted and failed
  const isBalanceError = Object.values(providerErrors).some((err) => /insufficient\s+balance/i.test(err));
  const primaryError = providerErrors[attemptedProviders[0]];
  const finalMessage = isBalanceError
    ? `Provider balance exhausted (${primaryError || "Insufficient provider funds"}). Please top up provider wallet.`
    : `All delivery providers failed (${attemptedProviders.join(" -> ")}). Last error: ${lastError}`;

  return {
    ok: false,
    provider_ref: requestId,
    message: finalMessage,
  };
}
