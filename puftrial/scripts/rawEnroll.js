// scripts/rawEnroll.js
const { ethers } = require("hardhat");
const device = require("../data/puf_devices_aligned.json")[0];

console.log(">>> RAW ENROLL ONE DEVICE <<<");
console.log("Loaded device entry:", device);

async function main() {
  const [, manufacturer] = await ethers.getSigners();
  const contractAddress  = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788";  // ← update this
  const SupplyChain      = await ethers.getContractFactory("SupplyChain");
  const sc               = await SupplyChain.attach(contractAddress);

  // Make sure we spell these exactly as declared
  const pufId        = BigInt("0x" + device.puf_id);
  const responseHash = device.response_hash;            // capital “H”
  const iface        = sc.interface;

  console.log("Enrolling PUF ID:", pufId.toString(16));
  console.log("Using responseHash:", responseHash);

  // Encode the raw addValidPufId call
  const data = iface.encodeFunctionData("addValidPufId", [
    pufId,
    responseHash
  ]);

  // Send it as a raw transaction bound to the manufacturer signer
  const tx = await manufacturer.sendTransaction({ to: contractAddress, data });
  console.log(" → tx.hash:", tx.hash);

  const receipt = await tx.wait();
  console.log(" → mined in block", receipt.blockNumber);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
