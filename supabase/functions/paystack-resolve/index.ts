import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaystackSecretKey } from "../_shared/settings.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function toPaystackBankCode(code: string) {
  const normalized = String(code || "").trim().toUpperCase();
  if (["MTN", "M"].includes(normalized)) return "MTN";
  if (["TELECEL", "VODAFONE", "VODA", "VOD", "T", "TCL"].includes(normalized)) return "VOD";
  if (["AIRTELTIGO", "AT", "AIRTEL", "TIGO", "A"].includes(normalized)) return "ATL";
  return "MTN";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json();
    if (!body?.momo_number || !body?.momo_network) {
      return json({ error: "momo_number and momo_network are required" }, 400);
    }

    const paystackSecret = await getPaystackSecretKey();
    if (!paystackSecret) {
      return json({ error: "Missing Paystack secrets. Set PAYSTACK_SECRET_KEY." }, 500);
    }
    
    // Test bypass - if using test keys, resolving won't work correctly for real numbers
    // But Paystack might return a dummy name.
    
    const bankCode = toPaystackBankCode(body.momo_network);
    const accountNumber = body.momo_number.replace(/\D/g, "");

    const resolveRes = await fetch(`https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
      },
    });

    const resolveData = await resolveRes.json();
    
    if (!resolveRes.ok || !resolveData?.status) {
      return json({ error: resolveData?.message ?? "Unable to resolve account" }, 200);
    }

    return json({
      ok: true,
      account_name: resolveData.data?.account_name,
    });
  } catch (e: any) {
    console.error("paystack-resolve error", e);
    return json({ error: e?.message ?? "Internal error" }, 500);
  }
});
