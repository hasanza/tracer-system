// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

import "forge-std/Test.sol";
import "../contracts/SupplyChain.sol";
import "../contracts/ISupplyChain.sol";

contract SupplyChainTest is Test {
    SupplyChain public supplyChain;

    // Roles
    address owner;
    address manufacturer;
    address distributor;
    address retailer;
    address productOwner1;
    address productOwner2;

    // Test data
    uint256[] challenges = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    function setUp() public {
        // Set up accounts
        owner = address(this); // Test contract acts as owner by default
        manufacturer = address(0x1);
        distributor = address(0x2);
        retailer = address(0x3);
        productOwner1 = address(0x4);
        productOwner2 = address(0x5);

        // Deploy contract
        supplyChain = new SupplyChain(owner, manufacturer, distributor, retailer);

        // Label addresses for better error messages
        vm.label(manufacturer, "Manufacturer");
        vm.label(distributor, "Distributor");
        vm.label(retailer, "Retailer");
        vm.label(productOwner1, "ProductOwner1");
        vm.label(productOwner2, "ProductOwner2");
    }

    function testDeployment() public view {
        assertTrue(address(supplyChain) != address(0), "Contract should deploy");
    }

    function testRoleAssignment() public view {
        // Check DEFAULT_ADMIN_ROLE
        assertTrue(supplyChain.hasRole(supplyChain.DEFAULT_ADMIN_ROLE(), owner), "Owner should have admin role");

        // Check other roles
        assertTrue(supplyChain.hasRole(supplyChain.MANUFACTURER_ROLE(), manufacturer), "Manufacturer role not set");
        assertTrue(supplyChain.hasRole(supplyChain.DISTRIBUTOR_ROLE(), distributor), "Distributor role not set");
        assertTrue(supplyChain.hasRole(supplyChain.RETAILER_ROLE(), retailer), "Retailer role not set");
    }

    function testHashCalculation() public view {
        uint256 pufId = 0;
        uint256 challenge = 102;

        bytes32 messageHash0 = keccak256(abi.encodePacked(pufId, challenge));
        bytes32 messageHash1 = supplyChain.calculateExpectedHash(pufId, challenge);

        assertEq(messageHash0, messageHash1, "Hashes should match");
    }

    function testAddValidPufId() public {
        uint256 pufId = 0;
        uint256 challenge = challenges[0];

        bytes32 messageHash = keccak256(abi.encodePacked(pufId, challenge));

        // Test as manufacturer
        vm.prank(manufacturer);
        supplyChain.addValidPufId(pufId, messageHash);

        // Verify storage
        bytes32 storedHash = supplyChain.getPufIdHash(pufId);
        assertEq(storedHash, messageHash, "Hash not stored correctly");
    }

    function testAddProduct() public {
        uint256 pufId = 0;
        uint256 challenge = challenges[0];
        bytes32 messageHash = keccak256(abi.encodePacked(pufId, challenge));
        string memory location = "New York";

        // First add valid PUF ID
        vm.prank(manufacturer);
        supplyChain.addValidPufId(pufId, messageHash);

        // Then add product
        vm.prank(manufacturer);
        supplyChain.addProduct(pufId, messageHash, location, productOwner1);

        // Verify product
        ISupplyChain.ProductRecord memory product = supplyChain.getProduct(pufId);
        assertEq(product.pufId, pufId, "Product PUF ID mismatch");
        assertEq(product.productOwner, productOwner1, "Product owner mismatch");
    }

    function testUpdateProductLocation() public {
        uint256 pufId = 0;
        uint256 challenge = challenges[0];
        bytes32 messageHash = keccak256(abi.encodePacked(pufId, challenge));
        string memory newLocation = "Los Angeles";

        // Setup: add valid PUF and product
        vm.startPrank(manufacturer);
        supplyChain.addValidPufId(pufId, messageHash);
        supplyChain.addProduct(pufId, messageHash, "New York", productOwner1);
        vm.stopPrank();

        // Update location
        vm.prank(manufacturer);
        supplyChain.updateLocation(pufId, newLocation, messageHash);

        // Verify update
        SupplyChain.ProductRecord memory product = supplyChain.getProduct(pufId);
        assertEq(product.location, newLocation, "Location not updated");
    }

    function testTransferOwnership() public {
        uint256 pufId = 0;
        uint256 challenge = challenges[0];
        bytes32 messageHash = keccak256(abi.encodePacked(pufId, challenge));

        // Setup
        vm.startPrank(manufacturer);
        supplyChain.addValidPufId(pufId, messageHash);
        supplyChain.addProduct(pufId, messageHash, "New York", productOwner1);
        vm.stopPrank();

        // Transfer
        vm.prank(productOwner1);
        supplyChain.transferOwnership(pufId, productOwner2);

        // Verify
        SupplyChain.ProductRecord memory product = supplyChain.getProduct(pufId);
        assertEq(product.productOwner, productOwner2, "Ownership not transferred");
    }

    function testGetAllProducts() public {
        uint256 pufId0 = 0;
        uint256 pufId1 = 1;
        uint256 challenge0 = challenges[0];
        uint256 challenge1 = challenges[1];

        bytes32 messageHash0 = keccak256(abi.encodePacked(pufId0, challenge0));
        bytes32 messageHash1 = keccak256(abi.encodePacked(pufId1, challenge1));

        // Setup
        vm.startPrank(manufacturer);
        supplyChain.addValidPufId(pufId0, messageHash0);
        supplyChain.addValidPufId(pufId1, messageHash1);
        supplyChain.addProduct(pufId0, messageHash0, "New York", productOwner1);
        supplyChain.addProduct(pufId1, messageHash1, "Alabama", productOwner2);
        vm.stopPrank();

        // Test
        SupplyChain.ProductRecord[] memory products = supplyChain.getAllProducts();
        assertEq(products.length, 2, "Should return 2 products");
    }
}
