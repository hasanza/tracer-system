// scripts/measureKeyLatency.js
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

async function main() {
  const iterations = 100;
  const durations = [];

  for (let i = 0; i < iterations; i++) {
    // 1) Simulate a 32-byte PUF-derived hash
    const responseHash = crypto.randomBytes(32);

    // 2) Time: SHA-256(responseHash) + instantiate Wallet
    const start = process.hrtime.bigint();
    const seed = crypto.createHash("sha256").update(responseHash).digest();  
    // ethers.Wallet expects a hex string
    const wallet = new ethers.Wallet("0x" + seed.toString("hex"));
    const end = process.hrtime.bigint();

    durations.push(Number(end - start));  // nanoseconds
  }

  // Compute statistics
  const sumNs = durations.reduce((a, b) => a + b, 0);
  const avgNs = sumNs / iterations;
  const varianceNs = durations.reduce((a, b) => a + (b - avgNs) ** 2, 0) / iterations;
  const stdNs = Math.sqrt(varianceNs);

  const avgMs = avgNs / 1e6;
  const stdMs = stdNs / 1e6;

  console.log(`\nKey-Derivation Latency over ${iterations} runs:`);
  console.log(`  Average: ${avgMs.toFixed(3)} ms`);
  console.log(`  Std Dev: ${stdMs.toFixed(3)} ms\n`);

  // Save log to file
  const log = {
    timestamp: Date.now(),
    iterations,
    average_ms: avgMs,
    stddev_ms: stdMs
  };
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logPath = path.join(logsDir, `key_latency_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`Saved key latency log to ${logPath}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
