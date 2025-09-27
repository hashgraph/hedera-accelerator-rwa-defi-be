# ERC721 Metadata

The ERC721 Metadata contract is an enhanced NFT implementation that provides on-chain metadata storage and management capabilities. It extends the standard ERC721 functionality with advanced metadata features for real-world asset tokenization.

## 📋 Overview

The ERC721 Metadata contract provides:

-   **On-chain Metadata Storage**: Store key-value pairs directly on-chain
-   **Metadata Filtering**: Efficient filtering and searching capabilities
-   **Collection Metadata**: Store collection-level information
-   **Metadata Freezing**: Immutable metadata for certain tokens
-   **Gas-Optimized Indexing**: Efficient metadata-based queries

## 🏗️ Architecture

### Key Features

-   **Standard ERC721**: Full ERC721 compliance with extensions
-   **On-chain Metadata**: Key-value storage for token attributes
-   **Collection Metadata**: Collection-level information storage
-   **Metadata Indexing**: Gas-optimized filtering and searching
-   **Freeze Mechanism**: Immutable metadata for verified tokens

### Contract Structure

```solidity
contract ERC721Metadata is IERC721Metadata, ERC721, ERC721URIStorage, Ownable {
    // Metadata storage
    mapping(bytes32 => KeyValue) internal metadata;
    mapping(bytes32 => uint256[]) private metadataIndex;
    mapping(uint256 => string[]) internal metadataKeys;

    // Collection metadata
    mapping(string => KeyValue) internal collectionMetadata;
    string[] internal collectionMetadataKeys;

    // Freeze mechanism
    mapping(uint256 => bool) internal isFrozen;
}
```

## 🔧 Core Functions

### Metadata Management

#### Set Single Metadata

```solidity
function setMetadata(uint256 _tokenId, string memory _key, string memory _newValue) external
```

**Parameters:**

-   `_tokenId`: Token ID to set metadata for
-   `_key`: Metadata key
-   `_newValue`: Metadata value

**Requirements:**

-   Caller must be token owner
-   Token metadata must not be frozen

#### Set Multiple Metadata

```solidity
function setMetadata(uint256 _tokenId, string[] memory _keys, string[] memory _values) external
```

**Parameters:**

-   `_tokenId`: Token ID to set metadata for
-   `_keys`: Array of metadata keys
-   `_values`: Array of metadata values

**Requirements:**

-   Arrays must have same length
-   Caller must be token owner
-   Token metadata must not be frozen

### Collection Metadata

#### Set Collection Metadata

```solidity
function setCollectionMetadata(string[] memory _keys, string[] memory _values) external onlyOwner
```

**Parameters:**

-   `_keys`: Array of collection metadata keys
-   `_values`: Array of collection metadata values

**Requirements:**

-   Caller must be contract owner
-   Arrays must have same length

### Token Management

#### Mint with Metadata

```solidity
function mint(address _to, string memory _uri, string[] memory _keys, string[] memory _values) external onlyOwner returns (uint256 tokenId)
```

**Parameters:**

-   `_to`: Address to mint token to
-   `_uri`: Token URI
-   `_keys`: Initial metadata keys
-   `_values`: Initial metadata values

**Returns:** Minted token ID

#### Freeze Metadata

```solidity
function freezeMetadata(uint256 _tokenId) external onlyOwner
```

**Parameters:**

-   `_tokenId`: Token ID to freeze metadata for

**Requirements:**

-   Caller must be contract owner
-   Token metadata must not already be frozen

## 📊 Data Structures

### KeyValue

```solidity
struct KeyValue {
    string key;
    string value;
    bool exists;
}
```

### TokenDetails

```solidity
struct TokenDetails {
    uint256 id;
    string uri;
    address owner;
    KeyValue[] metadata;
}
```

## 🔍 Query Functions

### Get Token Metadata

#### Get All Metadata for Token

```solidity
function getMetadata(uint256 _tokenId) public view returns (KeyValue[] memory)
```

Returns all metadata key-value pairs for a specific token.

#### Get Specific Metadata

```solidity
function getMetadata(uint256 _tokenId, string memory _key) public view returns (KeyValue memory)
```

Returns specific metadata for a token by key.

### Get Collection Metadata

#### Get All Collection Metadata

```solidity
function getCollectionMetadata() external view returns (KeyValue[] memory)
```

Returns all collection-level metadata.

#### Get Specific Collection Metadata

```solidity
function getCollectionMetadata(string memory _key) external view returns (KeyValue memory)
```

Returns specific collection metadata by key.

### Filtering and Search

#### Filter by Single Key-Value

```solidity
function filterTokens(string memory _key, string memory _value) external view returns (TokenDetails[] memory)
```

Returns all tokens that have the specified key-value pair.

#### Filter by Multiple Key-Values

```solidity
function filterTokens(string[] memory _keys, string[] memory _values) external view returns (TokenDetails[] memory)
```

Returns all tokens that have all specified key-value pairs.

## 🚀 Deployment

### Constructor

```solidity
constructor(string memory _name, string memory _symbol)
```

**Parameters:**

-   `_name`: NFT collection name
-   `_symbol`: NFT collection symbol

### Deployment Example

