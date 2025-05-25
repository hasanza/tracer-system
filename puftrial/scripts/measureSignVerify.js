// scripts/measureSignVerify.js
const fs = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  const iterations = 100;
  const signDurations = [];
  const verifyDurations = [];

  // 1) Deploy contract
  const [ , manufacturer ] = await ethers.getSigners();
  const Factory = await ethers.getContractFactory("SupplyChain");
  const sc = await Factory.deploy(
    manufacturer.address,
    manufacturer.address,
    manufacturer.address,
    manufacturer.address
  );
  await sc.waitForDeployment();

  // 2) Load one simulated device
  const device = require("../data/puf_devices_aligned.json")[0];
  const pufId     = BigInt("0x" + device.puf_id);
  const challenge = BigInt("0x" + device.challenge);

  // 3) Prepare the message bytes to sign
  const msgHashBytes = ethers.getBytes(
    ethers.solidityPackedKeccak256(
      ["uint256","uint256"],
      [pufId, challenge]
    )
  );
  // Wallet for signing
  const deviceWallet = new ethers.Wallet(device.ecc_privkey);

  // 4) Benchmark signing
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    await deviceWallet.signMessage(msgHashBytes);
    const t1 = process.hrtime.bigint();
    signDurations.push(Number(t1 - t0)); // nanoseconds
  }

  // 5) Benchmark on-chain verify (JS round-trip)
  const signature = await deviceWallet.signMessage(msgHashBytes);
  for (let i = 0; i < iterations; i++) {
    const t0 = process.hrtime.bigint();
    await sc.verifyPufSignature(pufId, challenge, signature);
    const t1 = process.hrtime.bigint();
    verifyDurations.push(Number(t1 - t0));
  }

  // 6) Compute statistics
  function stats(arr) {
    const sum = arr.reduce((a, b) => a + b, 0);
    const mean = sum / arr.length;
    const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
    const stddev = Math.sqrt(variance);
    return { mean, stddev };
  }
  const signStats   = stats(signDurations);
  const verifyStats = stats(verifyDurations);

  // Convert to ms
  const ms = ns => (ns / 1e6).toFixed(3);

  console.log(`\nSigning Latency over ${iterations} runs:`);
  console.log(`  Avg: ${ms(signStats.mean)} ms   Std: ${ms(signStats.stddev)} ms`);

  console.log(`\nVerify (view call) Latency over ${iterations} runs:`);
  console.log(`  Avg: ${ms(verifyStats.mean)} ms   Std: ${ms(verifyStats.stddev)} ms\n`);

  // 7) Save log to file
  const log = {
    timestamp: Date.now(),
    iterations,
    signing_ms: {
      average: Number((signStats.mean / 1e6).toFixed(3)),
      stddev:  Number((signStats.stddev / 1e6).toFixed(3))
    },
    verify_ms: {
      average: Number((verifyStats.mean / 1e6).toFixed(3)),
      stddev:  Number((verifyStats.stddev / 1e6).toFixed(3))
    }
  };
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logPath = path.join(logsDir, `sign_verify_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`Saved sign/verify log to ${logPath}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
