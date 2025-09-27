# Audit Registry

The Audit Registry is a smart contract that manages audit records for building addresses in the Hedera RWA DeFi ecosystem. It provides a decentralized way to track and verify audit information for tokenized real estate assets.

## 📋 Overview

The Audit Registry serves as a central repository for audit information, allowing authorized auditors to:

-   Add new audit records for buildings
-   Update existing audit records
-   Revoke audit records when necessary
-   Manage auditor roles through governance

## 🏗️ Architecture

### Key Features

-   **Role-Based Access Control**: Different roles for auditors, governance, and admins
-   **IPFS Integration**: Audit documents stored off-chain with IPFS hashes
-   **Immutable Records**: Audit records cannot be deleted, only revoked
-   **Governance Integration**: Auditor management through governance voting

### Contract Structure

```solidity
contract AuditRegistry is AccessControl {
    // Roles
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    // Storage
    mapping(uint256 => AuditRecord) public auditRecords;
    mapping(address => uint256[]) public buildingAuditRecords;
}
```

## 🔧 Core Functions

### Adding Audit Records

```solidity
function addAuditRecord(address _building, string calldata _ipfsHash) external onlyRole(AUDITOR_ROLE)
```

**Parameters:**

-   `_building`: EVM address of the building contract
-   `_ipfsHash`: IPFS hash of the audit document

**Requirements:**

-   Caller must have `AUDITOR_ROLE`
-   Building address cannot be zero
-   IPFS hash must not be empty
-   IPFS hash must be unique for the building

### Updating Audit Records

```solidity
function updateAuditRecord(uint256 _recordId, string calldata _newIpfsHash) external onlyRole(AUDITOR_ROLE)
```

**Parameters:**

-   `_recordId`: ID of the audit record to update
-   `_newIpfsHash`: New IPFS hash for the audit document

**Requirements:**

-   Caller must be the original auditor who created the record
-   Record must not be revoked
-   New IPFS hash must be unique for the building

### Revoking Audit Records

```solidity
function revokeAuditRecord(uint256 _recordId) external onlyRole(AUDITOR_ROLE)
```

**Parameters:**

-   `_recordId`: ID of the audit record to revoke

**Requirements:**

-   Caller must be the original auditor who created the record
-   Record must not already be revoked

## 👥 Role Management

### Adding Auditors

```solidity
function addAuditor(address account) external onlyRole(GOVERNANCE_ROLE)
```

**Parameters:**

-   `account`: Address to be added as an auditor

**Requirements:**

-   Caller must have `GOVERNANCE_ROLE`
-   Account cannot be zero address

### Removing Auditors

```solidity
function removeAuditor(address account) external onlyRole(GOVERNANCE_ROLE)
```

**Parameters:**

-   `account`: Address of the auditor to remove

**Requirements:**

-   Caller must have `GOVERNANCE_ROLE`
-   Account must be an existing auditor

## 📊 Data Structures

### AuditRecord

```solidity
struct AuditRecord {
    address building;    // EVM address of the building
    address auditor;     // Address of the auditor
    uint64 timestamp;    // Timestamp when the audit was added
    bool revoked;        // Status of the audit record
    string ipfsHash;     // IPFS hash of the audit document
}
```

## 🔍 Query Functions

### Get Audit Records by Building

```solidity
function getAuditRecordsByBuilding(address _building) external view returns (uint256[] memory)
```

Returns an array of record IDs associated with a specific building.

### Get Audit Record Details

```solidity
function getAuditRecordDetails(uint256 _recordId) external view returns (AuditRecord memory)
```

Returns the complete audit record information for a specific record ID.

### Get Auditors List

```solidity
function getAuditors() external view returns (address[] memory)
```

Returns an array of all registered auditor addresses.

## 📝 Events

### AuditRecordAdded

```solidity
event AuditRecordAdded(
    uint256 indexed recordId,
    address indexed building,
    address indexed auditor,
    string ipfsHash,
    uint256 timestamp
);
```

Emitted when a new audit record is added.

### AuditRecordUpdated

```solidity
event AuditRecordUpdated(uint256 indexed recordId, string newIpfsHash, uint256 timestamp);
```

Emitted when an existing audit record is updated.

### AuditRecordRevoked

```solidity
event AuditRecordRevoked(uint256 indexed recordId, uint256 timestamp);
```

Emitted when an audit record is revoked.

### AuditorAdded

```solidity
event AuditorAdded(address indexed auditor);
```