```typescript
// Deploy ERC721 Metadata contract
const erc721Metadata = await ethers.deployContract("ERC721Metadata", ["Real Estate NFTs", "RENFT"]);

console.log("ERC721 Metadata deployed to:", erc721Metadata.target);
```

## 🔒 Security Considerations

### Access Control

-   **Owner Only**: Collection metadata and freezing functions
-   **Token Owner**: Individual token metadata management
-   **Public**: Read-only query functions

### Metadata Integrity

-   **Freeze Mechanism**: Prevents metadata tampering
-   **Owner Control**: Collection metadata managed by owner
-   **Validation**: Input validation for all functions

### Gas Optimization

-   **Indexing**: Efficient metadata-based filtering
-   **Storage**: Optimized data structures
-   **Batch Operations**: Multiple metadata updates in single transaction

## 🧪 Testing

### Test Coverage

The ERC721 Metadata includes comprehensive tests:

-   Metadata setting and retrieval
-   Collection metadata management
-   Token filtering and search
-   Freeze mechanism
-   Access control
-   Edge cases and error conditions

### Running Tests

```bash
# Run ERC721 tests
yarn hardhat test test/erc721/erc721.test.ts

# Run with gas reporting
yarn hardhat test test/erc721/erc721.test.ts --gas-report
```

## 📚 Usage Examples

### Basic Token Management

```typescript
// Connect to contract
const erc721Metadata = await ethers.getContractAt("ERC721Metadata", contractAddress);

// Mint token with metadata
const tokenId = await erc721Metadata.mint(
    userAddress,
    "https://example.com/token/1",
    ["location", "size", "year"],
    ["New York", "1000", "2023"],
);

// Set additional metadata
await erc721Metadata.setMetadata(tokenId, "price", "500000");
```

### Collection Metadata

```typescript
// Set collection metadata
await erc721Metadata.setCollectionMetadata(
    ["collection_name", "description", "website"],
    ["Real Estate Collection", "Tokenized real estate assets", "https://example.com"],
);

// Get collection metadata
const collectionMetadata = await erc721Metadata.getCollectionMetadata();
```

### Token Filtering

```typescript
// Filter tokens by location
const nyTokens = await erc721Metadata.filterTokens("location", "New York");

// Filter tokens by multiple criteria
const filteredTokens = await erc721Metadata.filterTokens(["location", "size"], ["New York", "1000"]);

// Get token details
for (const token of filteredTokens) {
    console.log("Token ID:", token.id);
    console.log("Owner:", token.owner);
    console.log("URI:", token.uri);
    console.log("Metadata:", token.metadata);
}
```

### Metadata Management

```typescript
// Get all metadata for a token
const tokenMetadata = await erc721Metadata.getMetadata(tokenId);

// Get specific metadata
const location = await erc721Metadata.getMetadata(tokenId, "location");

// Freeze metadata (owner only)
await erc721Metadata.freezeMetadata(tokenId);
```

## 🔗 Integration Points

### With Building Contracts

The ERC721 Metadata integrates with building contracts to provide:

-   **Property Information**: Building details and specifications
-   **Ownership History**: Transfer and ownership records
-   **Compliance Data**: Regulatory and compliance information
-   **Audit Records**: Building audit and inspection data

### With Frontend Applications

Frontend applications can use the metadata for:

-   **Property Display**: Show building information
-   **Search and Filter**: Find properties by criteria
-   **Portfolio Management**: Organize and manage properties
-   **Analytics**: Track property performance

## 📈 Gas Optimization

### Efficient Storage

-   **Packed Structs**: Optimized data structures
-   **Indexing**: Gas-efficient filtering mechanisms
-   **Batch Operations**: Multiple updates in single transaction
-   **Cached Values**: Frequently accessed data

### Query Optimization

-   **Indexed Filtering**: Pre-computed indexes for common queries
-   **Intersection Logic**: Efficient multi-criteria filtering
-   **Memory Management**: Optimized array operations

## 🚨 Error Handling

### Custom Errors

```solidity
error ERC721Metadata: not token owner
error ERC721Metadata: token metadata can no longer be modified
error ERC721Metadata: array length mismatch
error ERC721Metadata: invalid array length
```

### Revert Conditions

-   Unauthorized access attempts
-   Frozen metadata modification
-   Array length mismatches
-   Invalid token operations

## 🔄 Upgrade Path

The ERC721 Metadata contract is not upgradeable by design to maintain metadata integrity. For updates:

1. Deploy new version
2. Migrate existing tokens
3. Update integration points
4. Maintain backward compatibility

## 📊 Monitoring

### Key Metrics

-   **Token Count**: Total tokens minted
-   **Metadata Entries**: Total metadata key-value pairs
-   **Filter Usage**: Query frequency and patterns
-   **Freeze Events**: Metadata freezing activity

### Events to Monitor

```solidity
// Token events
event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

// Metadata events
event MetadataSet(uint256 indexed tokenId, string key, string value);
event MetadataFrozen(uint256 indexed tokenId);

// Collection events
event CollectionMetadataSet(string key, string value);
```

## 📞 Support

For questions or issues related to the ERC721 Metadata:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Exchange Documentation](../exchange/README.md)
-   [Slice Documentation](../slice/README.md)
-   [Back to Main Documentation](../README.md)
