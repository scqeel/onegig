import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://lsocdjpflecduumopijn.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function test() {
  const { data, error } = await supabase
    .from("wallet_transactions")
    .insert({
      user_id: 'a8726bc5-9c59-4dff-ba61-ec853c0d4529', // I need a valid UUID, let's just fetch one first
      type: "adjustment",
      amount: 50,
      status: "completed",
      description: `Test`,
    });
  console.log("Insert result:", { data, error });
}

async function run() {
  const { data: users } = await supabase.from('profiles').select('id').limit(1);
  if (users?.length) {
    const { data, error } = await supabase
      .from("wallet_transactions")
      .insert({
        user_id: users[0].id,
        type: "adjustment",
        amount: 50,
        status: "completed",
        description: `Test`,
      });
    console.log("Insert result:", { data, error });
  }
}
run();
