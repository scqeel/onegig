const url = "https://lsocdjpflecduumopijn.supabase.co/functions/v1/developer-api/plans";
const key = "swft_live_74686859a45448bea75376f0a64f97ed";

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
