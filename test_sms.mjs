import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://huvuogyvgeoqiqltbgcw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const email = `test+${Date.now()}@example.com`;
  const password = "Password123!";
  const phone = "+233555" + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  console.log("Signing up with email...");
  const { data: { user, session }, error: signUpError } = await supabase.auth.signUp({
    email,
    password
  });

  if (signUpError) {
    console.error("Sign up error:", signUpError);
    return;
  }

  console.log("Updating phone number:", phone);
  const { error: updateError, data } = await supabase.auth.updateUser({ phone });

  if (updateError) {
    console.error("Update error:", updateError);
  } else {
    console.log("Update success:", data);
  }
}

test();
