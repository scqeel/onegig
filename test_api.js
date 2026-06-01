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
