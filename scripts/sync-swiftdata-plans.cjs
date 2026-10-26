const debugUrl = "https://huvuogyvgeoqiqltbgcw.supabase.co/functions/v1/debug-db";
const debugKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ";

const SWIFTDATA_BASE_URL = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
const SWIFTDATA_API_KEY = "swft_live_a3c720d5a4d845a68092ffdf147fde54";

async function runSql(sql) {
  const res = await fetch(debugUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${debugKey}`,
      "apikey": debugKey
    },
    body: JSON.stringify({ exec_sql: sql })
  });
  return await res.json();
}

const extractGb = (label) => {
  const match = String(label).match(/(\d+(?:\.\d+)?)\s*(gb)/i);
  if (match) return Number(match[1]);
  const matchMb = String(label).match(/(\d+(?:\.\d+)?)\s*(mb)/i);
  if (matchMb) return Number(matchMb[1]) / 1024;
  return null;
};

const getNetworkId = (netCode) => {
  const normalized = String(netCode).toLowerCase();
  if (normalized === "yello" || normalized === "mtn") return "ee41ae80-e124-4cf7-8007-ef26c99e6be7";
  if (normalized === "telecel" || normalized === "red") return "a169c4f5-de22-4a3e-b6b1-05635ac10c1d";
  if (normalized === "at_ishare" || normalized === "at_bigtime" || normalized === "blue" || normalized === "at") {
    return "95d17299-3cd8-4d15-9d3e-47009ee8edda";
  }
  return null;
};

const getPrettyNetworkName = (netCode) => {
  const normalized = String(netCode).toLowerCase();
  if (normalized === "yello" || normalized === "mtn") return "MTN";
  if (normalized === "telecel" || normalized === "red") return "Telecel";
  if (normalized === "at_ishare") return "AirtelTigo iShare";
  if (normalized === "at_bigtime") return "AirtelTigo Bigtime";
  if (normalized === "blue" || normalized === "at") return "AirtelTigo";
  return netCode;
};

async function syncBackend() {
  console.log("========================================================");
  console.log("🚀 Syncing OneGig Backend with SwiftData API...");
  console.log("========================================================");

  // 1. Fetch live plans from SwiftData Developer API
  console.log(`\n1. Fetching live packages from SwiftData API (${SWIFTDATA_BASE_URL}/plans)...`);
  const plansRes = await fetch(`${SWIFTDATA_BASE_URL}/plans`, {
    headers: {
      "Authorization": `Bearer ${SWIFTDATA_API_KEY}`,
      "X-API-Key": SWIFTDATA_API_KEY,
      "Content-Type": "application/json"
    }
  });

  if (!plansRes.ok) {
    throw new Error(`SwiftData API returned HTTP ${plansRes.status}: ${await plansRes.text()}`);
  }

  const plansData = await plansRes.json();
  if (!plansData.success || !Array.isArray(plansData.plans)) {
    throw new Error("Invalid response format from SwiftData plans endpoint.");
  }
  console.log(`✓ Received ${plansData.plans.length} total packages from SwiftData API.`);

  // 2. Fetch current bundles from OneGig database
  console.log("\n2. Fetching current bundles from OneGig database...");
  const dbBundlesRes = await runSql(`
    SELECT b.id, b.network_id, n.code as network_code, b.size_label, b.size_mb, b.base_price, b.user_price, b.active, b.sort_order
    FROM public.bundles b
    LEFT JOIN public.networks n ON b.network_id = n.id
    ORDER BY n.code, b.size_mb;
  `);

  if (!dbBundlesRes.ok) {
    throw new Error(`Failed to query database: ${dbBundlesRes.error}`);
  }

  const dbBundles = dbBundlesRes.result.rows;
  console.log(`✓ Found ${dbBundles.length} existing bundles in OneGig database.`);

  // 3. Match and calculate updated prices
  console.log("\n3. Calculating updated bundle pricing and margins...");
  const syncedBundles = [];
  const unmatchedPlans = [];

  for (const pkg of plansData.plans) {
    if (pkg.is_unavailable) continue;
    const netId = getNetworkId(pkg.network);
    if (!netId) {
      unmatchedPlans.push(pkg);
      continue;
    }

    const sizeGb = extractGb(pkg.package_size);
    if (sizeGb === null) {
      unmatchedPlans.push(pkg);
      continue;
    }

    const newBasePrice = Number(pkg.api_price);
    const prettyNet = getPrettyNetworkName(pkg.network);

    // Look for matching existing bundle in DB
    const match = dbBundles.find((r) => {
      if (r.network_id !== netId) return false;
      const matchGb = extractGb(r.size_label);
      if (!matchGb) return false;
      return Math.abs(matchGb - sizeGb) < 0.05;
    });

    let currentBase = match ? Number(match.base_price) : 0;
    let currentUser = match ? Number(match.user_price) : 0;
    
    // Margin preservation logic: keep existing margin if positive, otherwise minimum 0.50 GHS
    let existingMargin = currentUser > currentBase ? (currentUser - currentBase) : 0.50;
    let finalMargin = Math.max(0.50, Number(existingMargin.toFixed(2)));
    let newUserPrice = Number((newBasePrice + finalMargin).toFixed(2));

    const bundleId = match ? match.id : crypto.randomUUID();
    const sizeMb = Math.round(sizeGb * 1000);
    const sizeLabel = match ? match.size_label : `${sizeGb}GB Non-Expiry (${prettyNet})`;

    syncedBundles.push({
      id: bundleId,
      network_id: netId,
      network_code: prettyNet,
      size_label: sizeLabel,
      size_mb: sizeMb,
      old_base: currentBase,
      new_base: newBasePrice,
      old_user: currentUser,
      new_user: newUserPrice,
      margin: finalMargin,
      sort_order: match ? match.sort_order : 10,
      is_new: !match
    });
  }

  console.log(`✓ Matched ${syncedBundles.length} data bundles to synchronize.`);

  // 4. Update the bundles in OneGig database via SQL batch
  console.log("\n4. Applying bundle pricing and status updates to database...");
  const updateStatements = syncedBundles.map(b => {
    return `
      INSERT INTO public.bundles (id, network_id, size_label, size_mb, base_price, user_price, active, sort_order, updated_at)
      VALUES (
        '${b.id}',
        '${b.network_id}',
        '${b.size_label.replace(/'/g, "''")}',
        ${b.size_mb},
        ${b.new_base.toFixed(2)},
        ${b.new_user.toFixed(2)},
        true,
        ${b.sort_order || 10},
        NOW()
      )
      ON CONFLICT (id) DO UPDATE SET
        base_price = EXCLUDED.base_price,
        user_price = EXCLUDED.user_price,
        active = true,
        updated_at = NOW();
    `;
  }).join("\n");

  const updateResult = await runSql(updateStatements);
  if (!updateResult.ok) {
    throw new Error(`Failed to update bundles in database: ${updateResult.error}`);
  }
  console.log(`✓ Successfully updated and activated ${syncedBundles.length} bundles!`);

  // 5. Update data_providers settings in app_settings
  console.log("\n5. Updating data_providers app_settings to SwiftData (swft)...");
  const selectSettingsRes = await runSql("SELECT value FROM public.app_settings WHERE key = 'data_providers';");
  let currentVal = {};
  if (selectSettingsRes.ok && selectSettingsRes.result.rows.length > 0) {
    currentVal = selectSettingsRes.result.rows[0].value || {};
  }

  const updatedConfig = {
    ...currentVal,
    active: "swft",
    active_data: "swft",
    active_airtime: currentVal.active_airtime || "swft",
    active_utility: currentVal.active_utility || "swft",
    providers: {
      ...(currentVal.providers || {}),
      swft: {
        name: "SwiftData GH",
        base_url: SWIFTDATA_BASE_URL,
        api_key: SWIFTDATA_API_KEY
      },
      swiftdata: {
        name: "SwiftData Reseller API",
        base_url: SWIFTDATA_BASE_URL,
        api_key: SWIFTDATA_API_KEY
      }
    }
  };

  const jsonStr = JSON.stringify(updatedConfig).replace(/'/g, "''");
  const updateSettingsSql = `
    INSERT INTO public.app_settings (key, value, updated_at)
    VALUES ('data_providers', '${jsonStr}'::jsonb, NOW())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();
  `;
  const setRes = await runSql(updateSettingsSql);
  if (setRes.ok) {
    console.log("✓ Successfully configured active provider as SwiftData (swft) in app_settings.");
  } else {
    console.error("Failed to update app_settings:", setRes.error);
  }

  // 6. Reload schema cache
  console.log("\n6. Reloading PostgREST schema cache...");
  await runSql("NOTIFY pgrst, 'reload schema';");
  console.log("✓ Schema cache reloaded.");

  // 7. Output summary table
  console.log("\n========================================================");
  console.log("📊 Summary of Synced Packages (SwiftData API -> OneGig):");
  console.log("========================================================");
  syncedBundles.sort((a,b) => a.network_code.localeCompare(b.network_code) || a.size_mb - b.size_mb);
  
  const summaryTable = syncedBundles.map(b => ({
    Network: b.network_code,
    Size: b.size_label,
    "SwiftData Cost": `GHS ${b.new_base.toFixed(2)}`,
    "Previous Cost": `GHS ${b.old_base.toFixed(2)}`,
    "OneGig Retail": `GHS ${b.new_user.toFixed(2)}`,
    "Profit Margin": `+GHS ${b.margin.toFixed(2)}`
  }));
  console.table(summaryTable);

  if (unmatchedPlans.length > 0) {
    console.log(`\nNote: ${unmatchedPlans.length} composite voice+data plans (MTN Mashup) were preserved as non-standard.`);
  }

  console.log("\n✅ BACKEND SYNC COMPLETE!");
}

syncBackend().catch(err => {
  console.error("\n❌ Sync failed:", err);
  process.exit(1);
});
