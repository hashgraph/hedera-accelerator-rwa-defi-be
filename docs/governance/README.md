# Building Governance

The Building Governance system provides on-chain governance capabilities for tokenized buildings, enabling token holders to participate in decision-making processes through voting mechanisms. It supports both traditional DAO governance and multisig-based governance for different types of proposals.

## 📋 Overview

The Building Governance system provides:

-   **On-chain Voting**: Token holders can vote on proposals using their token balance
-   **Dual Governance**: Supports both DAO governance and multisig governance
-   **Proposal Types**: Text proposals, payment proposals, and administrative proposals
-   **Threshold Management**: Automatic routing based on payment amounts
-   **Audit Integration**: Built-in integration with audit registry management

## 🏗️ Architecture

### Key Features

-   **OpenZeppelin Governor**: Built on OpenZeppelin's Governor contracts
-   **Vote-based Governance**: Uses ERC3643 tokens for voting power
-   **Multisig Integration**: Gnosis Safe integration for smaller payments
-   **Proposal Management**: Comprehensive proposal lifecycle management
-   **Upgradeable**: UUPS upgradeable pattern for future improvements

### Contract Structure

```solidity
contract BuildingGovernance is
    Initializable,
    GovernorUpgradeable,
    GovernorCountingSimpleUpgradeable,
    GovernorVotesUpgradeable,
    GovernorVotesQuorumFractionUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    BuildingGovernanceStorage
{
    // Governance data
    BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

    // Treasury and audit registry integration
    address public treasury;
    address public auditRegistry;
    address public safeAddress;
    uint256 public multisigThreshold;
}
```

## 🔧 Core Functions

### Proposal Creation

#### Text Proposals

```solidity
function createTextProposal(ProposalLevel level, string memory description) public returns (uint256 proposalId)
```

**Parameters:**

-   `level`: Proposal level (GovernorVote or MultisigVote)
-   `description`: Description of the proposal

**Process:**

1. Creates a text-only proposal
2. No executable actions attached
3. Used for general discussions and decisions
4. Returns proposal ID for tracking

#### Payment Proposals

```solidity
function createPaymentProposal(uint256 amount, address to, string memory description) public returns (uint256 proposalId)
```

**Parameters:**

-   `amount`: Payment amount in USDC
-   `to`: Recipient address
-   `description`: Description of the payment purpose

**Process:**

1. Checks amount against multisig threshold
2. Routes to appropriate governance mechanism
3. Creates executable proposal for treasury payment
4. Returns proposal ID for tracking

### Governance Mechanisms

#### DAO Governance

For larger payments and important decisions:

-   **Voting Power**: Based on ERC3643 token holdings
-   **Quorum**: 1% of total token supply required
-   **Voting Period**: Configurable voting duration
-   **Execution**: Automatic execution after successful vote

#### Multisig Governance

For smaller payments and routine operations:

-   **Threshold**: Configurable amount threshold (default: 500 USDC)
-   **Gnosis Safe**: Integration with Gnosis Safe multisig
-   **Fast Execution**: No voting period required
-   **Efficiency**: Reduces gas costs for small payments

## 📊 Proposal Types

### Text Proposals

```solidity
enum ProposalType { Text, Payment, ChangeReserve, AddAuditor, RemoveAuditor }
```

**Purpose:**

-   General discussions
-   Policy decisions
-   Non-executable decisions

### Payment Proposals

**Purpose:**

-   Treasury payments
-   Business expenses
-   Operational costs

**Routing Logic:**

-   Amount ≤ multisig threshold → Multisig governance
-   Amount > multisig threshold → DAO governance

### Administrative Proposals

**Change Reserve:**

-   Modify treasury reserve amounts
-   Update reserve percentages

**Auditor Management:**

-   Add new auditors to audit registry
-   Remove existing auditors

## 🚀 Deployment

### Initialization

```solidity
function initialize(
    IVotes _token,
    string memory name,
    address initialOwner,
    address treasury,
    address auditRegistry
) public initializer
```

**Parameters:**

-   `_token`: ERC3643 token for voting power
-   `name`: Governance contract name
-   `initialOwner`: Initial owner address
-   `treasury`: Treasury contract address
-   `auditRegistry`: Audit registry address

### Deployment Example

```typescript
// Deploy Building Governance
const governance = await ethers.deployContract("BuildingGovernance");

// Initialize Governance
await governance.initialize(
    erc3643TokenAddress,
    "Building Governance",
    initialOwnerAddress,
    treasuryAddress,
    auditRegistryAddress,
);

console.log("Governance deployed to:", governance.target);
```

## 🔒 Security Considerations

