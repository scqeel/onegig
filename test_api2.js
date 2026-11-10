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
  await testApi("yellow-1gb");
  await testApi("yellow_data_1gb");
  await testApi("mtn_data_1gb");
  await testApi("mtn-1gb");
  await testApi("MTN_1GB");
  await testApi("YELLOW_1GB");
  await testApi("1");
  await testApi("2");
  await testApi("data_yellow_1gb");
  await testApi("bundle_yellow_1gb");
}

run();
