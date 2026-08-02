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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const rawBody = await req.text();
    let body: any = null;
    try {
      body = rawBody ? JSON.parse(rawBody) : null;
    } catch {
      return json({ error: "Invalid JSON payload" }, 400);
    }

    console.log("DataHub Webhook Received:", body);

    const dataObj = body?.data || body;
    const reference = dataObj?.reference || body?.reference;
    const orderNumber = dataObj?.orderNumber || body?.orderNumber;
    const status = String(dataObj?.status || body?.status || "").toUpperCase();

    if (!reference && !orderNumber) {
      return json({ ok: true, message: "No reference or orderNumber found in payload" });
    }

    let order: any = null;

    // Search order by reference (UUID)
    if (reference) {
      const { data: oByRef } = await admin
        .from("orders")
        .select("*, customer:customer_user_id(*)")
        .eq("id", reference)
        .maybeSingle();
      if (oByRef) order = oByRef;
    }

    // Search order by notes containing orderNumber or reference
    if (!order && (orderNumber || reference)) {
      const searchStr = String(orderNumber || reference);
      const { data: oByNotes } = await admin
        .from("orders")
        .select("*, customer:customer_user_id(*)")
        .like("notes", `%${searchStr}%`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (oByNotes) order = oByNotes;
    }

    // Search order by recipient phone if reference or orderNumber yielded no match
    const recipientPhone = dataObj?.recipient || body?.recipient || body?.phone;
    if (!order && recipientPhone) {
      const cleanPhone = String(recipientPhone).replace(/\D/g, "").slice(-9);
      const { data: oByPhone } = await admin
        .from("orders")
        .select("*, customer:customer_user_id(*)")
        .like("recipient_phone", `%${cleanPhone}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (oByPhone) order = oByPhone;
    }

    if (!order) {
      console.warn("DataHub webhook matched no order in DB:", { reference, orderNumber, recipientPhone });
      return json({ ok: true, matched: false });
    }

    const status = String(
      dataObj?.status || dataObj?.state || dataObj?.order_status || body?.status || body?.state || body?.order_status || ""
    ).toUpperCase();

    const isSuccess = ["COMPLETED", "DELIVERED", "SUCCESS", "SUCCESSFUL", "DONE", "FULFILLED", "PAID", "SUCCESS_DELIVERED"].includes(status);
    const isFailure = ["FAILED", "REJECTED", "CANCELLED", "DECLINED", "ERROR", "UNSUCCESSFUL", "FAIL"].includes(status);
    const isProcessing = ["PROCESSING", "PENDING", "INITIALIZED", "IN_PROGRESS", "QUEUED", "SUBMITTED"].includes(status);

    if (isProcessing && order.status !== "delivered" && order.status !== "failed" && order.status !== "refunded") {
      await admin
        .from("orders")
        .update({
          status: "processing",
          notes: `${order.notes || ""} | DataHub status: ${dataObj?.statusDescription || status}`,
          updated_at: new Date().toISOString(),
        })
        .eq("id", order.id);

      return json({ ok: true, updated: "processing", orderId: order.id });
    }

    if (isSuccess) {
      if (order.status !== "delivered") {
        await admin
          .from("orders")
          .update({
            status: "delivered",
            notes: `${order.notes || ""} | DataHub update: ${dataObj?.statusDescription || status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        // Trigger success SMS when provider webhook confirms delivery!
        const smsPhone = order.customer?.phone || order.recipient_phone;
        if (smsPhone) {
          await sendSMS({
            to: smsPhone,
            message: `Your OneGig order for ${order.recipient_phone} has been delivered successfully! Thank you for choosing OneGig.`,
          }).catch((err) => console.error("SMS notification error:", err));
        }

        if (order.customer_user_id) {
          await sendWebPushNotification(admin, {
            userId: order.customer_user_id,
            title: "Order Delivered!",
            body: `Your data bundle order for ${order.recipient_phone} was completed.`,
          }).catch((err) => console.error("Push notification error:", err));
        }
      }

      return json({ ok: true, updated: "delivered", orderId: order.id });
    }

    if (isFailure || status === "REFUNDED") {
      const finalStatus = status === "REFUNDED" ? "refunded" : "failed";
      if (order.status !== finalStatus && order.status !== "refunded") {
        await admin
          .from("orders")
          .update({
            status: finalStatus,
            notes: `${order.notes || ""} | DataHub update: ${dataObj?.statusDescription || status}`,
            updated_at: new Date().toISOString(),
          })
          .eq("id", order.id);

        // 1. Refund agent wallet if applicable
        if (order.agent_id && Number(order.sell_price || 0) > 0) {
          const { data: agProf } = await admin
            .from("profiles")
            .select("wallet_balance")
            .eq("id", order.agent_id)
            .single();

          if (agProf) {
            const newBal = Number(agProf.wallet_balance || 0) + Number(order.sell_price);
            await admin
              .from("profiles")
              .update({ wallet_balance: newBal })
              .eq("id", order.agent_id);

            await admin.from("wallet_transactions").insert({
              user_id: order.agent_id,
              type: "credit",
              amount: Number(order.sell_price),
              description: `Refund for failed/refunded order #${order.id.slice(0, 8)}`,
              balance_after: newBal,
            });
          }
        }

        // 2. Refund customer wallet if customer placed order with wallet balance
        if (order.customer_user_id && order.customer_user_id !== order.agent_id && Number(order.sell_price || 0) > 0) {
          const { data: custProf } = await admin
            .from("profiles")
            .select("wallet_balance")
            .eq("id", order.customer_user_id)
            .maybeSingle();

          if (custProf) {
            const newBal = Number(custProf.wallet_balance || 0) + Number(order.sell_price);
            await admin
              .from("profiles")
              .update({ wallet_balance: newBal })
              .eq("id", order.customer_user_id);

            await admin.from("wallet_transactions").insert({
              user_id: order.customer_user_id,
              type: "credit",
              amount: Number(order.sell_price),
              description: `Automated Wallet Refund for order #${order.id.slice(0, 8)}`,
              balance_after: newBal,
            });
          }
        }

        return json({ ok: true, updated: finalStatus, orderId: order.id });
      }
    }

    return json({ ok: true, status: "unchanged", orderId: order.id });
  } catch (err: any) {
    console.error("DataHub webhook error:", err);
    return json({ error: err.message || "Internal server error" }, 500);
  }
});
