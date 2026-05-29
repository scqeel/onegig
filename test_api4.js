const url = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
const key = "swft_live_74686859a45448bea75376f0a64f97ed";

async function testApi(body) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "X-API-Key": key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  console.log(`Testing ${JSON.stringify(body)}:`, res.status, text.substring(0, 500));
}

async function run() {
  await testApi({ action: "packages" });
  await testApi({ action: "list_packages" });
  await testApi({ action: "data_packages" });
  
  // also try GET
  const res = await fetch(url + "?action=packages", { headers: { "Authorization": `Bearer ${key}`, "X-API-Key": key } });
  console.log("GET /?action=packages:", res.status, await res.text());
}

run();
