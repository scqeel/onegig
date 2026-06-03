import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export async function getAppSetting(key: string): Promise<string> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceKey);

  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  return data?.value ? String(data.value) : "";
}

export async function getPaystackSecretKey(): Promise<string> {
  const envVal = Deno.env.get("PAYSTACK_SECRET_KEY") ||
                 Deno.env.get("PAYSTACK_SECRET") ||
                 Deno.env.get("PAYSTACK_LIVE_SECRET_KEY");
  if (envVal) return envVal;
  return await getAppSetting("paystack_secret_key");
}

export async function getTellerMerchantId(): Promise<string> {
  const envVal = Deno.env.get("THETELLER_MERCHANT_ID");
  if (envVal) return envVal;
  return await getAppSetting("theteller_merchant_id");
}

export async function getTellerApiKey(): Promise<string> {
  const envVal = Deno.env.get("THETELLER_API_KEY");
  const rawKey = envVal || (await getAppSetting("theteller_api_key"));
  if (!rawKey) return "";
  
  const trimmed = rawKey.trim();
  if (trimmed.length === 32 && /^[a-f0-9]+$/i.test(trimmed)) {
    return trimmed;
  }
  
  try {
    const decoded = atob(trimmed);
    if (decoded.length === 32 && /^[a-f0-9]+$/i.test(decoded)) {
      return decoded;
    }
  } catch (e) {
    // Ignore and fallback
  }
  
  return trimmed;
}
