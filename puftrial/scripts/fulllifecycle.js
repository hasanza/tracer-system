// scripts/fulllifecycle.js
const fs   = require("fs");
const path = require("path");
const { ethers } = require("hardhat");

async function main() {
  // 1) Signers & deployment
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
  console.log("Contract deployed at", contractAddress);

  // 2) Pick one device
  const device = require("../data/puf_devices_aligned.json")[0];
  const pufId        = BigInt("0x" + device.puf_id);
  const challenge    = BigInt("0x" + device.challenge);
  const responseHash = device.response_hash;
  const deviceWallet = new ethers.Wallet(device.ecc_privkey, manufacturer.provider);
  const ownerAddr    = deviceWallet.address;

  // Pre-sign the PUF challenge
  const msgHashBytes = ethers.getBytes(
    ethers.solidityPackedKeccak256(["uint256","uint256"], [pufId, challenge])
  );
  const signature = await deviceWallet.signMessage(msgHashBytes);

  // 3) Enroll the PUF tag
  console.log(">>> Enrolling PUF ID...");
  const enrollData = sc.interface.encodeFunctionData("addValidPufId", [pufId, responseHash]);
  const enrollT0   = Date.now();
  const enrollTx   = await manufacturer.sendTransaction({ to: contractAddress, data: enrollData });
  const enrollReceipt = await enrollTx.wait();
  const enrollT1   = Date.now();
  console.log(`enroll: gasUsed=${enrollReceipt.gasUsed.toString()}  time=${enrollT1-enrollT0}ms`);

  // 4) Define the 5 phases with correct signers
  const phases = [
    {
      name: "manufacture",
      signer: manufacturer,
      data: sc.interface.encodeFunctionData("addProduct", [
        pufId, challenge, responseHash, "Factory", ownerAddr, 0, signature
      ])
    },
    {
      name: "ship",
      signer: manufacturer,
      data: sc.interface.encodeFunctionData("updateLocation", [pufId, "Shipped"])
    },
    {
      name: "distribute",
      signer: distributor,
      data: sc.interface.encodeFunctionData("updateLocation", [pufId, "Distribution Center"])
    },
    {
      name: "retail",
      signer: retailer,
      data: sc.interface.encodeFunctionData("updateLocation", [pufId, "Retail Store"])
    },
    {
      name: "deliver",
      signer: retailer,
      data: sc.interface.encodeFunctionData("updateLocation", [pufId, "Delivered to Customer"])
    }
  ];

  // 5) Execute & measure each phase
  const results = [{
    phase:    "enroll",
    signer:   manufacturer.address,
    gasUsed:  enrollReceipt.gasUsed.toString(),
    durationMs: enrollT1 - enrollT0
  }];

  for (const phase of phases) {
    const { name, signer, data } = phase;
    const t0 = Date.now();
    const tx = await signer.sendTransaction({ to: contractAddress, data });
    const receipt = await tx.wait();
    const t1 = Date.now();

    console.log(`${name}: gasUsed=${receipt.gasUsed.toString()}  time=${t1 - t0}ms`);
    results.push({
      phase:     name,
      signer:    signer.address,
      gasUsed:   receipt.gasUsed.toString(),
      durationMs: t1 - t0
    });
  }

  // 6) Save a log
  const log = { timestamp: Date.now(), contractAddress, results };
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logPath = path.join(logsDir, `fulllifecycle_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log("Saved full-lifecycle log to", logPath);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
