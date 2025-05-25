// scripts/_perf_common.js
const fs   = require('fs');
const path = require('path');
const { ethers } = require('hardhat');

async function deploySC(manufacturer, distributor) {
  const Factory = await ethers.getContractFactory("SupplyChain");
  const sc = await Factory.deploy(
    manufacturer.address,
    distributor?.address ?? manufacturer.address,
    distributor?.address ?? manufacturer.address,
    distributor?.address ?? manufacturer.address
  );
  await sc.waitForDeployment();
  // grant roles
  await sc.grantRole(await sc.MANUFACTURER_ROLE(), manufacturer.address);
  if (distributor) {
    await sc.grantRole(await sc.DISTRIBUTOR_ROLE(), distributor.address);
  }
  return sc;
}

function makeCsvWriter(filename, header) {
  const full = path.join(__dirname, '..', 'logs', filename);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, header + '\n');
  return line => fs.appendFileSync(full, line + '\n');
}

module.exports = { deploySC, makeCsvWriter };
