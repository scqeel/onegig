import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://huvuogyvgeoqiqltbgcw.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data: profiles, error: pErr } = await supabase.from('profiles').select('id').eq('email', 'tabuaaeunice780@gmail.com');
  
  if (pErr) {
    console.error("Failed to fetch user:", pErr);
    return;
  }
  
  if (!profiles || profiles.length === 0) {
    console.error("User not found with that email!");
    return;
  }
  
  const userId = profiles[0].id;
  console.log("Found user ID:", userId);
  
  const { data: roleData, error: roleErr } = await supabase.from('user_roles').upsert({
    user_id: userId,
    role: 'admin'
  });
  
  if (roleErr) {
    console.error("Failed to make admin:", roleErr);
  } else {
    console.log("Successfully made the user an admin!");
  }
}
run();
