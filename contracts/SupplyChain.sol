// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ISupplyChain} from "./ISupplyChain.sol";
import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {EnumerableMap} from "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";

/// @title Supply Chain Management Contract
/// @notice Manages product tracking through manufacturing, distribution, and retail phases
contract SupplyChain is ISupplyChain, AccessControlEnumerable {
    using EnumerableMap for EnumerableMap.UintToBytes32Map;

    /// @notice Role identifier for manufacturers
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    /// @notice Role identifier for distributors
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    /// @notice Role identifier for retailers
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");

    /// @notice Iterable mapping storing expected hashes against pufID+Challenge hashes
    EnumerableMap.UintToBytes32Map private validPufIds;

    /// @notice Returns the hash associated with a given PUF ID
    /// @param pufId The physical unclonable function identifier
    /// @return The stored hash for the given PUF ID
    function getPufIdHash(uint256 pufId) public view returns (bytes32) {
        return validPufIds.get(pufId);
    }

    /// @notice Initializes the contract with admin and role addresses
    /// @param owner The address that will have DEFAULT_ADMIN_ROLE
    /// @param manufacturer The address that will have MANUFACTURER_ROLE
    /// @param distributor The address that will have DISTRIBUTOR_ROLE
    /// @param retailer The address that will have RETAILER_ROLE
    constructor(address owner, address manufacturer, address distributor, address retailer) {
        _grantRole(DEFAULT_ADMIN_ROLE, owner);
        _grantRole(MANUFACTURER_ROLE, manufacturer);
        _grantRole(DISTRIBUTOR_ROLE, distributor);
        _grantRole(RETAILER_ROLE, retailer);
    }

    /// @notice Mapping storing product records against their unique pufId
    mapping(uint256 => ProductRecord) public products;

    /// @dev Modifier that restricts access to manufacturers only
    modifier onlyManufacturer() {
        if (!hasRole(MANUFACTURER_ROLE, msg.sender)) {
            revert CallerNotManufacturer(msg.sender);
        }
        _;
    }

    /// @dev Modifier that restricts access to distributors only
    modifier onlyDistributor() {
        if (!hasRole(DISTRIBUTOR_ROLE, msg.sender)) {
            revert CallerNotDistributor(msg.sender);
        }
        _;
    }

    /// @dev Modifier that restricts access to retailers only
    modifier onlyRetailer() {
        if (!hasRole(RETAILER_ROLE, msg.sender)) {
            revert CallerNotRetailer(msg.sender);
        }
        _;
    }

    /// @notice Stores a list of valid PUF IDs with their corresponding hashed responses
    /// @dev The expectedHash is the result of sha256-hashing the challenge+pufid combination
    /// @param _pufId The physical unclonable function identifier
    /// @param _expectedResponseHash The expected hash response for the PUF ID
    function addValidPufId(uint256 _pufId, bytes32 _expectedResponseHash) external onlyManufacturer {
        require(!validPufIds.contains(_pufId), "PufId already exists");
        validPufIds.set(_pufId, _expectedResponseHash);
        emit ValidPUFIdAdded(_pufId, _expectedResponseHash, msg.sender);
    }

    /// @notice Stores product information including PUF ID, hash, location, and owner
    /// @param _pufId The physical unclonable function identifier
    /// @param _suppliedHash The hash supplied for validation
    /// @param _location The current location of the product
    /// @param _productOwner The current owner of the product
    function addProduct(uint256 _pufId, bytes32 _suppliedHash, string memory _location, address _productOwner)
        external
        onlyManufacturer
    {
        performValidation(_pufId, _suppliedHash);
        products[_pufId] = ProductRecord(_pufId, _suppliedHash, _location, block.timestamp, _productOwner, true);
        emit RecordAdded(_pufId, _location);
    }

    /// @notice Updates the location of a product
    /// @dev Can be called by either distributor or retailer
    /// @param pufId The physical unclonable function identifier
    /// @param location The new location of the product
    /// @param suppliedHash The hash supplied for validation
    function updateLocation(uint256 pufId, string memory location, bytes32 suppliedHash) external {
        require(performValidation(pufId, suppliedHash), CallerNotDistributorOrRetailer(msg.sender));
        products[pufId].location = location;
        emit RecordAdded(products[pufId].pufId, location);
    }

    /// @notice Transfers product ownership to a new owner
    /// @dev Only the current product owner can call this function
    /// @param _pufId The physical unclonable function identifier
    /// @param _newOwner The address of the new owner
    function transferOwnership(uint256 _pufId, address _newOwner) external {
        address _oldOwner = products[_pufId].productOwner;
        require(_oldOwner == msg.sender, CallerNotOwner(msg.sender));
        products[_pufId].productOwner = _newOwner;
        emit OwnershipTransferred(_pufId, _newOwner, _oldOwner);
    }

    /// @notice Returns product information for a given PUF ID
    /// @param _pufId The physical unclonable function identifier
    /// @return product The product record containing all information
    function getProduct(uint256 _pufId) external view returns (ProductRecord memory product) {
        product = products[_pufId];
    }

    /// @notice Returns all products stored in the contract
    /// @dev Warning: This function should not be called during state-changing operations
    /// @return Array of all product records
    function getAllProducts() external view returns (ProductRecord[] memory) {
        ProductRecord[] memory allProducts = new ProductRecord[](validPufIds.length());
        for (uint256 i; i < validPufIds.length(); i++) {
            (uint256 pufId,) = validPufIds.at(i);
            allProducts[i] = products[pufId];
        }
        return allProducts;
    }

    /// @notice Validates that the supplied hash matches the expected hash for a PUF ID
    /// @param pufId The physical unclonable function identifier
    /// @param suppliedHash The hash supplied for validation
    /// @return True if validation passes, false otherwise
    function performValidation(uint256 pufId, bytes32 suppliedHash) public view returns (bool) {
        bytes32 expectedHash = validPufIds.get(pufId);
        return expectedHash == suppliedHash;
    }

    /// @notice Calculates the expected hash for a given PUF ID and challenge
    /// @param pufId The physical unclonable function identifier
    /// @param challenge The challenge value used for hash calculation
    /// @return The calculated expected hash
    function calculateExpectedHash(uint256 pufId, uint256 challenge) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(pufId, challenge));
    }
}
