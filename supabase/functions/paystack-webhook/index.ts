import { getPaystackSecretKey } from "../_shared/settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-paystack-signature",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const paystackSecret = await getPaystackSecretKey();
    if (!paystackSecret) return json({ error: "Missing Paystack secret" }, 500);

    const signature = req.headers.get("x-paystack-signature") ?? "";
    const raw = await req.text();

    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(paystackSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );

    const hashBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
    const expected = toHex(new Uint8Array(hashBuffer));

    if (!signature || signature !== expected) {
      return json({ error: "Invalid signature" }, 401);
    }

    const event = JSON.parse(raw);
    if (event?.event !== "charge.success") {
      return json({ ok: true, ignored: true });
    }

    const reference = String(event?.data?.reference ?? "").trim();
    if (!reference) return json({ error: "Missing reference" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const verifyRes = await fetch(`${supabaseUrl}/functions/v1/paystack-verify`, {
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
    console.error("paystack-webhook error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