Emitted when a new auditor is added.

### AuditorRemoved

```solidity
event AuditorRemoved(address indexed auditor);
```

Emitted when an auditor is removed.

## 🚀 Deployment

### Constructor

```solidity
constructor(address initialOwner)
```

**Parameters:**

-   `initialOwner`: Address that will receive the `DEFAULT_ADMIN_ROLE`

### Deployment Script

```typescript
// Deploy Audit Registry
const auditRegistry = await ethers.deployContract("AuditRegistry", [deployer.address]);

// Grant governance role to building factory
await auditRegistry.grantGovernanceRole(buildingFactory.address);
```

## 🔒 Security Considerations

### Access Control

-   Only authorized auditors can add/update/revoke audit records
-   Governance role required for auditor management
-   Admin role for initial setup and governance role assignment

### Data Integrity

-   IPFS hashes prevent duplicate records for the same building
-   Immutable record IDs ensure audit trail integrity
-   Revocation mechanism allows for record invalidation without deletion

### Reentrancy Protection

-   No external calls that could lead to reentrancy attacks
-   Simple state updates with no complex interactions

## 🧪 Testing

### Test Coverage

The audit registry includes comprehensive tests covering:

-   Adding audit records
-   Updating audit records
-   Revoking audit records
-   Role management
-   Access control
-   Edge cases and error conditions

### Running Tests

```bash
# Run audit registry tests
yarn hardhat test test/audit/audit.test.ts

# Run with gas reporting
yarn hardhat test test/audit/audit.test.ts --gas-report
```

## 📚 Usage Examples

### Adding an Audit Record

```typescript
// Connect to the audit registry
const auditRegistry = await ethers.getContractAt("AuditRegistry", auditRegistryAddress);

// Add audit record (requires AUDITOR_ROLE)
await auditRegistry.addAuditRecord(buildingAddress, "QmYourIPFSHashHere");
```

### Querying Audit Records

```typescript
// Get all audit records for a building
const recordIds = await auditRegistry.getAuditRecordsByBuilding(buildingAddress);

// Get details for a specific record
const recordDetails = await auditRegistry.getAuditRecordDetails(recordIds[0]);

console.log("Auditor:", recordDetails.auditor);
console.log("IPFS Hash:", recordDetails.ipfsHash);
console.log("Timestamp:", recordDetails.timestamp);
console.log("Revoked:", recordDetails.revoked);
```

### Managing Auditors

```typescript
// Add new auditor (requires GOVERNANCE_ROLE)
await auditRegistry.addAuditor(newAuditorAddress);

// Remove auditor (requires GOVERNANCE_ROLE)
await auditRegistry.removeAuditor(auditorToRemove);

// Get list of all auditors
const auditors = await auditRegistry.getAuditors();
```

## 🔗 Integration

### With Building Contracts

The audit registry integrates with building contracts to provide audit verification:

```typescript
// Check if building has valid audits
const recordIds = await auditRegistry.getAuditRecordsByBuilding(buildingAddress);
const hasValidAudits = recordIds.length > 0;
```

### With Frontend Applications

Frontend applications can query audit information to display to users:

```typescript
// Fetch audit information for display
const audits = await Promise.all(recordIds.map((id) => auditRegistry.getAuditRecordDetails(id)));

// Filter out revoked audits
const validAudits = audits.filter((audit) => !audit.revoked);
```

## 📈 Gas Optimization

### Efficient Storage

-   Uses `uint64` for timestamps to save gas
-   Incremental record IDs for efficient indexing
-   Packed structs where possible

### Batch Operations

-   No batch operations currently implemented
-   Consider adding batch functions for multiple record operations

## 🚨 Error Handling

### Custom Errors

```solidity
error DuplicateIpfsHash();
```

### Revert Conditions

-   Invalid building address (zero address)
-   Empty IPFS hash
-   Duplicate IPFS hash for same building
-   Unauthorized access attempts
-   Non-existent record operations

## 🔄 Upgrade Path

The audit registry is not upgradeable by design to maintain audit trail integrity. For new features:

1. Deploy new version of the contract
2. Migrate existing data if necessary
3. Update integration points
4. Maintain backward compatibility

## 📞 Support

For questions or issues related to the Audit Registry:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Auto Compounder Documentation](../autocompounder/README.md)
-   [Buildings Documentation](../buildings/README.md)
-   [Back to Main Documentation](../README.md)
