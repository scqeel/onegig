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
    
    // Supabase custom SMS webhook payload typically contains: phone, token, and message
    const phone = body?.phone || body?.user?.phone;
    const token = body?.token || body?.sms?.otp;
    const messagePayload = body?.message || body?.sms?.message;

    if (!phone) {
      return json({ error: "Missing phone number" }, 400);
    }
    
    if (!token) {
      return json({ error: "Missing OTP token" }, 400);
    }

    const message = messagePayload || `Your OneGig login code is ${token}. Do not share this with anyone.`;

    await sendSMS({ to: phone, message });

    // Supabase expects a 200 OK response for successful webhook delivery
    return json({ ok: true, sent: true });
  } catch (e: any) {
    console.error("auth-sms-webhook error", e);
    // Even if it fails, returning 200 is sometimes required by Supabase to not block the flow endlessly, 
    // but 500 is better for debugging.
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
