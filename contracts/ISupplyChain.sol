// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Supply Chain Management Interface
/// @notice Defines the interface for managing product tracking through manufacturing, distribution, and retail phases
interface ISupplyChain {
    // Roles
    /// @notice Returns the role identifier for manufacturers
    /// @return The bytes32 role identifier for MANUFACTURER_ROLE
    function MANUFACTURER_ROLE() external view returns (bytes32);

    /// @notice Returns the role identifier for distributors
    /// @return The bytes32 role identifier for DISTRIBUTOR_ROLE
    function DISTRIBUTOR_ROLE() external view returns (bytes32);

    /// @notice Returns the role identifier for retailers
    /// @return The bytes32 role identifier for RETAILER_ROLE
    function RETAILER_ROLE() external view returns (bytes32);

    // Structs
    /// @notice Product record containing tracking information
    /// @param pufId Unique identifier of the product (Physical Unclonable Function ID)
    /// @param responseHash Hash of the PUF ID + challenge values
    /// @param location Human-readable name of the product's current location
    /// @param timestamp Block timestamp when the record was last updated
    /// @param productOwner Current owner of the product
    /// @param exists Flag indicating whether the product record exists
    struct ProductRecord {
        uint256 pufId;
        bytes32 responseHash;
        string location;
        uint256 timestamp;
        address productOwner;
        bool exists;
    }

    // Events
    /// @notice Emitted when a new valid PUF ID is added to the system
    /// @param pufId The PUF ID that was added
    /// @param expectedResponseHash The expected hash response for this PUF ID
    /// @param addedBy The address that added this PUF ID
    event ValidPUFIdAdded(uint256 pufId, bytes32 expectedResponseHash, address addedBy);

    /// @notice Emitted when a new product is added to the system
    /// @param pufId The PUF ID of the added product
    /// @param location The initial location of the product
    /// @param owner The initial owner of the product
    event ProductAdded(uint256 pufId, string location, address owner);

    /// @notice Emitted when product ownership is transferred
    /// @param pufId The PUF ID of the product
    /// @param newOwner The address of the new owner
    /// @param oldOwner The address of the previous owner
    event OwnershipTransferred(uint256 pufId, address newOwner, address oldOwner);

    /// @notice Emitted when a product record is updated
    /// @param pufId The PUF ID of the updated product
    /// @param location The new location of the product
    event RecordAdded(uint256 pufId, string location);

    // Errors
    /// @notice Thrown when the caller is not the product owner
    /// @param owner The actual owner address
    error CallerNotOwner(address owner);

    /// @notice Thrown when the caller doesn't have manufacturer role
    /// @param manufacturer The expected manufacturer address
    error CallerNotManufacturer(address manufacturer);

    /// @notice Thrown when the caller doesn't have distributor role
    /// @param caller The unauthorized caller address
    error CallerNotDistributor(address caller);

    /// @notice Thrown when the caller doesn't have retailer role
    /// @param caller The unauthorized caller address
    error CallerNotRetailer(address caller);

    /// @notice Thrown when the caller doesn't have distributor or retailer role
    /// @param caller The unauthorized caller address
    error CallerNotDistributorOrRetailer(address caller);

    // Functions
    /// @notice Gets the hash associated with a PUF ID
    /// @param pufId The PUF ID to query
    /// @return The stored hash for the given PUF ID
    function getPufIdHash(uint256 pufId) external view returns (bytes32);

    /// @notice Adds a new valid PUF ID with its expected response hash
    /// @dev Only callable by addresses with MANUFACTURER_ROLE
    /// @param _pufId The PUF ID to add
    /// @param _expectedResponseHash The expected hash response for this PUF ID
    function addValidPufId(uint256 _pufId, bytes32 _expectedResponseHash) external;

    /// @notice Adds a new product to the supply chain
    /// @dev Only callable by addresses with MANUFACTURER_ROLE
    /// @param _pufId The PUF ID of the product
    /// @param _suppliedHash The hash supplied for validation
    /// @param _location The initial location of the product
    /// @param _productOwner The initial owner of the product
    function addProduct(uint256 _pufId, bytes32 _suppliedHash, string memory _location, address _productOwner)
        external;

    /// @notice Updates the location of a product
    /// @dev Callable by addresses with DISTRIBUTOR_ROLE or RETAILER_ROLE
    /// @param pufId The PUF ID of the product to update
    /// @param location The new location of the product
    /// @param suppliedHash The hash supplied for validation
    function updateLocation(uint256 pufId, string memory location, bytes32 suppliedHash) external;

    /// @notice Transfers ownership of a product
    /// @dev Only callable by the current product owner
    /// @param _pufId The PUF ID of the product
    /// @param _newOwner The address of the new owner
    function transferOwnership(uint256 _pufId, address _newOwner) external;

    /// @notice Gets product information by PUF ID
    /// @param _pufId The PUF ID to query
    /// @return product The complete product record
    function getProduct(uint256 _pufId) external view returns (ProductRecord memory product);

    /// @notice Gets all products in the supply chain
    /// @dev Warning: This may be gas-intensive with many products
    /// @return Array of all product records
    function getAllProducts() external view returns (ProductRecord[] memory);

    /// @notice Validates a PUF ID against a supplied hash
    /// @param pufId The PUF ID to validate
    /// @param suppliedHash The hash to validate against
    /// @return True if validation succeeds, false otherwise
    function performValidation(uint256 pufId, bytes32 suppliedHash) external view returns (bool);
}
