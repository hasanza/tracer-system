// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

// Interface definition
interface ISupplyChain {
    struct ProductRecord {
        uint256 pufId;
        bytes32 responseHash;
        string  location;
        uint256 timestamp;
        address productOwner;
        bool    exists;
    }

    event ValidPUFIdAdded(uint256 indexed pufId, bytes32 indexed expectedResponseHash, address indexed addedBy);
    event ProductAdded(uint256 indexed pufId, string location, address owner);
    event RecordAdded(uint256 indexed pufId, string location);
    event OwnershipTransferred(uint256 indexed pufId, address newOwner, address oldOwner);

    function MANUFACTURER_ROLE() external view returns (bytes32);
    function DISTRIBUTOR_ROLE() external view returns (bytes32);
    function RETAILER_ROLE() external view returns (bytes32);

    function addValidPufId(uint256 pufId, bytes32 expectedResponseHash, bytes calldata pubKey) external;
    function addProduct(
        uint256 pufId,
        bytes32 suppliedHash,
        string calldata location,
        address newOwner,
        bytes calldata signature
    ) external;
    function updateLocation(
        uint256 pufId,
        string calldata location,
        bytes32 suppliedHash,
        bytes calldata signature
    ) external;

    function getProduct(uint256 pufId) external view returns (ProductRecord memory);
    function getAllProducts() external view returns (ProductRecord[] memory);
    function performValidation(uint256 pufId, bytes32 suppliedHash) external view returns (bool);
    function calculateExpectedHash(uint256 pufId, uint256 challenge) external pure returns (bytes32);
}

// Implementation
contract SupplyChain is ISupplyChain, AccessControlEnumerable {
    using EnumerableMap for EnumerableMap.UintToBytes32Map;
    using ECDSA for bytes32;

    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE   = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE      = keccak256("RETAILER_ROLE");

    // Mapping of valid PUF IDs to expected hash
    EnumerableMap.UintToBytes32Map private validPufIds;
    // Store raw public key bytes for each PUF (uncompressed 64-byte X||Y)
    mapping(uint256 => bytes) public pufPubKeys;
    // Product records
    mapping(uint256 => ProductRecord) public products;

    constructor(
        address admin,
        address manufacturer,
        address distributor,
        address retailer
    ) {
        _setupRole(DEFAULT_ADMIN_ROLE, admin);
        _setupRole(MANUFACTURER_ROLE, manufacturer);
        _setupRole(DISTRIBUTOR_ROLE, distributor);
        _setupRole(RETAILER_ROLE, retailer);
    }

    modifier onlyManufacturer() {
        require(hasRole(MANUFACTURER_ROLE, msg.sender), "CallerNotManufacturer");
        _;
    }
    modifier onlyDistributorOrRetailer() {
        require(
            hasRole(DISTRIBUTOR_ROLE, msg.sender) || hasRole(RETAILER_ROLE, msg.sender),
            "CallerNotDistributorOrRetailer"
        );
        _;
    }

    function addValidPufId(
        uint256 pufId,
        bytes32 expectedResponseHash,
        bytes calldata pubKey
    ) external override onlyManufacturer {
        require(!validPufIds.contains(pufId), "PUF already enrolled");
        validPufIds.set(pufId, expectedResponseHash);
        pufPubKeys[pufId] = pubKey;
        emit ValidPUFIdAdded(pufId, expectedResponseHash, msg.sender);
    }

    function addProduct(
        uint256 pufId,
        bytes32 suppliedHash,
        string calldata location,
        address newOwner,
        bytes calldata signature
    ) external override onlyManufacturer {
        // 1) Ensure expected hash matches
        bytes32 expected = calculateExpectedHash(pufId, uint256(suppliedHash));
        require(validPufIds.get(pufId) == suppliedHash, "Hash mismatch");

        // 2) Verify signature
        //    Recreate Ethereum Signed Message hash
        bytes32 msgHash = suppliedHash.toEthSignedMessageHash();
        address signer = msgHash.recover(signature);
        //    Derive registered address from stored raw pubKey
        bytes memory pubKey = pufPubKeys[pufId];
        address expectedSigner = address(uint160(uint256(keccak256(pubKey))));
        require(signer == expectedSigner, "Bad signature");

        // 3) Record product
        products[pufId] = ProductRecord({
            pufId:        pufId,
            responseHash: suppliedHash,
            location:     location,
            timestamp:    block.timestamp,
            productOwner: newOwner,
            exists:       true
        });
        emit ProductAdded(pufId, location, newOwner);
    }

    function updateLocation(
        uint256 pufId,
        string calldata location,
        bytes32 suppliedHash,
        bytes calldata signature
    ) external override onlyDistributorOrRetailer {
        require(products[pufId].exists, "ProductNotFound");
        require(validPufIds.get(pufId) == suppliedHash, "Hash mismatch");

        bytes32 msgHash = suppliedHash.toEthSignedMessageHash();
        address signer = msgHash.recover(signature);
        bytes memory pubKey = pufPubKeys[pufId];
        address expectedSigner = address(uint160(uint256(keccak256(pubKey))));
        require(signer == expectedSigner, "Bad signature");

        products[pufId].location = location;
        products[pufId].timestamp = block.timestamp;
        emit RecordAdded(pufId, location);
    }

    function getProduct(uint256 pufId) external view override returns (ProductRecord memory) {
        return products[pufId];
    }

    function getAllProducts() external view override returns (ProductRecord[] memory) {
        uint256 len = validPufIds.length();
        ProductRecord[] memory list = new ProductRecord[](len);
        for (uint256 i = 0; i < len; i++) {
            uint256 key = validPufIds.at(i).key;
            list[i] = products[key];
        }
        return list;
    }

    function performValidation(uint256 pufId, bytes32 suppliedHash) external view override returns (bool) {
        return (validPufIds.get(pufId) == suppliedHash);
    }

    function calculateExpectedHash(uint256 pufId, uint256 challenge) external pure override returns (bytes32) {
        return keccak256(abi.encodePacked(pufId, challenge));
    }
}
