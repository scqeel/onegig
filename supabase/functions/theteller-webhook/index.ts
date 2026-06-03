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
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const event = await req.json();
    
    // theTeller webhook payload contains 'transaction_id' as the reference
    const reference = String(event?.transaction_id || event?.reference || "").trim();
    if (!reference) return json({ error: "Missing reference" }, 400);

    const status = String(event?.status || "").toLowerCase();
    const code = String(event?.code || "");
    
    // We only trigger verification for successful/approved codes '000'
    if (code !== "000" && status !== "approved" && status !== "success") {
      return json({ ok: true, ignored: true, reason: `Ignored status ${status} / code ${code}` });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Invoke theteller-verify edge function to securely verify and fulfill the order
    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/theteller-verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
        apikey: serviceKey,
      },
      body: JSON.stringify({ reference }),
    });

    const verifyData = await verifyRes.json().catch(() => ({}));
    if (!verifyRes.ok) {
      return json({ error: verifyData?.error ?? "Verification failed" }, 500);
    }

    return json({ ok: true, verified: true, reference });
  } catch (e: any) {
    console.error("theteller-webhook error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
