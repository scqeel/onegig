import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function run() {
  const reference = "435412759663";
  const sql = `
    SELECT id, reference, purpose, amount, status, payload, created_at 
    FROM public.payments 
    WHERE reference = '${reference}'
    LIMIT 1;
  `;
  
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/debug-db`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${supabaseKey}`,
        "apikey": supabaseKey
      },
      body: JSON.stringify({ exec_sql: sql })
    });
    
    const data = await res.json();
    console.log("=== DETAILED PAYMENT ROW FROM EDGE ===");
    if (data.ok && data.result?.rows?.length > 0) {
      console.log(JSON.stringify(data.result.rows[0], null, 2));
    } else {
      console.log(`Payment with reference '${reference}' not found or error occurred.`);
    }
  } catch (e) {
    console.error("Error:", e.message);
  }
}

run();