### Access Control

-   **Owner Only**: Administrative functions and upgrades
-   **Token Holders**: Proposal creation and voting
-   **Multisig**: Small payment execution
-   **DAO**: Large payment execution

### Proposal Security

-   **Validation**: All proposals validated before creation
-   **Execution**: Proposals executed through treasury contract
-   **Audit Trail**: Complete proposal history maintained
-   **Threshold Protection**: Automatic routing based on amounts

### Upgradeability

-   **UUPS Pattern**: Upgradeable through owner
-   **Storage Separation**: Separate storage contract
-   **Initialization**: Proper initialization pattern

## 🧪 Testing

### Test Coverage

The Building Governance includes comprehensive tests:

-   Proposal creation and management
-   Voting mechanisms
-   Multisig integration
-   Treasury integration
-   Edge cases and error conditions

### Running Tests

```bash
# Run governance tests
yarn hardhat test test/buildings/governance/

# Run with gas reporting
yarn hardhat test test/buildings/governance/ --gas-report
```

## 📚 Usage Examples

### Creating a Text Proposal

```typescript
// Connect to governance
const governance = await ethers.getContractAt("BuildingGovernance", governanceAddress);

// Create text proposal
const proposalId = await governance.createTextProposal(
    0, // ProposalLevel.GovernorVote
    "Should we increase the building maintenance budget?",
);

console.log("Text proposal created:", proposalId);
```

### Creating a Payment Proposal

```typescript
// Create payment proposal
const paymentProposalId = await governance.createPaymentProposal(
    ethers.parseUnits("1000", 6), // 1000 USDC
    contractorAddress,
    "Payment for building maintenance work",
);

console.log("Payment proposal created:", paymentProposalId);
```

### Voting on Proposals

```typescript
// Vote on proposal
await governance.castVote(proposalId, 1); // 1 = For, 0 = Against, 2 = Abstain

// Check voting power
const votingPower = await governance.getVotes(voterAddress, blockNumber);
```

### Executing Proposals

```typescript
// Execute proposal (after voting period)
await governance.execute(
    [treasuryAddress], // targets
    [0], // values
    [calldata], // calldata
    descriptionHash,
);
```

## 🔗 Integration Points

### With Treasury

The Governance integrates with Treasury to:

-   **Payment Execution**: Execute approved payments
-   **Reserve Management**: Modify reserve amounts
-   **Fund Control**: Control treasury fund usage

### With Audit Registry

The Governance integrates with Audit Registry to:

-   **Auditor Management**: Add/remove auditors
-   **Compliance Control**: Manage compliance requirements
-   **Audit Oversight**: Oversee audit processes

### With ERC3643 Tokens

The Governance integrates with ERC3643 tokens to:

-   **Voting Power**: Use token balance for voting
-   **Quorum Calculation**: Calculate required quorum
-   **Snapshot Management**: Manage voting snapshots

## 📈 Gas Optimization

### Efficient Operations

-   **Batch Proposals**: Multiple actions in single proposal
-   **Storage Optimization**: Efficient data structures
-   **Event Optimization**: Minimal event data
-   **Gas Estimation**: Pre-calculate gas costs

### Proposal Management

-   **Lazy Loading**: Load proposal data only when needed
-   **Cached Values**: Frequently accessed data
-   **Memory Management**: Optimized memory operations
-   **Gas Tracking**: Monitor gas usage

## 🚨 Error Handling

### Custom Errors

```solidity
error ProposalNotFound();
error ProposalAlreadyExecuted();
error InsufficientVotingPower();
error InvalidProposalType();
```

### Revert Conditions

-   Proposal not found
-   Proposal already executed
-   Insufficient voting power
-   Invalid proposal type
-   Unauthorized access attempts

## 🔄 Upgrade Path

The Building Governance is upgradeable using the UUPS pattern:

1. Deploy new implementation
2. Upgrade through owner
3. Maintain backward compatibility
4. Validate post-upgrade functionality

## 📊 Monitoring

### Key Metrics

-   **Proposal Count**: Total proposals created
-   **Voting Participation**: Voter participation rates
-   **Execution Success**: Successful proposal executions
-   **Gas Usage**: Gas consumption per operation

### Events to Monitor

-   `ProposalCreated` events for new proposals
-   `VoteCast` events for voting activity
-   `ProposalExecuted` events for successful executions
-   `ProposalDefined` events for proposal details

## 📞 Support

For questions or issues related to the Building Governance:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Buildings Documentation](../buildings/README.md)
-   [Treasury Documentation](../treasury/README.md)
-   [Back to Main Documentation](../README.md)
