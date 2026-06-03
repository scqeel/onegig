import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("Invoking deployed theteller-verify function with mock reference...");
  const { data, error } = await supabase.functions.invoke('theteller-verify', {
    body: { reference: "DEBUG_DB", debug_query: true }
  });
  
  console.log("Response Data:", data);
  console.log("Response Error:", error);
}

run();
