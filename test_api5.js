const url = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api/payment/data";
const key = "swft_live_74686859a45448bea75376f0a64f97ed";

async function testApi(packageId) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "X-API-Key": key,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      package_id: packageId,
      phone: "0551234567",
      request_id: crypto.randomUUID()
    })
  });
  const text = await res.text();
  console.log(`Testing ${packageId}:`, res.status, text);
}

async function run() {
  await testApi("8feddd09-e064-4253-9763-2c8c37945e64");
}

run();
