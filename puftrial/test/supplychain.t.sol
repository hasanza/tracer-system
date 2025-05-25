// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

//import "forge-std/Test.sol";
//import "forge-std/src/Test.sol";
import "../lib/forge-std/src/Test.sol";
import "../contracts/supplychain2.sol";

contract SupplyChainTest is Test {
    SupplyChain public supplyChain;

    // private keys for signing
    uint256 ownerKey         = 0xA1;
    uint256 manufacturerKey  = 0xA2;
    uint256 distributorKey   = 0xA3;
    uint256 retailerKey      = 0xA4;
    uint256 supplierKey      = 0xA5;
    uint256 productOwner1Key = 0xB1;
    uint256 productOwner2Key = 0xB2;

    // derived addresses
    address owner;
    address manufacturer;
    address distributor;
    address retailer;
    address supplier;
    address productOwner1;
    address productOwner2;

    function setUp() public {
        owner          = vm.addr(ownerKey);
        manufacturer   = vm.addr(manufacturerKey);
        distributor    = vm.addr(distributorKey);
        retailer       = vm.addr(retailerKey);
        supplier       = vm.addr(supplierKey);
        productOwner1  = vm.addr(productOwner1Key);
        productOwner2  = vm.addr(productOwner2Key);

        vm.startPrank(owner);
        supplyChain = new SupplyChain(
            manufacturer,
            distributor,
            retailer,
            supplier
        );
        vm.stopPrank();
    }

    /// @notice Check all five roles in one go, only calling hasRole()
    function testHasRole() public view {
        // constants for roles (we hard-code DEFAULT_ADMIN_ROLE = 0x00 per OZ AccessControl)
        bytes32 adminRole        = 0x0000000000000000000000000000000000000000000000000000000000000000;
        bytes32 manufacturerRole = keccak256(abi.encodePacked("MANUFACTURER_ROLE"));
        bytes32 distributorRole  = keccak256(abi.encodePacked("DISTRIBUTOR_ROLE"));
        bytes32 retailerRole     = keccak256(abi.encodePacked("RETAILER_ROLE"));
        bytes32 supplierRole     = keccak256(abi.encodePacked("SUPPLIER_ROLE"));

        // now do exactly 5 calls to hasRole()
        assertTrue(supplyChain.hasRole(adminRole, owner),        "admin");
        assertTrue(supplyChain.hasRole(manufacturerRole, manufacturer), "manufacturer");
        assertTrue(supplyChain.hasRole(distributorRole, distributor),   "distributor");
        assertTrue(supplyChain.hasRole(retailerRole, retailer),         "retailer");
        assertTrue(supplyChain.hasRole(supplierRole, supplier),         "supplier");
    }

    function testAddValidPufIdEmitsEvent() public {
        uint256 pufId        = 42;
        uint256 challengeVal = 99;
        bytes32 expectedHash = keccak256(abi.encodePacked(pufId, challengeVal));

        vm.prank(manufacturer);
        vm.expectEmit(true, true, false, true, address(supplyChain));
        emit SupplyChain.PufIdEnrolled(pufId, expectedHash);
        supplyChain.addValidPufId(pufId, expectedHash);
    }

    function testAddProductAndInspect() public {
        uint256 pufId     = 7;
        uint256 challenge = 13;
        bytes32 respHash  = keccak256(abi.encodePacked(pufId, challenge));
        string memory loc = "Paris";

        vm.prank(manufacturer);
        supplyChain.addValidPufId(pufId, respHash);

        // sign the challenge
        bytes32 msgHash = keccak256(abi.encodePacked(pufId, challenge));
        bytes32 ethMsg  = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(productOwner1Key, ethMsg);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(manufacturer);
        supplyChain.addProduct(pufId, challenge, respHash, loc, productOwner1, sig);

        // inspect via getAllProducts
        SupplyChain.ProductRecord[] memory all = supplyChain.getAllProducts();
        SupplyChain.ProductRecord memory rec = all[0];

        assertEq(rec.pufId,        pufId,                                         "pufId");
        assertEq(rec.challenge,    challenge,                                     "challenge");
        assertEq(rec.responseHash, respHash,                                      "responseHash");
        assertEq(rec.location,     loc,                                           "location");
        assertEq(rec.productOwner, productOwner1,                                 "owner");
        assertEq(uint(rec.status), uint(SupplyChain.ProductStatus.Manufactured), "status");
        assertEq(keccak256(rec.signature), keccak256(sig),                       "signature");
    }

    function testVerifyPufSignatureAndId() public {
        uint256 pufId     = 21;
        uint256 challenge = 22;
        bytes32 respHash  = keccak256(abi.encodePacked(pufId, challenge));

        vm.prank(manufacturer);
        supplyChain.addValidPufId(pufId, respHash);

        bytes32 msgHash = keccak256(abi.encodePacked(pufId, challenge));
        bytes32 ethMsg  = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(productOwner1Key, ethMsg);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.prank(manufacturer);
        supplyChain.addProduct(pufId, challenge, respHash, "X", productOwner1, sig);

        assertTrue(
            supplyChain.verifyPufSignature(pufId, challenge, sig),
            "sig valid"
        );

        bytes32 rawHash = keccak256(abi.encodePacked(challenge, pufId));
        assertTrue(
            supplyChain.verifyPufId(pufId, rawHash),
            "raw PUF valid"
        );
    }

    function testUpdateLocationAndTransfer() public {
        uint256 pufId     = 8;
        uint256 challenge = 9;
        bytes32 respHash  = keccak256(abi.encodePacked(pufId, challenge));

        vm.prank(manufacturer);
        supplyChain.addValidPufId(pufId, respHash);

        bytes32 msgHash = keccak256(abi.encodePacked(pufId, challenge));
        bytes32 ethMsg  = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(productOwner1Key, ethMsg);
        bytes memory sig = abi.encodePacked(r, s, v);
        vm.prank(manufacturer);
        supplyChain.addProduct(pufId, challenge, respHash, "Start", productOwner1, sig);

        // authorized updateLocation
        vm.prank(distributor);
        vm.expectEmit(true, false, false, true, address(supplyChain));
        emit SupplyChain.LocationUpdated(pufId, "EnRoute");
        supplyChain.updateLocation(pufId, "EnRoute");

        // transferOwnership
        vm.prank(productOwner1);
        vm.expectEmit(true, true, true, false, address(supplyChain));
        emit SupplyChain.OwnershipTransferred(pufId, productOwner2, productOwner1);
        supplyChain.transferOwnership(pufId, productOwner2);

        SupplyChain.ProductRecord memory finalRec = supplyChain.getAllProducts()[0];
        assertEq(finalRec.productOwner, productOwner2, "final owner");
    }

    /// @notice Measure gas for 100 enrollments
    function testAddValidPufId_100calls() public {
        for (uint256 i = 0; i < 100; i++) {
            bytes32 hash = keccak256(abi.encodePacked(i, i + 1));
            vm.prank(manufacturer);
            supplyChain.addValidPufId(i, hash);
        }
    }

    


}

