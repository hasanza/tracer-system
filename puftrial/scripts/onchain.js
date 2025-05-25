// scripts/perfOnchain.js
const { ethers } = require("hardhat");
const { deploySC, makeCsvWriter } = require("./common");
const devices = require("../data/puf_devices_aligned.json");

async function main() {
  // 1) Setup
  const [_, manufacturer] = await ethers.getSigners();
  const sc = await deploySC(manufacturer);

  const N   = devices.length;  // you can choose a subset if you like
  const csv = makeCsvWriter("onchain_perf.csv", "step,index,gas,latency_ms");

  let totalTxs = 0;
  const tAll   = Date.now();

  for (let i = 0; i < N; i++) {
    const d         = devices[i];
    const pufId     = BigInt("0x" + d.puf_id);
    const challenge = BigInt("0x" + d.challenge);
    const rh        = d.response_hash;

    // ── 1) Enroll PUF on-chain ──────────────────────────────
    let t0 = Date.now();
    let tx = await sc.connect(manufacturer).addValidPufId(pufId, rh);
    let receipt = await tx.wait();
    let lat = Date.now() - t0;
    csv(`enroll,${i},${receipt.gasUsed.toString()},${lat}`);
    totalTxs++;

    // ── 2) Add product with full on-chain “metadata” ────────
    // Here we just pack metadata into the `location` string
    const fullMeta = JSON.stringify({
      pufId: pufId.toString(),
      challenge: challenge.toString(),
      extra: "…any other fields…"
    });

    // sign the PUF challenge
    const msgBytes = ethers.getBytes(
      ethers.solidityPackedKeccak256(
        ["uint256","uint256"],
        [pufId, challenge]
      )
    );
    const signature = await manufacturer.signMessage(msgBytes);

    t0 = Date.now();
    tx = await sc.connect(manufacturer).addProduct(
      pufId,
      challenge,
      rh,
      fullMeta,
      manufacturer.address,
      0,
      signature
    );
    receipt = await tx.wait();
    lat = Date.now() - t0;
    csv(`product,${i},${receipt.gasUsed.toString()},${lat}`);
    totalTxs++;
  }

  const totalTime = (Date.now() - tAll) / 1000;
  console.log(
    `\n→ On-chain scenario: sent ${totalTxs} txs in ${totalTime.toFixed(2)}s ` +
    `(≈ ${(totalTxs/totalTime).toFixed(2)} tx/s)`
  );
}

main().catch(console.error);
