// scripts/deploy2.js
const { ethers } = require("hardhat");
const devices = require("../data/puf_devices_aligned.json");

async function main() {
  console.log(">>> Running deploy2.js <<<");

  const [admin, manufacturer] = await ethers.getSigners();

  // 1) Deploy the contract
  const Factory     = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await Factory.deploy(
    manufacturer.address, // manufacturer
    manufacturer.address, // distributor
    manufacturer.address, // retailer
    manufacturer.address  // supplier
  );
  await supplyChain.waitForDeployment();
  


  const contractAddress = await supplyChain.getAddress();
  console.log("✅ Deployment Successful!");
  console.log("   Contract address:", contractAddress);
  console.log("   Admin:           ", admin.address);
  console.log("   Manufacturer:    ", manufacturer.address);

  // 2) Grab the ABI encoder
  const iface = supplyChain.interface;

  // 3) Enroll each PUF tag with raw transactions
  for (const device of devices) {
    const pufId        = BigInt("0x" + device.puf_id);
    const responseHash = device.response_hash;  // must start "0x"

    console.log("Registering PUF ID:", pufId.toString(16));

    // Encode the call data for addValidPufId(uint256,bytes32)
    const data = iface.encodeFunctionData("addValidPufId", [
      pufId,
      responseHash
    ]);

    // Send it as a raw transaction from the manufacturer signer
    const tx = await manufacturer.sendTransaction({
      to:   contractAddress,
      data, 
      // gasLimit: 100000  // you can bump if needed
    });
    console.log(" → tx.hash:", tx.hash);

    const receipt = await tx.wait();
    console.log(" → mined in block", receipt.blockNumber);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
