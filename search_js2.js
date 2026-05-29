import https from "https";

https.get("https://swiftdatagh.shop/assets/index-K0ja9o2_.js", (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => {
    const regex = /.{0,50}1GB.{0,50}/gi;
    const matches = data.match(regex);
    if (matches) {
      console.log("Found matches:");
      matches.slice(0, 20).forEach(m => console.log(m));
    } else {
      console.log("No 1GB found in JS");
    }
  });
});
