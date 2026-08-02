const debugUrl = "https://huvuogyvgeoqiqltbgcw.supabase.co/functions/v1/debug-db";
const debugKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1dnVvZ3l2Z2VvcWlxbHRiZ2N3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU0MjY1MDYsImV4cCI6MjA5MTAwMjUwNn0.uysmVkP3O00NZaT4ucojUmJAHSA9HB6IUCl7wZCUvVQ";

async function run() {
  console.log("1. Creating WAEC Result Checkers network entry...");
  const netId = "a9911223-4455-6677-8899-aabbccddeeff";
  const sqlNet = `
    INSERT INTO public.networks (id, name, code, color, logo_emoji, active, sort_order)
    VALUES ('${netId}', 'Result Checkers', 'RESULT_CHECKER', '#8B5CF6', '🎓', true, 4)
    ON CONFLICT (id) DO UPDATE SET active = true, name = 'Result Checkers';
  `;

  const netRes = await fetch(debugUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${debugKey}`,
      "apikey": debugKey
    },
    body: JSON.stringify({ exec_sql: sqlNet })
  });
  console.log("Network creation:", await netRes.json());

  console.log("\n2. Inserting Result Checker packages...");
  const sqlBundles = `
    INSERT INTO public.bundles (network_id, size_label, size_mb, base_price, user_price, active)
    VALUES 
      ('${netId}', 'WASSCE Result Checker 🎓', 1, 25.00, 25.00, true),
      ('${netId}', 'BECE Result Checker 🎓', 2, 22.00, 22.00, true),
      ('${netId}', 'CSSPS Placement Checker 🏫', 3, 20.00, 20.00, true),
      ('${netId}', 'NOVDEC Result Checker 🎓', 4, 25.00, 25.00, true)
    ON CONFLICT DO NOTHING;
  `;

  const bundlesRes = await fetch(debugUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${debugKey}`,
      "apikey": debugKey
    },
    body: JSON.stringify({ exec_sql: sqlBundles })
  });
  console.log("Bundles creation:", await bundlesRes.json());
}

run();
