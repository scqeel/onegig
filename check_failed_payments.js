import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function run() {
  const sql = `
    SELECT id, reference, purpose, amount, status, payload, created_at 
    FROM public.payments 
    WHERE status = 'failed'
    ORDER BY created_at DESC 
    LIMIT 20;
  `;
  
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/debug-db?exec_sql=${encodeURIComponent(sql)}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey
      }
    });
    
    const data = await res.json();
    console.log("=== FAILED PAYMENTS ===");
    if (data.ok && data.result?.rows) {
      data.result.rows.forEach(p => {
        console.log(`ID: ${p.id} | Ref: ${p.reference} | Purpose: ${p.purpose} | Amount: ${p.amount} | Created: ${p.created_at} | Payload: ${JSON.stringify(p.payload)}`);
      });
    } else {
      console.log("No failed payments found or error querying.");
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
