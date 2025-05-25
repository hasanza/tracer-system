const { ethers } = require("hardhat");

async function main() {
  // 1. Get signers
  const [admin, manufacturer] = await ethers.getSigners();
  
  // 2. Connect to contract
  const contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const SupplyChain = await ethers.getContractFactory("SupplyChain");
  const supplyChain = await SupplyChain.attach(contractAddress);

  // 3. Generate test data
  const pufId = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));
  const challenge = ethers.toBigInt(ethers.hexlify(ethers.randomBytes(32)));

  // 4. Create message (without prefix)
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "uint256"], 
    [pufId, challenge]
  );

  // 5. Sign with Ethereum prefix
  const signature = await manufacturer.signMessage(ethers.getBytes(messageHash));

  console.log("=== PRE-CHECK ===");
  console.log("Manufacturer:", manufacturer.address);
  console.log("Message Hash:", messageHash);
  console.log("Signature:", signature);
  console.log("Recovered:", ethers.verifyMessage(ethers.getBytes(messageHash), signature));

  // 6. Register PUF ID
  console.log("\n1. Registering PUF ID...");
  const registerTx = await supplyChain.connect(manufacturer).addValidPufId(
    pufId, 
    ethers.keccak256(signature)
  );
  await registerTx.wait();

  // 7. Add product
  console.log("2. Adding product...");
  const addTx = await supplyChain.connect(manufacturer).addProduct(
    pufId,
    challenge,
    ethers.keccak256(signature),
    "Test Location",
    manufacturer.address,
    0,
    signature
  );
  await addTx.wait();

  // 8. Verify
  console.log("3. Verifying...");
  const isValid = await supplyChain.verifyPufSignature(pufId, challenge, signature);
  console.log("✅ Verification result:", isValid);
}

main().catch(console.error);