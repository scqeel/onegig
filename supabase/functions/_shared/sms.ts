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

  if (!apiKey || !senderId) {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
      if (supabaseUrl && serviceKey) {
        const admin = createClient(supabaseUrl, serviceKey);
        const { data: rows } = await admin
          .from("app_settings")
          .select("key, value")
          .in("key", ["txtconnect_api_key", "sms_sender_id"]);
        
        if (rows && rows.length > 0) {
          const map = Object.fromEntries(rows.map((r: any) => [r.key, r.value]));
          if (!apiKey && map.txtconnect_api_key) {
            apiKey = String(map.txtconnect_api_key).trim();
          }
          if (!senderId && map.sms_sender_id) {
            senderId = String(map.sms_sender_id).trim();
          }
        }
      }
    } catch (dbErr) {
      console.warn("Failed to fetch SMS settings from database:", dbErr);
    }
  }

  if (!apiKey) {
    throw new Error("Missing TXTCONNECT_API_KEY. Please set it in the Admin Settings or Deno secrets.");
  }

  if (!senderId) {
    senderId = "OneGig";
  }

  // Format phone number. Remove leading + or 0, prefix with country code if Ghana (+233)
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
