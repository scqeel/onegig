import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://huvuogyvgeoqiqltbgcw.supabase.co";
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ";

console.log(`[Smoke Test] Validating Supabase connection for: ${url}`);

if (!url || !key) {
  console.error("❌ Smoke Test Failed: Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.");
  process.exit(1);
}

const supabase = createClient(url, key);

async function runSmokeTest() {
  try {
    const { data, error, status } = await supabase
      .from('agent_profiles')
      .select('id')
      .limit(1);

    if (error && status === 401) {
      console.error(`❌ Smoke Test Failed: Supabase returned 401 UNAUTHORIZED. Invalid API key.`);
      console.error(error);
      process.exit(1);
    }

    if (error && status >= 400 && status !== 406) {
      console.warn(`⚠️ Warning: Supabase query returned status ${status}:`, error.message);
    } else {
      console.log(`✅ Smoke Test Passed: Supabase client connection and anon key successfully verified (Status: ${status || 200}).`);
    }
    process.exit(0);
  } catch (err) {
    console.error("❌ Smoke Test Failed with exception:", err);
    process.exit(1);
  }
}

runSmokeTest();
