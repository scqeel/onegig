import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://huvuogyvgeoqiqltbgcw.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

async function test() {
  const phone = "+233555" + Math.floor(Math.random() * 1000000).toString().padStart(6, '0');

  console.log("Signing in with OTP:", phone);
  const { data, error } = await supabase.auth.signInWithOtp({
    phone
  });

  if (error) {
    console.error("Sign in OTP error:", error);
  } else {
    console.log("Sign in OTP success:", data);
  }
}

test();
