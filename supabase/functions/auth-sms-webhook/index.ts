import { sendSMS } from "../_shared/sms.ts";

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
    const body = await req.json();
    console.log("SMS Hook Payload:", JSON.stringify(body, null, 2));
    
    // For updateUser, the unconfirmed phone number is in new_phone
    const phone = body?.phone || body?.new_phone || body?.user?.new_phone || body?.user?.phone_change || body?.user?.phone;
    const token = body?.token || body?.sms?.otp;
    const messagePayload = body?.message || body?.sms?.message;

    if (!phone) {
      console.error("Missing phone number. Payload was:", body);
      return json({ error: "Missing phone number" }, 400);
    }
    
    if (!token) {
      return json({ error: "Missing OTP token" }, 400);
    }

    const message = messagePayload || `Your OneGig login code is ${token}. Do not share this with anyone.`;

    await sendSMS({ to: phone, message });

    // Supabase Send SMS Auth Hook expects a 200 OK response with an empty JSON object or valid schema
    return json({});
  } catch (e: any) {
    console.error("auth-sms-webhook error", e);
    // Even if it fails, returning 200 is sometimes required by Supabase to not block the flow endlessly, 
    // but 500 is better for debugging.
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
