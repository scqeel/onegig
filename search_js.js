import https from "https";

https.get("https://swiftdatagh.shop/assets/index-K0ja9o2_.js", (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => {
    const regex = /.{0,50}package_id.{0,50}/gi;
    const matches = data.match(regex);
    if (matches) {
      console.log("Found matches:");
      matches.slice(0, 20).forEach(m => console.log(m));
    } else {
      console.log("No package_id found in JS");
    }
    
    // Also try to find "yellow_" or "mtn_" 
    const pRegex = /.{0,30}yellow_.{0,30}/gi;
    const pMatches = data.match(pRegex);
    if (pMatches) {
      console.log("Found yellow matches:");
      pMatches.slice(0, 10).forEach(m => console.log(m));
    }
  });
});
