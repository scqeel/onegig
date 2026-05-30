import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").slice(0, 40) || "store";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const userId = ud.user.id;

  const { data: profile } = await admin.from("profiles").select("full_name, username, phone").eq("id", userId).maybeSingle();

  // Activation fee
  const { data: feeRow } = await admin.from("app_settings").select("value").eq("key", "agent_activation_fee").maybeSingle();
  const fee = Number(feeRow?.value ?? 50);

  console.log(`Mock Activating agent with userId: ${userId}`);

  // 1. Check if they already have an agent profile record
  const { data: existingAgent, error: checkErr } = await admin
    .from("agent_profiles")
    .select("id, activation_paid, store_slug, store_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (checkErr) {
    console.error("Error checking existing agent profile:", checkErr);
  }

  let finalAgentId = existingAgent?.id || null;
  let finalAgent = existingAgent;

  if (existingAgent) {
    console.log(`User already has an agent profile (id: ${existingAgent.id}, paid: ${existingAgent.activation_paid})`);
    
    if (existingAgent.activation_paid) {
      console.log("Agent profile already marked as active. Ensuring role...");
      await admin.from("user_roles").upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
      return json({ ok: true, agent: existingAgent });
    }

    // Update existing inactive profile to active
    console.log("Updating existing agent profile to paid...");
    const { data: updatedAgent, error: updateErr } = await admin
      .from("agent_profiles")
      .update({
        activation_paid: true,
        activation_paid_at: new Date().toISOString(),
      })
      .eq("id", existingAgent.id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("Error updating existing agent profile:", updateErr);
      return json({ error: updateErr.message }, 500);
    }
    finalAgentId = updatedAgent?.id;
    finalAgent = updatedAgent;
  } else {
    // Create new profile
    console.log("No existing agent profile found. Creating a new one...");
    const baseSlug = slugify(profile?.username || profile?.full_name || `agent-${userId.slice(0, 6)}`);
    let slug = baseSlug;
    let n = 0;
    while (true) {
      const { data: exists } = await admin.from("agent_profiles").select("id").eq("store_slug", slug).maybeSingle();
      if (!exists) break;
      n++;
      slug = `${baseSlug}-${n}`;
      if (n > 50) break;
    }

    console.log(`Inserting new agent profile with slug: ${slug}`);
    const { data: newAgent, error: insertErr } = await admin
      .from("agent_profiles")
      .insert({
        user_id: userId,
        store_slug: slug,
        store_name: `${profile?.full_name || "My"} Store`,
        activation_paid: true,
        activation_paid_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insertErr) {
      console.error("Error inserting new agent profile:", insertErr);
      return json({ error: insertErr.message }, 500);
    }
    finalAgentId = newAgent?.id;
    finalAgent = newAgent;
  }

  // 2. Ensure they have the agent user role
  console.log("Upserting agent role in user_roles...");
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: userId, role: "agent" }, { onConflict: "user_id,role" });
  if (roleErr) {
    console.error("Error upserting user role:", roleErr);
    return json({ error: roleErr.message }, 500);
  }

  // 3. Mock payment: log activation fee transaction
  await admin.from("wallet_transactions").insert({
    user_id: userId,
    type: "activation_fee",
    amount: fee,
    status: "completed",
    description: "Agent activation (mock pay)",
  });

  // 4. Seed default agent bundle prices (base + 1 cedi markup)
  console.log("Seeding default agent bundle prices...");
  const { data: bundles } = await admin.from("bundles").select("id, base_price").eq("active", true);
  if (bundles?.length && finalAgentId) {
    const rows = bundles.map((b: any) => ({
      agent_id: finalAgentId,
      bundle_id: b.id,
      sell_price: Number(b.base_price) + 1,
      active: true,
    }));
    const { error: priceErr } = await admin
      .from("agent_bundle_prices")
      .upsert(rows, { onConflict: "agent_id,bundle_id" });
    if (priceErr) {
      console.error("Error seeding bundle prices:", priceErr);
    } else {
      console.log("Successfully seeded bundle prices!");
    }
  }

  console.log("Mock Activation completed successfully!");
  return json({ ok: true, agent: finalAgent });
});