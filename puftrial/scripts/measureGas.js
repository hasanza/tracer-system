// scripts/measureGas.js
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");
const devices = require("../data/puf_devices_aligned.json");

async function main() {
  // Set up signers and provider
  const [admin, manufacturer, distributor, retailer] = await ethers.getSigners();
  const provider = manufacturer.provider;

  // Fetch gas price (fallback to 1 gwei if undefined)
  let { gasPrice } = await provider.getFeeData();
  if (!gasPrice) gasPrice = ethers.parseUnits("1", "gwei");
  // Ensure gasPrice is a BigInt
  if (typeof gasPrice !== 'bigint') gasPrice = gasPrice.toBigInt();

  // Deploy the contract
  const Factory = await ethers.getContractFactory("SupplyChain");
  const sc = await Factory.deploy(
    manufacturer.address,
    distributor.address,
    retailer.address,
    manufacturer.address
  );
  await sc.waitForDeployment();
  const contractAddress = await sc.getAddress();
  console.log(`Contract deployed at ${contractAddress}`);

  // ABI interface
  const iface = sc.interface;

  // 1) Measure addValidPufId for all devices
  let totalEnrollGas = 0n;
  for (let i = 0; i < devices.length; i++) {
    const device = devices[i];
    const pufId = BigInt("0x" + device.puf_id);
    const responseHash = device.response_hash;
    const data = iface.encodeFunctionData("addValidPufId", [pufId, responseHash]);

    // Send raw tx via manufacturer signer
    const nonce = await provider.getTransactionCount(manufacturer.address);
    const txResponse = await manufacturer.sendTransaction({ to: contractAddress, data, nonce, gasPrice });
    const receipt = await txResponse.wait();

    totalEnrollGas += receipt.gasUsed;
  }
  const avgEnrollGas = totalEnrollGas / BigInt(devices.length);

  // 2) Measure addProduct for first device
  const device0 = devices[0];
  const pufId0 = BigInt("0x" + device0.puf_id);
  const challenge0 = BigInt("0x" + device0.challenge);
  const responseHash0 = device0.response_hash;
  const msgBytes = ethers.getBytes(
    ethers.solidityPackedKeccak256(["uint256","uint256"], [pufId0, challenge0])
  );
  const deviceWallet = new ethers.Wallet(device0.ecc_privkey, provider);
  const ownerAddr0 = deviceWallet.address;
  const signature0 = await deviceWallet.signMessage(msgBytes);

  const data2 = iface.encodeFunctionData("addProduct", [
    pufId0,
    challenge0,
    responseHash0,
    "Factory",
    ownerAddr0,
    0,
    signature0
  ]);
  const nonce2 = await provider.getTransactionCount(manufacturer.address);
  const txResponse2 = await manufacturer.sendTransaction({ to: contractAddress, data: data2, nonce: nonce2, gasPrice });
  const receipt2 = await txResponse2.wait();
  const gasAddProduct = receipt2.gasUsed;

  // 3) Measure updateLocation for first device
  const data3 = iface.encodeFunctionData("updateLocation", [pufId0, "Distributor Warehouse"]);
  const nonce3 = await provider.getTransactionCount(distributor.address);
  const txResponse3 = await distributor.sendTransaction({ to: contractAddress, data: data3, nonce: nonce3, gasPrice });
  const receipt3 = await txResponse3.wait();
  const gasUpdateLocation = receipt3.gasUsed;

  // 4) Aggregate costs
  const costEnrollTotal = totalEnrollGas * gasPrice;
  const costAddProduct = gasAddProduct * gasPrice;
  const costUpdateLoc = gasUpdateLocation * gasPrice;

  // 5) Prepare log
  const log = {
    timestamp: Date.now(),
    gasPrice: gasPrice.toString(),
    enroll: {
      count: devices.length,
      totalGas: totalEnrollGas.toString(),
      avgGas: avgEnrollGas.toString(),
      totalCostWei: costEnrollTotal.toString()
    },
    addProduct: {
      gasUsed: gasAddProduct.toString(),
      costWei: costAddProduct.toString()
    },
    updateLocation: {
      gasUsed: gasUpdateLocation.toString(),
      costWei: costUpdateLoc.toString()
    }
  };

  // 6) Save log to file
  const logsDir = path.join(__dirname, "../logs");
  if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir);
  const logPath = path.join(logsDir, `gas_usage_${Date.now()}.json`);
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`Saved gas usage log to ${logPath}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
