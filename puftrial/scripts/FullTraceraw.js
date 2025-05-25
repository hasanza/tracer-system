// scripts/fullTraceRaw.js
const { ethers } = require("hardhat");
const device = require("../data/puf_devices_aligned.json")[0];

async function main() {
  console.log(">>> FULL TRACEABILITY (RAW-TX) <<<");
  console.log("Using device entry:", device);

  const [, manufacturer] = await ethers.getSigners();
  const contractAddress  = "0x610178dA211FEF7D417bC0e6FeD39F05609AD788"; // your deployed address
  const SupplyChain      = await ethers.getContractFactory("SupplyChain");
  const sc               = await SupplyChain.attach(contractAddress);
  const iface            = sc.interface;

  // 1) Build parameters
  const pufId        = BigInt("0x" + device.puf_id);
  const challenge    = BigInt("0x" + device.challenge);
  const responseHash = device.response_hash;        // keccak(pufId,challenge)
  const location     = "Factory";

  // 2) Enroll PUF ID
  let data = iface.encodeFunctionData("addValidPufId", [pufId, responseHash]);
  let tx   = await manufacturer.sendTransaction({ to: contractAddress, data });
  console.log("• addValidPufId → tx", tx.hash);
  await tx.wait();

  // 3) ECC-sign the messageHash = keccak(pufId,challenge)
  const msgHashBytes = ethers.getBytes(
    ethers.solidityPackedKeccak256(
      ["uint256","uint256"],
      [pufId, challenge]
    )
  );
  // Derive the device’s Ethereum address from its PUF-ECC private key
  const deviceWallet = new ethers.Wallet(device.ecc_privkey, manufacturer.provider);
  const ownerAddr    = deviceWallet.address;
  const signature    = await deviceWallet.signMessage(msgHashBytes);
  console.log("• signature     →", signature);
  console.log("• ownerAddr     →", ownerAddr);

  // 4) Add the product record
  data = iface.encodeFunctionData("addProduct", [
    pufId,
    challenge,
    responseHash,
    location,
    ownerAddr,     // now comes from deviceWallet.address
    0,             // rawMaterialId (just a placeholder)
    signature
  ]);
  tx = await manufacturer.sendTransaction({ to: contractAddress, data });
  console.log("• addProduct     → tx", tx.hash);
  await tx.wait();

  // 5) On-chain verifications
  const okResp = await sc.verifyPufId(pufId, responseHash);
  const okSig  = await sc.verifyPufSignature(pufId, challenge, signature);
  console.log(`\n✅ verifyPufId: ${okResp}   verifySig: ${okSig}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
