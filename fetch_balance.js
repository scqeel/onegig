const baseUrl = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api";
const key = process.env.SWIFTDATA_API_KEY;

async function testApi(path) {
  const url = `${baseUrl}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${key}`
    }
  });
  const text = await res.text();
  console.log(`GET ${path}:`, res.status, text);
}

async function run() {
  await testApi("/balance");
  await testApi("/wallet");
  await testApi("/profile");
  await testApi("/me");
}

run();
