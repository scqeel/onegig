import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function sendSMS({
  to,
  message,
  apiKey: passedApiKey,
  senderId: passedSenderId,
}: {
  to: string;
  message: string;
  apiKey?: string;
  senderId?: string;
}) {
  let apiKey = passedApiKey || Deno.env.get("TXTCONNECT_API_KEY");
  let senderId = passedSenderId || Deno.env.get("SMS_SENDER_ID");
  let swiftDataKey = "";
  let swiftDataBaseUrl = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";

  // Query database for settings if they aren't fully resolved
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl && serviceKey) {
      const admin = createClient(supabaseUrl, serviceKey);
      const { data: rows } = await admin
        .from("app_settings")
        .select("key, value")
        .in("key", ["txtconnect_api_key", "sms_sender_id", "data_providers"]);
      
      if (rows && rows.length > 0) {
        const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
        if (!apiKey && map.txtconnect_api_key) {
          apiKey = String(map.txtconnect_api_key).trim();
        }
        if (!senderId && map.sms_sender_id) {
          senderId = String(map.sms_sender_id).trim();
        }
        if (map.data_providers) {
          const config = map.data_providers as any;
          const activeKey = config.active || "swft";
          const activeConfig = config.providers?.[activeKey];
          if (activeConfig && (activeKey === "swft" || activeKey === "swiftdata")) {
            swiftDataKey = activeConfig.api_key || "";
            if (activeConfig.base_url) {
              swiftDataBaseUrl = activeConfig.base_url;
            }
          }
        }
      }
    }
  } catch (dbErr) {
    console.warn("Failed to fetch SMS/Provider settings from database:", dbErr);
  }

  if (!senderId) {
    senderId = "OneGig";
  }

  // If TxtConnect API key is not available, but SwiftData key is, use SwiftData SMS!
  if (!apiKey && swiftDataKey) {
    // Format phone number for SwiftData (10 digit local format, e.g. 0241234567)
    let formattedTo = to.replace(/[^0-9]/g, "");
    if (formattedTo.startsWith("233") && formattedTo.length === 12) {
      formattedTo = "0" + formattedTo.slice(3);
    } else if (!formattedTo.startsWith("0")) {
      formattedTo = "0" + formattedTo;
    }

    const res = await fetch(`${swiftDataBaseUrl.replace(/\/$/, "")}/sms`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${swiftDataKey}`,
        "X-API-Key": swiftDataKey,
      },
      body: JSON.stringify({
        to: formattedTo,
        message: message,
        senderId: senderId === "OneGig" ? "SwiftData" : senderId,
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "Unknown error");
      throw new Error(`SwiftData SMS API responded with status ${res.status}: ${errText}`);
    }

    const data = await res.json().catch(() => null);
    if (data && data.success === false) {
      throw new Error(`SwiftData SMS error: ${data.error || "Unknown error"}`);
    }
    return data;
  }

  // Fallback or explicit TxtConnect route
  if (!apiKey) {
    throw new Error("Missing TXTCONNECT_API_KEY. Please set it in the Admin Settings or Deno secrets.");
  }

  // Format phone number for TxtConnect (233XXXXXXXXX)
  let formattedTo = to.replace(/[^0-9]/g, "");
  if (formattedTo.startsWith("0")) {
    formattedTo = "233" + formattedTo.slice(1);
  } else if (!formattedTo.startsWith("233")) {
    formattedTo = "233" + formattedTo;
  }

  const res = await fetch("https://api.txtconnect.net/dev/api/sms/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      to: formattedTo,
      from: senderId,
      unicode: "0",
      sms: message,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "Unknown error");
    throw new Error(`TXTConnect API responded with status ${res.status}: ${errText}`);
  }

  const data = await res.json().catch(() => null);
  
  if (data?.data?.in_error) {
    throw new Error(`TXTConnect business error: ${JSON.stringify(data.data)}`);
  }

  return data;
}
