const url = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api/payment/data";
const key = process.env.SWIFTDATA_API_KEY;

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
  await testApi("yellow_1gb");
  await testApi("mtn_1gb");
  await testApi("mtn_1");
  await testApi("1gb");
  await testApi("1");
  await testApi("mtn-1gb");
  await testApi("mtndata_1gb");
}

run();
