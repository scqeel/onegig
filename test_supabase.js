import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log("Creating dummy sub-agent...");
  
  const parentSlug = "kwatester";
  const { data: parent } = await supabase.from("agent_profiles").select("id").eq("store_slug", parentSlug).single();
  
  if (!parent) {
    console.error("Could not find parent agent kwatester");
    return;
  }
  
  console.log("Found parent agent ID:", parent.id);

  // For testing, just sign up a new user via auth api
  const email = `subagent_${Date.now()}@test.com`;
  const password = "password123";
  
  console.log("Signing up user:", email);
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: "Sub Agent Tester", phone: "0500000000" }
    }
  });

  if (authErr) {
    console.error("Auth Error:", authErr);
    return;
  }

  const userId = authData.user.id;
  console.log("User created:", userId);

  // The triggers might create the profile automatically, but we need to create the agent profile.
  // We'll wait a second for triggers to finish
  await new Promise(resolve => setTimeout(resolve, 1000));

  console.log("Creating agent profile...");
  const { error: apErr } = await supabase.from("agent_profiles").insert({
    user_id: userId,
    store_name: "Sub Agent Store",
    store_slug: `subagent-${Date.now()}`,
    activation_paid: true,
    activation_paid_at: new Date().toISOString(),
    parent_agent_id: parent.id
  });

  if (apErr) console.error("Agent profile error:", apErr);

  console.log("Adding agent role...");
  const { error: roleErr } = await supabase.from("user_roles").upsert({
    user_id: userId,
    role: "agent"
  }, { onConflict: "user_id,role" });
  
  if (roleErr) console.error("Role error:", roleErr);

  console.log("Success! Sub-agent created.");
  console.log("Email:", email);
  console.log("Password:", password);
}

test();
