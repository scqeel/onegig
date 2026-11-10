const url = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api/plans";
const key = process.env.SWIFTDATA_API_KEY;

async function run() {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${key}`
    }
  });
  const text = await res.text();
  console.log(text);
}

run();
