import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://lsocdjpflecduumopijn.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || 'your_anon_key'; // Wait, I don't need anon key if I just want to ping the REST endpoint if it's deployed. But it's edge function!

async function test() {
  const resp = await fetch(SUPABASE_URL + '/functions/v1/paystack-verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reference: 'test' }) // Just to see if it responds
  });
  console.log(await resp.text());
}
test();
