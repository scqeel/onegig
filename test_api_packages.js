const url = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api/packages";
const key = process.env.SWIFTDATA_API_KEY;

async function testApi() {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${key}`,
      "X-API-Key": key,
      "Content-Type": "application/json"
    }
  });
  const text = await res.text();
  console.log(`Packages endpoint:`, res.status, text.substring(0, 500));
}

testApi();
