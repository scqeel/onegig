import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function slugify(v: string) {
  return v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "agent-store";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);

  const { user_id } = await req.json();
  if (!user_id) return json({ error: "user_id required" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: ud } = await userClient.auth.getUser();
  if (!ud.user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: canAdmin } = await admin.rpc("has_role", { _user_id: ud.user.id, _role: "admin" });
  if (!canAdmin) return json({ error: "Forbidden" }, 403);

  const { data: profile } = await admin.from("profiles").select("full_name, username, referred_by").eq("id", user_id).maybeSingle();
  if (!profile) return json({ error: "User profile not found" }, 404);

  const baseSlug = slugify(profile.username || profile.full_name || `agent-${user_id.slice(0, 6)}`);
  let slug = baseSlug;
  let i = 0;
  while (true) {
    const { data: exists } = await admin.from("agent_profiles").select("id").eq("store_slug", slug).maybeSingle();
    if (!exists) break;
    i += 1;
    slug = `${baseSlug}-${i}`;
    if (i > 100) break;
  }

  let parentAgentId = null;
  if (profile.referred_by) {
    const { data: parentAgent } = await admin
      .from("agent_profiles")
      .select("id")
      .eq("user_id", profile.referred_by)
      .maybeSingle();
    if (parentAgent?.id) {
      parentAgentId = parentAgent.id;
    }
  }

  const { error: profileErr } = await admin.from("agent_profiles").upsert(
    {
      user_id,
      store_slug: slug,
      store_name: `${profile.full_name || "My"} Store`,
      activation_paid: true,
      activation_paid_at: new Date().toISOString(),
      parent_agent_id: parentAgentId,
    },
    { onConflict: "user_id" }
  );
  if (profileErr) return json({ error: profileErr.message }, 500);

  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id, role: "agent" }, { onConflict: "user_id,role" });
  if (roleErr) return json({ error: roleErr.message }, 500);

  return json({ ok: true });
});
