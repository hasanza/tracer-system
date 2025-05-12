// test/SupplyChainAdvanced.t.sol
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/SupplyChain.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SupplyChainAdvancedTest is Test {
    using ECDSA for bytes32;

    SupplyChain chain;
    address admin        = vm.addr(0xA0);
    address manufacturer = vm.addr(0xB0);
    address distributor  = vm.addr(0xC0);
    address retailer     = vm.addr(0xD0);

    uint256 pufId;
    bytes32 respHash;
    bytes   pubKeyBytes;
    uint256 privKey;

    function setUp() public {
        // Deploy and enroll one tag
        vm.prank(admin);
        chain = new SupplyChain(admin, manufacturer, distributor, retailer);

        // Fixed challenge → hash → keys
        pufId     = uint256(keccak256("TEST_PUF"));
        uint256 chal = uint256(keccak256("TEST_CHAL"));
        respHash  = chain.calculateExpectedHash(pufId, chal);

        privKey       = uint256(keccak256(abi.encodePacked(respHash)));
        address tagAddr = vm.addr(privKey);
        pubKeyBytes   = abi.encodePacked(tagAddr);

        vm.prank(manufacturer);
        chain.addValidPufId(pufId, respHash, pubKeyBytes);
    }

    /// @dev Helper to sign the response hash
    function signResp() internal returns (bytes memory) {
        bytes32 ethHash = respHash.toEthSignedMessageHash();
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(privKey, ethHash);
        return abi.encodePacked(r, s, v);
    }

    function testReplayAttack() public {
        // First submit should pass
        bytes memory sig = signResp();
        vm.prank(manufacturer);
        chain.addProduct(pufId, respHash, "LocA", distributor, sig);

        // Replay the same signature + params: should revert (duplicate product)
        vm.prank(manufacturer);
        vm.expectRevert("Hash mismatch"); // or custom error if you change logic
        chain.addProduct(pufId, respHash, "LocA", distributor, sig);
    }

    function testProductLifecycle() public {
        // 1) addProduct
        bytes memory sig1 = signResp();
        vm.prank(manufacturer);
        chain.addProduct(pufId, respHash, "Factory", distributor, sig1);

        // 2) updateLocation as distributor
        bytes memory sig2 = signResp();
        vm.prank(distributor);
        chain.updateLocation(pufId, "Warehouse", respHash, sig2);

        // 3) updateLocation as retailer
        bytes memory sig3 = signResp();
        vm.prank(retailer);
        chain.updateLocation(pufId, "RetailStore", respHash, sig3);

        // Verify final record
        ISupplyChain.ProductRecord memory rec = chain.getProduct(pufId);
        assertEq(rec.location, "RetailStore");
        assertEq(rec.productOwner, distributor); // owner unchanged by updates
    }

    function testProofOfOwnership() public {
        // addProduct by manufacturer assigns owner
        bytes memory sig = signResp();
        vm.prank(manufacturer);
        chain.addProduct(pufId, respHash, "LocX", distributor, sig);

        // The on-chain record owner must match `distributor`
        ISupplyChain.ProductRecord memory rec = chain.getProduct(pufId);
        assertEq(rec.productOwner, distributor);
    }

    function testTransferOwnership() public {
        // Setup: addProduct
        bytes memory sig = signResp();
        vm.prank(manufacturer);
        chain.addProduct(pufId, respHash, "LocX", distributor, sig);

        // Transfer ownership from distributor → retailer
        vm.prank(distributor);
        chain.transferOwnership(pufId, retailer);

        // Confirm owner changed
        ISupplyChain.ProductRecord memory rec = chain.getProduct(pufId);
        assertEq(rec.productOwner, retailer);

        // Only current owner may transfer again
        vm.prank(distributor);
        vm.expectRevert("CallerNotOwner");
        chain.transferOwnership(pufId, admin);
    }
}
