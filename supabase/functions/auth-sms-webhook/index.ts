import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";
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

    // 1. Send SMS via standard txtconnect gateway
    await sendSMS({ to: phone, message });

    // 2. Fallback: Push to parent agent's in-app notifications if the registering user has a referrer
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(supabaseUrl, serviceKey);

      let cleanPhone = phone.replace(/\D/g, "");
      let queryPhone = cleanPhone;
      if (cleanPhone.startsWith("233")) {
        queryPhone = "0" + cleanPhone.slice(3);
      } else if (!cleanPhone.startsWith("0")) {
        queryPhone = "0" + cleanPhone;
      }

      // Find the profile matching the phone
      const { data: prof } = await admin
        .from("profiles")
        .select("id, full_name, referred_by")
        .or(`phone.eq.${cleanPhone},phone.eq.${queryPhone}`)
        .maybeSingle();

      if (prof?.referred_by) {
        const subAgentName = prof.full_name || phone;
        console.log(`Sending in-app notification to parent agent (${prof.referred_by}) for OTP fallback.`);
        
        await admin.from("app_notifications").insert({
          title: "Sub-Agent Signup OTP",
          message: `Your registering sub-agent (${subAgentName}) has a pending verification code: ${token}`,
          type: "info",
          sound_name: "paystack",
          target_user_id: prof.referred_by,
          is_global: false
        });

        await sendWebPushNotification(admin, prof.referred_by, {
          title: "Sub-Agent Signup OTP",
          message: `Your registering sub-agent (${subAgentName}) has a pending verification code: ${token}`,
          url: "/agent"
        }).catch(err => console.error("Push notification error:", err));
      }
    } catch (dbErr) {
      console.error("Database fallback hook error:", dbErr);
    }

    // Supabase Send SMS Auth Hook expects a 200 OK response with an empty JSON object or valid schema
    return json({});
  } catch (e: any) {
    console.error("auth-sms-webhook error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
