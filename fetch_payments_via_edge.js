import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function executeSql(sql) {
  const url = `${supabaseUrl}/functions/v1/debug-db?exec_sql=${encodeURIComponent(sql)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseKey}`,
      "apikey": supabaseKey
    }
  });
  const data = await res.json();
  if (!data.ok) {
    throw new Error(data.error || "Query failed");
  }
  return data.result.rows;
}

async function run() {
  console.log("Fetching database stats via debug-db Edge Function...");
  try {
    const payments = await executeSql("SELECT id, reference, amount, status, purpose, payload, created_at FROM public.payments ORDER BY created_at DESC LIMIT 10;");
    console.log("\n=== PAYMENTS FROM EDGE FUNCTION ===");
    payments.forEach(p => {
      console.log(`ID: ${p.id} | Ref: ${p.reference} | Amount: ${p.amount} | Status: ${p.status} | Purpose: ${p.purpose} | Payload: ${JSON.stringify(p.payload)} | Created: ${p.created_at}`);
    });
    
    const txs = await executeSql("SELECT id, type, amount, status, description, created_at FROM public.wallet_transactions ORDER BY created_at DESC LIMIT 10;");
    console.log("\n=== WALLET TRANSACTIONS FROM EDGE FUNCTION ===");
    txs.forEach(t => {
      console.log(`ID: ${t.id} | Type: ${t.type} | Amount: ${t.amount} | Status: ${t.status} | Desc: ${t.description} | Created: ${t.created_at}`);
    });
    
    const profiles = await executeSql("SELECT id, full_name, email, phone, wallet_balance, created_at FROM public.profiles ORDER BY created_at DESC LIMIT 5;");
    console.log("\n=== LATEST PROFILES ===");
    console.log(JSON.stringify(profiles, null, 2));
    
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
