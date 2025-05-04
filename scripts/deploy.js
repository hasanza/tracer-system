const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const SupplyChain = require("../ignition/modules/SupplyChain");

async function main() {
    // Compile the contract
    await hre.run('compile');

    // Deploy the contract
    const {supplyChain} = await hre.ignition.deploy(SupplyChain)
    await supplyChain.waitForDeployment();

    console.log("SupplyChain deployed to:", supplyChain.target);

    // Get the contract ABI
    const contractArtifact = await hre.artifacts.readArtifact("SupplyChain");

    // Create the JSON file with the contract address and ABI
    const contractData = {
        address: supplyChain.target,
        abi: contractArtifact.abi
    };

    const outputPath = path.join(__dirname, 'deployedContract.json');
    fs.writeFileSync(outputPath, JSON.stringify(contractData, null, 2));

    console.log(`Contract data saved to ${outputPath}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });