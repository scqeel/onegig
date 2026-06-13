import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const settingsCache = new Map<string, string>();

// Global admin client cached for reuse across requests
let cachedAdminClient: any = null;
function getAdminClient(url: string, key: string) {
  if (!cachedAdminClient) {
    cachedAdminClient = createClient(url, key);
  }
  return cachedAdminClient;
}

export async function getAppSetting(key: string): Promise<string> {
  if (settingsCache.has(key)) {
    return settingsCache.get(key)!;
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = getAdminClient(supabaseUrl, serviceKey);

  const { data } = await admin
    .from("app_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();

  const val = data?.value ? String(data.value) : "";
  settingsCache.set(key, val);
  return val;
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

export async function getTellerApiUser(): Promise<string> {
  const envVal = Deno.env.get("THETELLER_API_USER");
  if (envVal) return envVal;
  const dbVal = await getAppSetting("theteller_api_user");
  if (dbVal) return dbVal;
  return await getTellerMerchantId();
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
