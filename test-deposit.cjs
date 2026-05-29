const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDeposit() {
  console.log('Initiating deposit...');
  
  // Fake login as user (or use anon key if allowed)
  // Let's just invoke the function. We don't have a user token, so it might fail with 401.
  // Wait, paystack-process requires authentication: "Authentication required for wallet deposit"
  // Let me login as a user first.
  const { data: authData, error: authErr } = await supabase.auth.signInWithPassword({
    email: 'test@mtopup.shop',
    password: 'password123'
  });
  
  if (authErr) {
    console.log('Login failed, trying to create user...');
    await supabase.auth.signUp({
      email: 'test@mtopup.shop',
      password: 'password123'
    });
    const { data: authData2 } = await supabase.auth.signInWithPassword({
      email: 'test@mtopup.shop',
      password: 'password123'
    });
    if (!authData2.session) return console.error('Could not authenticate');
  }

  console.log('Invoking paystack-process...');
  const { data: processData, error: processErr } = await supabase.functions.invoke('paystack-process', {
    body: {
      purpose: 'wallet_deposit',
      amount: 1,
      momo_number: '0241234567',
      momo_network: 'MTN',
    }
  });

  console.log('Process Result:', processData, processErr);

  if (processData?.reference) {
    const ref = processData.reference;
    console.log('Polling paystack-verify with reference:', ref);
    
    // Simulate polling
    for (let i = 0; i < 3; i++) {
      const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('paystack-verify', {
        body: { reference: ref }
      });
      console.log('Verify Result:', verifyData, verifyErr);
      if (verifyData?.ok) break;
      await new Promise(r => setTimeout(r, 4000));
    }
  }
}

testDeposit().catch(console.error);
