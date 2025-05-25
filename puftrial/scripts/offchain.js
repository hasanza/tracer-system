// scripts/perfOffchain.js
const { ethers } = require("hardhat");
const { deploySC, makeCsvWriter } = require("./common");
const devices = require("../data/puf_devices_aligned.json");

async function main() {
  const [admin, manufacturer] = await ethers.getSigners();
  const sc = await deploySC(manufacturer);

  const N   = devices.length;                 // total devices
  const csv = makeCsvWriter("offchain_perf.csv", "step,index,gas,latency_ms");

  let totalTxs = 0;
  const startAll = Date.now();

  for (let i = 0; i < N; i++) {
    const d     = devices[i];
    const pufId = BigInt("0x" + d.puf_id);
    const rh    = d.response_hash;
    const challenge = BigInt("0x" + d.challenge);

    // ── preregister PUF on-chain so addProduct() can succeed ──
    // (we do NOT measure this call)
    await sc.connect(manufacturer).addValidPufId(pufId, rh);

    // 1) Off-chain PUF‐CID storage
    const fakeCid = "QmOffchainPUF" + i;
    let t0 = Date.now();
    let tx = await sc.connect(manufacturer).addPufIpfsHash(pufId, fakeCid);
    let r  = await tx.wait();
    let lat = Date.now() - t0;
    csv(`ipfsEnroll,${i},${r.gasUsed.toString()},${lat}`);
    totalTxs++;

    // 2) Off-chain product‐meta storage (CID in 'location')
    const fakeProdCid = "QmOffchainProd" + i;
    // signMessage over keccak(pufId,challenge)
    const msgHashBytes = ethers.getBytes(
      ethers.solidityPackedKeccak256(
        ["uint256","uint256"], [pufId, challenge]
      )
    );
    const signature = await manufacturer.signMessage(msgHashBytes);

    t0 = Date.now();
    tx = await sc.connect(manufacturer).addProduct(
      pufId,
      challenge,
      rh,
      fakeProdCid,           // off-chain metadata CID
      manufacturer.address,
      0,
      signature
    );
    r   = await tx.wait();
    lat = Date.now() - t0;
    csv(`ipfsProduct,${i},${r.gasUsed.toString()},${lat}`);
    totalTxs++;
  }

  const totalTime = (Date.now() - startAll) / 1000;
  console.log(`OffChain scenario: ${totalTxs} txs in ${totalTime}s → ${(totalTxs/totalTime).toFixed(2)} tx/s`);
}

main().catch(console.error);
