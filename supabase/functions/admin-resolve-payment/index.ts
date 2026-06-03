import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { sendSMS } from "../_shared/sms.ts";
import { sendWebPushNotification } from "../_shared/push.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function activateAgent(admin: ReturnType<typeof createClient>, userId: string, refSlug?: string | null) {
  console.log(`Activating agent with userId: ${userId}`);

  let parentAgentId = null;
  if (refSlug) {
    const { data: parentAgent } = await admin
      .from("agent_profiles")
      .select("id")
      .eq("store_slug", refSlug)
      .maybeSingle();
    if (parentAgent?.id) {
      parentAgentId = parentAgent.id;
    }
  }
  
  if (!parentAgentId) {
    const { data: prof } = await admin
      .from("profiles")
      .select("referred_by")
      .eq("id", userId)
      .maybeSingle();
      
    if (prof?.referred_by) {
      const { data: parentAgent } = await admin
        .from("agent_profiles")
        .select("id")
        .eq("user_id", prof.referred_by)
        .maybeSingle();
      if (parentAgent?.id) {
        parentAgentId = parentAgent.id;
      }
    }
  }

  const { data: existingAgent, error: checkErr } = await admin
    .from("agent_profiles")
    .select("id, activation_paid, store_slug, store_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (checkErr) {
    console.error("Error checking existing agent profile:", checkErr);
  }

  let finalAgentId = existingAgent?.id || null;

  if (existingAgent) {
    if (existingAgent.activation_paid) {
      await admin.from("user_roles").upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
      return existingAgent.id;
    }

    const { data: updatedAgent, error: updateErr } = await admin
      .from("agent_profiles")
      .update({
        activation_paid: true,
        activation_paid_at: new Date().toISOString(),
        parent_agent_id: parentAgentId,
      })
      .eq("id", existingAgent.id)
      .select("id")
      .single();
    
    if (updateErr) {
      console.error("Error updating agent profile:", updateErr);
    }
    
    finalAgentId = updatedAgent?.id || existingAgent.id;
  } else {
    // Create new agent profile
    const storeSlug = `agent-${userId.split("-")[0]}-${Date.now().toString().slice(-4)}`;
    const storeName = `Agent Store ${userId.split("-")[0]}`;
    
    const { data: newAgent, error: insertErr } = await admin
      .from("agent_profiles")
      .insert({
        user_id: userId,
        store_name: storeName,
        store_slug: storeSlug,
        activation_paid: true,
        activation_paid_at: new Date().toISOString(),
        parent_agent_id: parentAgentId,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Error inserting agent profile:", insertErr);
    }
    
    finalAgentId = newAgent?.id || null;
  }

  // 1. Grant agent role
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });

  if (roleErr) {
    console.error("Error setting agent role:", roleErr);
  }

  // 2. Insert transaction for activation fee
  const { data: feeRow } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", "agent_activation_fee")
    .maybeSingle();

  const activationFee = Number(feeRow?.value ?? 50);

  const { error: txErr } = await admin.from("wallet_transactions").insert({
    user_id: userId,
    type: "activation_fee",
    amount: activationFee,
    status: "completed",
    description: "Agent Account Activation Fee",
  });

  if (txErr) {
    console.error("Error inserting activation fee transaction:", txErr);
  }

  // 3. Referral reward split
  if (parentAgentId) {
    const { data: parentAgentRow } = await admin
      .from("agent_profiles")
      .select("user_id")
      .eq("id", parentAgentId)
      .maybeSingle();

    if (parentAgentRow?.user_id) {
      const reward = activationFee * 0.40; // 40% referral bonus
      const { error: refTxErr } = await admin.from("wallet_transactions").insert({
        user_id: parentAgentRow.user_id,
        type: "earning",
        amount: reward,
        status: "completed",
        description: `Referral Bonus: Downline Agent Activation (${userId})`,
      });

      if (refTxErr) {
        console.error("Error inserting referral reward transaction:", refTxErr);
      } else {
        // Send SMS/Push notifications to recruiter
        const { data: parentProf } = await admin
          .from("profiles")
          .select("phone")
          .eq("id", parentAgentRow.user_id)
          .maybeSingle();

        if (parentProf?.phone) {
          sendSMS({
            to: parentProf.phone,
            message: `Congratulations! You have received GHS ${reward.toFixed(2)} referral bonus for activating a new agent.`,
          }).catch((e) => console.error("SMS error:", e));
        }

        await admin.from("app_notifications").insert({
          title: "Referral Bonus Earned!",
          message: `You earned GHS ${reward.toFixed(2)} referral bonus for downline agent activation.`,
          type: "success",
          sound_name: "paystack",
          target_user_id: parentAgentRow.user_id,
          is_global: false
        });

        await sendWebPushNotification(admin, parentAgentRow.user_id, {
          title: "Referral Bonus Earned!",
          message: `You earned GHS ${reward.toFixed(2)} referral bonus.`,
          url: "/agent"
        }).catch((e) => console.error("Push notification error:", e));
      }
    }
  }

  return finalAgentId;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: corsHeaders });

  try {
    const { payment_id } = await req.json();
    if (!payment_id) return new Response(JSON.stringify({ error: "payment_id required" }), { status: 400, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: ud } = await userClient.auth.getUser();
    const userId = ud.user?.id;
    if (!userId) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // Fetch payment
    const { data: payment } = await admin.from("payments").select("*").eq("id", payment_id).maybeSingle();
    if (!payment) return new Response(JSON.stringify({ error: "Payment not found" }), { status: 404, headers: corsHeaders });

    if (payment.status === "paid") {
      return new Response(JSON.stringify({ ok: true, message: "Payment already marked as paid" }), { headers: corsHeaders });
    }

    let pLoad = payment.payload;
    if (typeof pLoad === "string") {
      try { pLoad = JSON.parse(pLoad); } catch(e) { pLoad = {}; }
    }
    
    // Clear the error message and set a resolved flag
    if (pLoad && typeof pLoad === "object") {
      delete (pLoad as any).error_message;
      (pLoad as any).resolved_manually = true;
    }

    // Perform manual resolution side effects
    if (payment.purpose === "wallet_deposit") {
      const depUserId = payment.user_id;
      if (!depUserId) return new Response(JSON.stringify({ error: "Missing user ID for deposit" }), { status: 400, headers: corsHeaders });
      
      const depositAmount = Number(pLoad?.deposit_amount || payment.amount);
      const { error: wErr } = await admin.from("wallet_transactions").insert({
        user_id: depUserId,
        type: "deposit",
        amount: depositAmount,
        status: "completed",
        description: `Wallet Deposit (Manually Resolved: ${payment.reference})`,
      });

      if (wErr) {
        console.error("Manual resolution wallet deposit insert failed:", wErr);
        return new Response(JSON.stringify({ error: "Failed to credit wallet: " + wErr.message }), { status: 500, headers: corsHeaders });
      }

      // Send SMS
      const { data: uProf } = await admin.from("profiles").select("phone").eq("id", depUserId).maybeSingle();
      if (uProf?.phone) {
        sendSMS({ to: uProf.phone, message: `Your OneGig wallet deposit of GHS ${depositAmount} was successful (resolved manually)!` }).catch((err) => console.error("SMS Error:", err));
      }
    }

    if (payment.purpose === "agent_activation") {
      const actUserId = payment.user_id;
      if (!actUserId) return new Response(JSON.stringify({ error: "Missing user ID for activation" }), { status: 400, headers: corsHeaders });
      try {
        await activateAgent(admin, String(actUserId), pLoad?.ref_slug || null);
      } catch (err: any) {
        console.error("Manual resolution agent activation failed:", err);
        return new Response(JSON.stringify({ error: "Failed to activate agent: " + err.message }), { status: 500, headers: corsHeaders });
      }
    }

    // Mark as paid
    await admin.from("payments").update({ status: "paid", payload: pLoad }).eq("id", payment_id);

    return new Response(JSON.stringify({ ok: true, payment: { ...payment, status: "paid", payload: pLoad } }), { headers: corsHeaders });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
