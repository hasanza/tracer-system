// scripts/loadTest.js
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { ethers } = require("hardhat");

async function main() {
  // 1) Setup & deploy
  const [admin, manufacturer, distributor, retailer] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("SupplyChain");
  const sc = await Factory.deploy(
    manufacturer.address,
    distributor.address,
    retailer.address,
    admin.address
  );
  await sc.waitForDeployment();
  const contractAddress = await sc.getAddress();
  console.log("Deployed SupplyChain at", contractAddress);

  // 2) Enroll one PUF tag
  const device = require("../data/puf_devices_aligned.json")[0];
  const pufId = BigInt("0x" + device.puf_id);
  const responseHash = device.response_hash;
  const ownerWallet = new ethers.Wallet(device.ecc_privkey, manufacturer.provider);
  await manufacturer.sendTransaction({
    to:   contractAddress,
    data: sc.interface.encodeFunctionData("addValidPufId", [pufId, responseHash])
  }).then(tx => tx.wait());

  // 3) Pre-generate transaction payloads
  const maxTx = 100;  // support up to 100 calls
  const txEntries = [];
  for (let i = 0; i < maxTx; i++) {
    const challenge = BigInt("0x" + crypto.randomBytes(32).toString("hex"));
    const msgHashBytes = ethers.getBytes(
      ethers.solidityPackedKeccak256(["uint256","uint256"], [pufId, challenge])
    );
    const signature = await ownerWallet.signMessage(msgHashBytes);
    const itemId = i + 1;
    const location = "LoadTest";
    const txData = sc.interface.encodeFunctionData("addProduct", [
      pufId,
      challenge,
      responseHash,
      location,
      ownerWallet.address,
      itemId,
      signature
    ]);
    txEntries.push({ txData });
  }

  // 4) Scenario definitions
  const scenarios = [
    { name: "initial", total: 10, concurrency: 10 },
    { name: "sustained", total: 100, concurrency: 20 },
    { name: "peak", total: 50, concurrency: 50 }
  ];

  // Fetch gas price
  const provider = manufacturer.provider;
  let { gasPrice } = await provider.getFeeData();
  if (!gasPrice) gasPrice = ethers.parseUnits("1", "gwei");
  if (typeof gasPrice !== 'bigint') gasPrice = gasPrice.toBigInt();

  const results = [];

  // 5) Run each scenario
  for (const { name, total, concurrency } of scenarios) {
    console.log(`\nRunning ${name} load: total=${total}, concurrency=${concurrency}`);
    const latencies = [];
    const gasUsedArr = [];
    const startTime = Date.now();

    // Break into chunks of size=concurrency
    for (let i = 0; i < total; i += concurrency) {
      const batch = txEntries.slice(i, i + concurrency).map(entry => (async () => {
        const t0 = Date.now();
        const tx = await manufacturer.sendTransaction({
          to: contractAddress,
          data: entry.txData,
          gasPrice
        });
        const receipt = await tx.wait();
        const t1 = Date.now();

        latencies.push(t1 - t0);
        gasUsedArr.push(typeof receipt.gasUsed === 'bigint' ? receipt.gasUsed : BigInt(receipt.gasUsed.toString()));
      })());

      // await batch
      await Promise.all(batch);
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;
    const throughput = (total * 1000) / durationMs; // tx/s

    // Compute avg/std
    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const latencyVar = latencies.reduce((a, b) => a + (b - avgLatency) ** 2, 0) / latencies.length;
    const stdLatency = Math.sqrt(latencyVar);

    const totalGas = gasUsedArr.reduce((a, b) => a + b, 0n);
    const avgGas = totalGas / BigInt(gasUsedArr.length);
    const avgCostWei = avgGas * gasPrice;

    results.push({
      scenario: name,
      total,
      concurrency,
      durationMs,
      throughputTxPerSec: throughput,
      avgLatencyMs: avgLatency,
      stdLatencyMs: stdLatency,
      totalGas: totalGas.toString(),
      avgGas: avgGas.toString(),
      avgCostWei: avgCostWei.toString()
    });

    console.log(`${name}: duration ${durationMs}ms, throughput ${throughput.toFixed(2)} tx/s, avg latency ${avgLatency.toFixed(2)} ms, avg gas ${avgGas}`);
  }

  // 6) Save log
  const log = { timestamp: Date.now(), contractAddress, gasPrice: gasPrice.toString(), results };
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logPath = path.join(logsDir, `load_test_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`\nSaved load test log to ${logPath}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
