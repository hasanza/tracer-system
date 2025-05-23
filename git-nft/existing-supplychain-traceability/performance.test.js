const fs = require("fs");
const path = require("path");
const devices = require("../data/puf_devices_aligned.json");

describe("📊 OnChain vs OffChain Storage Comparison", function () {
  let supplyChain, manufacturer;
  const outputFile = path.join(__dirname, "onchain_offchain_results.csv");

  before(async () => {
    [_, manufacturer] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("SupplyChain");
    supplyChain = await Factory.deploy(
      manufacturer.address, manufacturer.address,
      manufacturer.address, manufacturer.address
    );
    await supplyChain.waitForDeployment();

    // CSV header
    fs.writeFileSync(outputFile, "Scenario,Function,Count,GasUsed,LatencyMs\n");
  });

  const simulateAddValidPufId = async (count) => {
    for (let i = 0; i < count; i++) {
      const device = devices[i];
      const pufId = BigInt("0x" + device.puf_id);
      const hash = device.response_hash;

      const start = Date.now();
      const tx = await supplyChain.connect(manufacturer).addValidPufId(pufId, hash);
      const receipt = await tx.wait();
      const latency = Date.now() - start;

      fs.appendFileSync(outputFile, `OnChain,addValidPufId,${i + 1},${receipt.gasUsed},${latency}\n`);
    }
  };

  const simulateAddProduct = async (count) => {
    for (let i = 0; i < count; i++) {
      const device = devices[i];
      const pufId = BigInt("0x" + device.puf_id);
      const challenge = BigInt("0x" + device.challenge);
      const hash = device.response_hash;
      const dummySig = "0x" + "0".repeat(130);

      const start = Date.now();
      const tx = await supplyChain.connect(manufacturer).addProduct(
        pufId, challenge, hash, `Loc-${i}`, manufacturer.address, dummySig
      );
      const receipt = await tx.wait();
      const latency = Date.now() - start;

      fs.appendFileSync(outputFile, `OnChain,addProduct,${i + 1},${receipt.gasUsed},${latency}\n`);
    }
  };

  const simulateAddValidPufIdCID = async (count) => {
    for (let i = 0; i < count; i++) {
      const device = devices[i];
      const pufId = BigInt("0x" + device.puf_id);
      const fakeCID = `QmPufId${i.toString().padStart(3, "0")}`;

      const start = Date.now();
      const tx = await supplyChain.connect(manufacturer).addValidPufIdCID(pufId, fakeCID);
      const receipt = await tx.wait();
      const latency = Date.now() - start;

      fs.appendFileSync(outputFile, `OffChain,addValidPufIdCID,${i + 1},${receipt.gasUsed},${latency}\n`);
    }
  };

  const simulateAddProductCID = async (count) => {
    for (let i = 0; i < count; i++) {
      const device = devices[i];
      const pufId = BigInt("0x" + device.puf_id);
      const fakeCID = `QmProduct${i.toString().padStart(3, "0")}`;

      const start = Date.now();
      const tx = await supplyChain.connect(manufacturer).addProductCID(pufId, fakeCID);
      const receipt = await tx.wait();
      const latency = Date.now() - start;

      fs.appendFileSync(outputFile, `OffChain,addProductCID,${i + 1},${receipt.gasUsed},${latency}\n`);
    }
  };

  it("Run OnChain storage tests", async () => {
    await simulateAddValidPufId(devices.length);
    await simulateAddProduct(devices.length);
  });

  it("Run OffChain CID storage tests", async () => {
    await simulateAddValidPufIdCID(devices.length);
    await simulateAddProductCID(devices.length);
  });
});
