import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";
import { sendWebPushNotification } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-swift-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Fetch active provider credentials
    const { data: dpData } = await admin
      .from("app_settings")
      .select("value")
      .eq("key", "data_providers")
      .maybeSingle();

    const config = (dpData?.value as any) ?? {};
    const activeProviderKey = config?.active || "swft";
    const providerConfig = config?.providers?.[activeProviderKey] ?? {};
    const PROVIDER_API_KEY = providerConfig.api_key || "";

    const rawBody = await req.text();
    const signature = req.headers.get("x-swift-signature") || req.headers.get("X-Swift-Signature") || "";

    // Verify webhook signature (HMAC-SHA256)
    if (signature && PROVIDER_API_KEY) {
      const keyBytes = new TextEncoder().encode(PROVIDER_API_KEY);
      const dataBytes = new TextEncoder().encode(rawBody);
      const key = await crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"]
      );
      const hashBuffer = await crypto.subtle.sign("HMAC", key, dataBytes);
      const expectedSignature = toHex(new Uint8Array(hashBuffer));

      if (signature !== expectedSignature) {
        console.error("Signature verification failed", { signature, expectedSignature });
        return json({ error: "Invalid signature" }, 401);
      }
    }

    const event = JSON.parse(rawBody);
    console.log("SwiftData Webhook Event Received:", event);

    const clientRef = event.client_reference || event.request_id || event.reference;
    let order: any = null;

    if (clientRef) {
      // Find order by ID (UUID)
      const { data: oByUUID } = await admin
        .from("orders")
        .select("*, customer:customer_user_id(*)")
        .eq("id", clientRef)
        .maybeSingle();
      if (oByUUID) order = oByUUID;
    }

    if (!order && event.order_id) {
      // Find order by notes containing provider reference
      const { data: oByNotes } = await admin
        .from("orders")
        .select("*, customer:customer_user_id(*)")
        .like("notes", `%${event.order_id}%`)
        .maybeSingle();
      if (oByNotes) order = oByNotes;
    }

    if (!order) {
      console.warn("SwiftData webhook matched no active order in DB", { clientRef, orderId: event.order_id });
      return json({ ok: true, matched: false });
    }

    const eventStatus = event.status || (event.event === "order.fulfilled" ? "fulfilled" : "fulfillment_failed");
    const isSuccess = eventStatus === "fulfilled" || eventStatus === "delivered";
    const isFailure = eventStatus === "fulfillment_failed" || eventStatus === "failed";

    if (isSuccess && order.status !== "delivered") {
      // ── Mark order as delivered ──
      await admin
        .from("orders")
        .update({ status: "delivered", notes: `Fulfilled via SwiftData Webhook. Upstream Order ID: ${event.order_id || ""}` })
        .eq("id", order.id);

      // Award profits to agents
      const agentId = order.agent_id;
      const parentAgentId = order.parent_agent_id;
      const agentProfit = Number(order.agent_profit || 0);
      const parentAgentProfit = Number(order.parent_agent_profit || 0);

      // Fetch grandparent recruiter ID if applicable
      let grandparentAgentId: string | null = null;
      if (parentAgentId) {
        const { data: parentProfile } = await admin
          .from("agent_profiles")
          .select("parent_agent_id")
          .eq("id", parentAgentId)
          .maybeSingle();
        if (parentProfile?.parent_agent_id) {
          grandparentAgentId = parentProfile.parent_agent_id;
        }
      }
      
      const totalProfitPool = Math.max(0, Number(order.sell_price) - Number(order.base_price));
      let grandparentAgentProfit = 0;
      let finalAgentProfit = agentProfit;
      let finalParentAgentProfit = parentAgentProfit;

      if (grandparentAgentId && totalProfitPool > 0) {
        finalAgentProfit = Number((totalProfitPool * 0.65).toFixed(2));
        finalParentAgentProfit = Number((totalProfitPool * 0.25).toFixed(2));
        grandparentAgentProfit = Number((totalProfitPool * 0.10).toFixed(2));
      }

      if (agentId && finalAgentProfit > 0) {
        const { data: agentRow } = await admin.from("agent_profiles").select("user_id").eq("id", agentId).maybeSingle();
        if (agentRow?.user_id) {
          await admin.from("wallet_transactions").insert({
            user_id: agentRow.user_id,
            type: "earning",
            amount: finalAgentProfit,
            status: "completed",
            related_order_id: order.id,
            description: `Profit from order ${order.reference}`,
          });

          await admin.from("app_notifications").insert({
            title: "New Store Sale!",
            message: `You earned GHS ${finalAgentProfit.toFixed(2)} profit from a sale to ${order.recipient_phone}.`,
            type: "success",
            sound_name: "paystack",
            target_user_id: agentRow.user_id,
            is_global: false,
          });

          await sendWebPushNotification(admin, agentRow.user_id, {
            title: "New Store Sale!",
            message: `You earned GHS ${finalAgentProfit.toFixed(2)} profit from a sale to ${order.recipient_phone}.`,
            url: "/agent",
          });
        }
      }

      if (parentAgentId && finalParentAgentProfit > 0) {
        const { data: parentAgentRow } = await admin.from("agent_profiles").select("user_id").eq("id", parentAgentId).maybeSingle();
        if (parentAgentRow?.user_id) {
          await admin.from("wallet_transactions").insert({
            user_id: parentAgentRow.user_id,
            type: "earning",
            amount: finalParentAgentProfit,
            status: "completed",
            related_order_id: order.id,
            description: `Network profit from sub-agent order ${order.reference}`,
          });

          await admin.from("app_notifications").insert({
            title: "Sub-Agent Sale!",
            message: `You earned GHS ${finalParentAgentProfit.toFixed(2)} network profit from sub-agent purchase.`,
            type: "success",
            sound_name: "paystack",
            target_user_id: parentAgentRow.user_id,
            is_global: false,
          });

          await sendWebPushNotification(admin, parentAgentRow.user_id, {
            title: "Sub-Agent Sale!",
            message: `You earned GHS ${finalParentAgentProfit.toFixed(2)} network profit.`,
            url: "/agent",
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
            is_global: false,
          });

          await sendWebPushNotification(admin, grandparentAgentRow.user_id, {
            title: "Downline Recruiter Earning!",
            message: `You earned GHS ${grandparentAgentProfit.toFixed(2)} grandparent recruiter profit.`,
            url: "/agent",
          });
        }
      }

      // Customer notifications
      if (order.customer_user_id) {
        await admin.from("app_notifications").insert({
          title: "Purchase Successful",
          message: `Your purchase of GHS ${order.sell_price} for ${order.recipient_phone} was successful!`,
          type: "success",
          sound_name: "paystack",
          target_user_id: order.customer_user_id,
          is_global: false,
        });
      }

      // SMS
      if (order.customer_phone) {
        sendSMS({
          to: order.customer_phone,
          message: `Your OneGig purchase for ${order.recipient_phone} was successfully delivered! Thank you for using OneGig.`,
        }).catch((err) => console.error("SMS Error:", err));
      }

    } else if (isFailure && order.status !== "failed" && order.status !== "refunded") {
      // ── Mark order as failed ──
      await admin
        .from("orders")
        .update({ status: "failed", notes: `Upstream fulfillment failed: ${event.error || "Provider error"}` })
        .eq("id", order.id);

      // Refund if paid via wallet
      const isWalletPay = order.payment_reference?.startsWith("WP-");
      if (isWalletPay && order.customer_user_id) {
        await admin.from("wallet_transactions").insert({
          user_id: order.customer_user_id,
          type: "refund",
          amount: order.sell_price,
          status: "completed",
          description: `Refund for Failed Purchase (${order.payment_reference})`,
        });

        await admin.from("app_notifications").insert({
          title: "Order Refunded",
          message: `Your failed purchase of GHS ${order.sell_price} for ${order.recipient_phone} has been refunded to your wallet.`,
          type: "info",
          sound_name: "paystack",
          target_user_id: order.customer_user_id,
          is_global: false,
        });

        // Update payment status to refunded
        await admin
          .from("payments")
          .update({ status: "refunded" })
          .eq("order_id", order.id);
      }

      // SMS
      if (order.customer_phone) {
        sendSMS({
          to: order.customer_phone,
          message: `Your OneGig purchase for ${order.recipient_phone} failed and has been refunded. Please check your account or contact support.`,
        }).catch((err) => console.error("SMS Error:", err));
      }
    }

    return json({ ok: true, matched: true });
  } catch (err: any) {
    console.error("swiftdata-webhook error:", err);
    return json({ error: err.message || "Internal Server Error" }, 500);
  }
});
