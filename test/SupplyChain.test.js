const { expect } = require("chai");

describe("SupplyChain contract unit-testing suite", function () {
  // The variables below are the same for all tests (i.e., they are "global" variables)
  // They are declared here to avoid redeclaring them in each test (i.e., each "it" block)
  let supplyChain;
  let owner, manufacturer, distributor, retailer;
  const challenges = [0,1,2,3,4,5,6,7,8,9,10];

  // This block is executed before testing starts
  before(async () => {
    [owner, manufacturer, distributor, retailer, productOwner1, productOwner2] = await ethers.getSigners();
    supplyChain = await ethers.deployContract("SupplyChain", [owner.address, manufacturer.address, distributor.address, retailer.address]);
    await supplyChain.waitForDeployment();
  });

  // The following are all the tests
  it("Should successfully deploy the contract and grant roles in the constructor", async () => {
    expect(supplyChain.target).to.not.be.undefined;
  });

  it("Should verify that the roles have been set correctly", async () => {
    // Verify that the contract has the correct addresses for each role
    expect(await supplyChain.getRoleMembers(supplyChain.DEFAULT_ADMIN_ROLE())).to.include(owner.address);
    expect(await supplyChain.getRoleMembers(supplyChain.MANUFACTURER_ROLE())).to.include(manufacturer.address);
    expect(await supplyChain.getRoleMembers(supplyChain.DISTRIBUTOR_ROLE())).to.include(distributor.address);
    expect(await supplyChain.getRoleMembers(supplyChain.RETAILER_ROLE())).to.include(retailer.address);
  })
    
  it("Should calculate a valid message hash", async () => {
    const pufId = BigInt(0)
    const challenge = BigInt(102)
    // Calculate the message hash using the keccak256 function from ethers lib
    const messageHash0 = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId, challenge]);
    // Calculate the message hash using the contract function
    const messageHash1 = await supplyChain.calculateExpectedHash(pufId, challenge);
    // Verify that the hashes are equal
    expect(messageHash0).to.equal(messageHash1);
  });

  it("Should add a valid PUF ID", async () => {
    const pufId = 0
    const challenge = challenges[0]; // Challenge values are stored off-chain. the off-chain calculated hash must match the hashes already stored
    // Calculate the message hash using the keccak256 function from ethers lib
    const messageHash0 = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId, challenge]);
    // Calculate the message hash using the contract function
    const messageHash1 = await supplyChain.calculateExpectedHash(pufId, challenge);
    // Verify that the hashes are equal
    expect(messageHash0).to.equal(messageHash1);
    // Store the pufId + its respective messageHash on chain
    await supplyChain.connect(manufacturer).addValidPufId(pufId, messageHash0);
  });

  it("Should allow someone with a valid response hash to add a product", async () => {
    const pufId = BigInt(0);
    const challenge = BigInt(challenges[0]); // Challenge values are stored off-chain. the off-chain calculated hash must match the hashes already stored on-chain by the contract owner (can be the manufacturer or some 3rd party transparency agency)
    const messageHash = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId, challenge]);
    const location = "New York";

    await supplyChain.connect(manufacturer).addProduct(pufId, messageHash, location, productOwner1.address);
    const product = await supplyChain.getProduct(pufId);
    expect(product.pufId).to.equal(pufId);
  });

  it("Should allow someone with a valid response hash to update a product's location", async () => {
    const pufId = BigInt(0);
    const challenge = BigInt(challenges[0]); // Challenge values are stored off-chain. the off-chain calculated hash must match the hashes already stored on-chain by the contract owner (can be the manufacturer or some 3rd party transparency agency)
    const messageHash = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId, challenge]);
    const location = "New York";

    await supplyChain.connect(manufacturer).addProduct(pufId, messageHash, location, productOwner1.address);
    const product = await supplyChain.getProduct(pufId);
    expect(product.pufId).to.equal(pufId);

    // Now update the location
    const newLocation = "Alabama";
    await supplyChain.updateLocation(pufId, newLocation, messageHash);
    const updatedProduct = await supplyChain.getProduct(pufId);
    expect(updatedProduct.location).to.equal(newLocation);
  });

  it("Should allow the product owner to transfer ownership of a product", async () => {
    const pufId = BigInt(0);
    const challenge = BigInt(challenges[0]); // Challenge values are stored off-chain. the off-chain calculated hash must match the hashes already stored on-chain by the contract owner (can be the manufacturer or some 3rd party transparency agency)
    const messageHash = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId, challenge]);
    const location = "New York";

    await supplyChain.connect(manufacturer).addProduct(pufId, messageHash, location, productOwner1.address);
    // Fetch product
    let product = await supplyChain.getProduct(pufId);
    expect(product.productOwner).to.equal(productOwner1.address);
    await supplyChain.connect(productOwner1).transferOwnership(pufId, productOwner2.address);
    product = await supplyChain.getProduct(pufId);
    // Check that the product is now owned by owner 2
    expect(product.productOwner).to.equal(productOwner2.address);
  });
  
  it("Should retrieve all products in the system", async () => {
    const pufId0 = BigInt(0);
    const pufId1 = BigInt(1);
    const challenge0 = BigInt(challenges[0]); // Challenge values are stored off-chain. the off-chain calculated hash must match the hashes already stored on-chain by the contract owner (can be the manufacturer or some 3rd party transparency agency)
    const challenge1 = BigInt(challenges[1]);

    const messageHash0 = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId0, challenge0]);
    const messageHash1 = ethers.solidityPackedKeccak256(["uint256", "uint256"], [pufId1, challenge1]);
    // We must first add the second pufId as a valid pufId. pufId0 is already added in a test above
    await supplyChain.connect(manufacturer).addValidPufId(pufId1, messageHash1);

    const location0 = "New York";
    const location1 = "Alabama";

    await supplyChain.connect(manufacturer).addProduct(pufId0, messageHash0, location0, productOwner1.address);
    await supplyChain.connect(manufacturer).addProduct(pufId1, messageHash1, location1, productOwner2.address);
    // Fetch all products
    const products = await supplyChain.getAllProducts();
    expect(products.length).to.equal(2);
  });

});