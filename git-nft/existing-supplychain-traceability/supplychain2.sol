// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableMap.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

contract SupplyChain is AccessControlEnumerable {
    using EnumerableMap for EnumerableMap.UintToBytes32Map;
    using ECDSA for bytes32;
    
    // Roles
    bytes32 public constant MANUFACTURER_ROLE = keccak256("MANUFACTURER_ROLE");
    bytes32 public constant DISTRIBUTOR_ROLE = keccak256("DISTRIBUTOR_ROLE");
    bytes32 public constant RETAILER_ROLE = keccak256("RETAILER_ROLE");
    bytes32 public constant SUPPLIER_ROLE = keccak256("SUPPLIER_ROLE");

    // Data Structures
    enum ProductStatus { Manufactured, Shipped, Distributed, Sold }
    
        
    struct ProductRecord {
        uint256 pufId;
        uint256 challenge;
        bytes32 responseHash;
       // bytes32 expectedHash;
        string location;
        uint256 timestamp;
        address productOwner;
        ProductStatus status;
         bytes signature;
    }

    // Storage
    EnumerableMap.UintToBytes32Map private validPufIds;
    mapping(uint256 => ProductRecord) public products;
    

    mapping(uint256 => string) public validPufIdCIDs;
    mapping(uint256 => string) public productCIDs;

    

function addValidPufIdCID(uint256 pufId, string calldata cid) external onlyRole(MANUFACTURER_ROLE) {
    validPufIdCIDs[pufId] = cid;
}

function addProductCID(uint256 pufId, string calldata cid) external onlyRole(MANUFACTURER_ROLE) {
    productCIDs[pufId] = cid;
}
    
    // Events
    event ProductAdded(uint256 pufId, string location, address owner);
    event OwnershipTransferred(uint256 pufId, address newOwner, address oldOwner);
    event LocationUpdated(uint256 pufId, string location);
       


    constructor(address manufacturer, address distributor, address retailer, address supplier) {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MANUFACTURER_ROLE, manufacturer);
        _grantRole(DISTRIBUTOR_ROLE, distributor);
        _grantRole(RETAILER_ROLE, retailer);
        _grantRole(SUPPLIER_ROLE, supplier);
    }

    // ========== CORE FUNCTIONS ========== //

     // Map PUF ID → expected response hash
    using EnumerableMap for EnumerableMap.UintToBytes32Map;
    //EnumerableMap.UintToBytes32Map private validPufIds;

    event PufIdEnrolled(uint256 indexed pufId, bytes32 expectedHash);

function addValidPufId(
    uint256 pufId,
    bytes32 expectedResponseHash
) external onlyRole(MANUFACTURER_ROLE) {
    // Store via the EnumerableMap API
    validPufIds.set(pufId, expectedResponseHash);

     

    // Emit the enrollment event
    emit PufIdEnrolled(pufId, expectedResponseHash);
}


    function addProduct(
        uint256 _pufId,
        uint256 _challenge,
        bytes32 _response,       // the hash = keccak(pufId, challenge)
        string memory _location,
        address _productOwner,
        bytes memory _signature
    ) external onlyRole(MANUFACTURER_ROLE) {
        require(validPufIds.contains(_pufId), "PUF ID not registered");
        
        // 🔧 TEMPORARILY SKIPPING SIGNATURE VALIDATION FOR PERFORMANCE TESTING
    
        // **NEW**: ensure response matches expected
        bytes32 expected = validPufIds.get(_pufId);
        require(expected == _response, "PUF response mismatch");

        // signature over keccak(pufId, challenge)
        bytes32 msgHash = keccak256(abi.encodePacked(_pufId, _challenge));
        bytes32 ethMsg  = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash)
        );
        address signer = ECDSA.recover(ethMsg, _signature);
        require(signer == _productOwner, "Signature does not match");
          
        products[_pufId] = ProductRecord(
            _pufId, _challenge, _response, _location,
            block.timestamp, _productOwner,
            ProductStatus.Manufactured, _signature
        );
        emit ProductAdded(_pufId, _location, _productOwner);
    }

    function verifyPufSignature(
        uint256 pufId,
        uint256 challenge,
        bytes memory signature
    ) public view returns (bool) {
        if (products[pufId].productOwner == address(0)) return false;
        
        bytes32 messageHash = keccak256(abi.encodePacked(pufId, challenge));
        bytes32 ethSignedMessage = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        return ECDSA.recover(ethSignedMessage, signature) == products[pufId].productOwner;
    }
    

/// @notice Update the location of a product trace
    function updateLocation(uint256 pufId, string calldata location)
        external
    {
        // Allow manufacturer to ship, distributor to distribute, retailer to retail/deliver
        require(
            hasRole(MANUFACTURER_ROLE, msg.sender) ||
            hasRole(DISTRIBUTOR_ROLE,  msg.sender) ||
            hasRole(RETAILER_ROLE,     msg.sender),
            "Not authorized to update location"
        );

        emit LocationUpdated(pufId, location);
    }

    
    
    function transferOwnership(uint256 _pufId, address _newOwner) external {
        address _oldOwner = products[_pufId].productOwner;
        
        require(_oldOwner == msg.sender, "Caller does not own this product");
        
        products[_pufId].productOwner = _newOwner;
        
        emit OwnershipTransferred(_pufId, _newOwner, _oldOwner);
    }

    function getProduct(uint256 _pufId) external view returns (address currentOwner, string memory location, uint256 timestamp) {
        currentOwner = products[_pufId].productOwner;
        location = products[_pufId].location;
        timestamp = products[_pufId].timestamp;   
    }

    // Return all products stored in the contract
    // @warning: This function MUST NOT be called in the course of any state-changing operation.
    // Otherwise, block limit might be exceeded or the transaction can end up costing a lot
    function getAllProducts() public view returns (ProductRecord[] memory) {
        ProductRecord[] memory allProducts = new ProductRecord[](validPufIds.length());
        for (uint256 i; i < validPufIds.length(); i++) {
            
            (uint256 pufId,) = validPufIds.at(i);
            
            allProducts[i] = products[pufId];
        }
    
        return allProducts;
    }

    
    function verifyPufId(uint256 pufId, bytes32 suppliedHash) public view returns (bool) {
    require(products[pufId].challenge != 0, "Product not found or challenge not set");

    uint256 challenge = products[pufId].challenge;
    bytes32 expectedHash = keccak256(abi.encodePacked(challenge, pufId));
    return (expectedHash == suppliedHash);
}

}
