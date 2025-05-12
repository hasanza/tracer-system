// test/SupplyChainTest.t.sol
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/SupplyChain.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SupplyChainTest is Test {
    using ECDSA for bytes32;

    SupplyChain chain;
    address admin       = vm.addr(0xA0);
    address manufacturer= vm.addr(0xB0);
    address distributor = vm.addr(0xC0);
    address retailer    = vm.addr(0xD0);

    function setUp() public {
        // Deploy under “admin” then grant roles in constructor
        vm.prank(admin);
        chain = new SupplyChain(admin, manufacturer, distributor, retailer);
    }

    function testEnrollAndAuthenticate100Tags() public {
        uint256 constant N = 100;

        // 1) Enroll 100 tags
        for (uint i = 0; i < N; i++) {
            // Derive a pseudo‐random PUF ID and challenge
            uint256 pufId      = uint256(keccak256(abi.encodePacked("PUF", i)));
            uint256 challenge  = uint256(keccak256(abi.encodePacked("CHAL", i)));
            bytes32 respHash   = chain.calculateExpectedHash(pufId, challenge);

            // Surrogate “raw pubKey bytes”: here we just abi.encode the tag‐address
            // so expectedSigner = vm.addr(privKey) must match whatever the contract does.
            // You need this to match your on‐chain keccak256→address logic!
            uint256 privKey    = uint256(keccak256(abi.encodePacked(respHash)));
            address tagAddr    = vm.addr(privKey);
            bytes memory pubKeyBytes = abi.encodePacked(tagAddr);

            // Enroll under MANUFACTURER_ROLE
            vm.prank(manufacturer);
            chain.addValidPufId(pufId, respHash, pubKeyBytes);
        }

        // 2) For each tag, simulate signing + on‐chain addProduct
        for (uint i = 0; i < N; i++) {
            uint256 pufId     = uint256(keccak256(abi.encodePacked("PUF", i)));
            uint256 challenge = uint256(keccak256(abi.encodePacked("CHAL", i)));
            bytes32 respHash  = chain.calculateExpectedHash(pufId, challenge);

            // Re‐derive the same private key
            uint256 privKey   = uint256(keccak256(abi.encodePacked(respHash)));

            // Off‐chain: sign the Ethereum‐prefixed hash of the response
            bytes32 ethHash = respHash.toEthSignedMessageHash();
            (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, ethHash);
            bytes memory signature = abi.encodePacked(r, s, v);

            // On‐chain call under MANUFACTURER_ROLE
            vm.prank(manufacturer);
            chain.addProduct(
                pufId,
                respHash,
                "Warehouse-1",
                distributor,
                signature
            );

            // Should have a product record now
            (SupplyChain.ProductRecord memory rec) = chain.getProduct(pufId);
            assertEq(rec.pufId, pufId);
            assertEq(rec.responseHash, respHash);
            assertEq(rec.productOwner, distributor);
        }
    }
}
