import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  
  console.log("PAYSTACK RECONCILE ENGINE INVOKED!");

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // 1. Fetch payments that are still "initialized" (stuck) from the last 6 hours
    // (excluding the last 3 minutes to avoid race conditions with standard polling/checkout)
    const threeMinutesAgo = new Date(Date.now() - 3 * 60 * 1000).toISOString();
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

    const { data: stuckPayments, error: fetchErr } = await admin
      .from("payments")
      .select("id, reference, amount")
      .eq("status", "initialized")
      .gte("created_at", sixHoursAgo)
      .lte("created_at", threeMinutesAgo)
      .order("created_at", { ascending: true })
      .limit(15);

    if (fetchErr) {
      console.error("Failed to fetch stuck payments:", fetchErr.message);
      return json({ error: fetchErr.message }, 500);
    }

    if (!stuckPayments || stuckPayments.length === 0) {
      console.log("No stuck payments found for reconciliation.");
      return json({ ok: true, reconciled: 0, message: "No pending payments found." });
    }

    console.log(`Found ${stuckPayments.length} stuck payments. Starting auto-reconciliation...`);
    const results = [];

    // 2. Iterate and invoke paystack-verify for each reference
    for (const p of stuckPayments) {
      console.log(`Reconciling payment Ref: ${p.reference} (Amount: GHS ${p.amount})...`);
      
      try {
        const verifyRes = await fetch(`${supabaseUrl}/functions/v1/paystack-verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ reference: p.reference }),
        });

        const text = await verifyRes.text();
        let parsedData: any = {};
        try { parsedData = text ? JSON.parse(text) : {}; } catch { parsedData = { raw: text }; }

        console.log(`Reconciliation result for ${p.reference}: HTTP ${verifyRes.status}`, parsedData);
        results.push({
          reference: p.reference,
          status: verifyRes.status,
          response: parsedData,
        });
      } catch (err: any) {
        console.error(`Failed to reconcile payment ${p.reference}:`, err.message);
        results.push({
          reference: p.reference,
          error: err.message,
        });
      }
    }

    return json({
      ok: true,
      reconciledCount: stuckPayments.length,
      details: results,
    });
  } catch (e: any) {
    console.error("paystack-reconcile error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
