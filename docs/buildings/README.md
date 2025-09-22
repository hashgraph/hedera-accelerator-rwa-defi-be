# Buildings Module

The Buildings module is the core component of the Hedera RWA DeFi Accelerator, providing a complete suite for tokenizing real-world real estate assets. Each building deployment creates a comprehensive ecosystem of interconnected smart contracts.

## 📋 Overview

The Buildings module implements a factory-based pattern to deploy modular, governable, and compliant tokenized buildings. Each deployed building bundle includes:

-   **ERC3643 Token**: Security token representing building ownership
-   **ERC4626 Vault**: Asset management and yield generation
-   **Governor Contract**: On-chain governance and decision making
-   **Treasury Contract**: Fund management and distribution
-   **Identity System**: KYC/AML compliance using OnchainID
-   **Auto Compounder**: Automated yield optimization

## 🏗️ Architecture

### Factory Pattern

The `BuildingFactory` contract orchestrates the deployment of all building components:

```solidity
contract BuildingFactory is AccessControl, BuildingFactoryStorage {
    function deployBuilding(
        BuildingConfig memory config,
        GovernanceConfig memory govConfig,
        TreasuryConfig memory treasuryConfig
    ) external returns (address buildingAddress)
}
```

### Component Integration

Each building deployment creates a complete ecosystem:

```
BuildingFactory
├── BuildingToken (ERC3643)
├── BuildingVault (ERC4626)
├── BuildingGovernor
├── BuildingTreasury
├── BuildingAutoCompounder
└── Identity Contracts (OnchainID)
```

## 🔧 Core Components

### BuildingToken (ERC3643)

The security token representing building ownership with built-in compliance:

```solidity
contract BuildingToken is ERC3643 {
    // Compliance features
    - KYC/AML verification
    - Transfer restrictions
    - Ownership limits
    - Jurisdiction controls
}
```

**Key Features:**

-   **Permissioned Transfers**: Only verified identities can hold tokens
-   **Compliance Modules**: Configurable transfer restrictions
-   **Ownership Tracking**: Real-time ownership verification
-   **Regulatory Compliance**: Built-in KYC/AML integration

### BuildingVault (ERC4626)

The vault managing building assets and generating yield:

```solidity
contract BuildingVault is ERC4626 {
    // Yield generation
    - Rental income collection
    - Asset appreciation tracking
    - Reward distribution
    - Lock period management
}
```

**Key Features:**

-   **Asset Management**: Secure storage of building assets
-   **Yield Generation**: Rental income and appreciation
-   **Lock Periods**: Configurable withdrawal restrictions
-   **Reward Distribution**: Automated reward claiming

### BuildingGovernor

On-chain governance for building decisions:

```solidity
contract BuildingGovernor is Governor {
    // Governance features
    - Proposal creation
    - Voting mechanisms
    - Execution logic
    - Timelock controls
}
```

**Key Features:**

-   **Proposal System**: Create and vote on building decisions
-   **Voting Power**: Based on token holdings
-   **Execution**: Automated proposal execution
-   **Timelock**: Security delays for critical decisions

### BuildingTreasury

Fund management and distribution:

```solidity
contract BuildingTreasury is AccessControl {
    // Treasury features
    - Fund collection
    - Payment processing
    - Reserve management
    - Distribution logic
}
```

**Key Features:**

-   **Fund Collection**: Accepts USDC deposits
-   **Payment Processing**: Automated payment distribution
-   **Reserve Management**: Maintains operational reserves
-   **Business Integration**: Direct business payments

### BuildingAutoCompounder

Automated yield optimization:

```solidity
contract BuildingAutoCompounder is AutoCompounder {
    // Compounding features
    - Reward claiming
    - Asset reinvestment
    - Exchange rate tracking
    - User reward distribution
}
```

**Key Features:**

-   **Automatic Compounding**: Reinvests rewards automatically
-   **Exchange Rate**: Tracks compounding performance
-   **User Rewards**: Proportional reward distribution
-   **Vault Integration**: Works with building vault

## 🚀 Deployment Process

### 1. Configuration Setup

```typescript
const buildingConfig = {
    name: "Downtown Office Building",
    symbol: "DOB",
    decimals: 18,
    totalSupply: ethers.parseEther("1000000"),
    // ... other configuration
};

const governanceConfig = {
    votingDelay: 1,
    votingPeriod: 100,
    proposalThreshold: ethers.parseEther("1000"),
    // ... other governance settings
};

const treasuryConfig = {
    usdcAddress: usdcAddress,
    reserveAmount: ethers.parseUnits("10000", 6),
    nPercentage: 2000, // 20% to business
    businessAddress: businessAddress,
};
```

### 2. Factory Deployment

```typescript
// Deploy building via factory
const buildingFactory = await ethers.getContractAt("BuildingFactory", factoryAddress);

const tx = await buildingFactory.deployBuilding(buildingConfig, governanceConfig, treasuryConfig);

const receipt = await tx.wait();
const buildingAddress = receipt.logs[0].args.building;
```

### 3. Component Access

```typescript
// Get component addresses
const buildingToken = await buildingFactory.getBuildingToken(buildingAddress);
const buildingVault = await buildingFactory.getBuildingVault(buildingAddress);
const buildingGovernor = await buildingFactory.getBuildingGovernor(buildingAddress);
const buildingTreasury = await buildingFactory.getBuildingTreasury(buildingAddress);
const buildingAutoCompounder = await buildingFactory.getBuildingAutoCompounder(buildingAddress);
```

## 🔐 Identity and Compliance

### OnchainID Integration

Each building deployment creates identity contracts:

```typescript
// Identity contracts created
const identity = await buildingFactory.getBuildingIdentity(buildingAddress);
const claimIssuer = await buildingFactory.getBuildingClaimIssuer(buildingAddress);
```

### Compliance Modules

Configurable compliance modules:

-   **Country Allow Module**: Restrict transfers by country
-   **Max Ownership Module**: Limit individual ownership
-   **Transfer Limit Module**: Restrict transfer amounts
-   **NFT Module**: Require NFT ownership for transfers

### KYC/AML Process

1. **Identity Creation**: User creates OnchainID
2. **Claim Issuance**: KYC provider issues claims
3. **Token Transfer**: Only verified users can receive tokens
4. **Ongoing Compliance**: Continuous verification

## 🏛️ Governance System

### Proposal Creation

```typescript
// Create governance proposal
const governor = await ethers.getContractAt("BuildingGovernor", buildingGovernorAddress);

const proposalTx = await governor.propose(
    [treasuryAddress], // targets
    [0], // values
    [calldata], // calldata
    "Proposal Description",
);
```

### Voting Process

```typescript
// Cast vote
await governor.castVote(proposalId, 1); // 1 = For, 0 = Against, 2 = Abstain

// Execute proposal
await governor.execute(proposalId);
```

### Governance Parameters

-   **Voting Delay**: Time before voting starts
-   **Voting Period**: Duration of voting
-   **Proposal Threshold**: Minimum tokens to create proposal
-   **Quorum**: Minimum participation required

## 💰 Treasury Management

### Fund Collection

```typescript
// Deposit USDC to treasury
const treasury = await ethers.getContractAt("BuildingTreasury", treasuryAddress);

await treasury.deposit(ethers.parseUnits("10000", 6)); // 10,000 USDC
```

### Payment Processing

```typescript
// Make payment (governance only)
await treasury.makePayment(recipientAddress, ethers.parseUnits("5000", 6));
```

### Reserve Management

```typescript
// Update reserve amount
await treasury.setReserveAmount(ethers.parseUnits("15000", 6));
```

## 🔄 Auto Compounding

### Deposit to Auto Compounder

```typescript
// Deposit underlying assets
const autoCompounder = await ethers.getContractAt("BuildingAutoCompounder", autoCompounderAddress);

await autoCompounder.deposit(ethers.parseEther("1000"), userAddress);
```

### Reward Management

```typescript
// Check exchange rate
const exchangeRate = await autoCompounder.exchangeRate();

// Claim user rewards
await autoCompounder.claimExactUserReward(userAddress);

// Trigger compounding
await autoCompounder.claim();
```

## 📊 Monitoring and Analytics

### Key Metrics

-   **Total Value Locked (TVL)**: Total assets in vault
-   **Token Supply**: Circulating token supply
-   **Governance Participation**: Voting activity
-   **Treasury Balance**: Available funds
-   **Compounding Performance**: Exchange rate growth

### Events to Monitor

```solidity
// Building deployment
event BuildingDeployed(address indexed building, address indexed token, address indexed vault);

// Governance events
event ProposalCreated(uint256 indexed proposalId, address indexed proposer);
event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support);

// Treasury events
event Deposit(address indexed user, uint256 amount);
event Payment(address indexed recipient, uint256 amount);

// Auto compounding events
event Deposit(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);
event Claim(uint256 underlyingAmount);
```

## 🔒 Security Considerations

### Access Control

-   **Factory Role**: Only authorized addresses can deploy buildings
-   **Governance Role**: Token holders control building decisions
-   **Treasury Role**: Restricted payment capabilities
-   **Admin Role**: Initial setup and emergency functions

### Upgradeability

-   **Beacon Proxies**: All components use upgradeable patterns
-   **Implementation Authority**: Centralized upgrade control
-   **Governance Control**: Community-controlled upgrades

### Compliance

-   **Identity Verification**: All token holders must be verified
-   **Transfer Restrictions**: Configurable compliance rules
-   **Audit Trail**: Complete transaction history
-   **Regulatory Compliance**: Built-in KYC/AML

## 🧪 Testing

### Test Coverage

The Buildings module includes comprehensive tests:

-   Factory deployment functionality
-   Component integration
-   Governance operations
-   Treasury management
-   Auto compounding
-   Compliance features

### Running Tests

```bash
# Run building tests
yarn hardhat test test/buildings/

# Run specific test file
yarn hardhat test test/buildings/building.test.ts

# Run with gas reporting
yarn hardhat test test/buildings/ --gas-report
```

## 📚 Usage Examples

### Complete Building Deployment

```typescript
// 1. Deploy building
const buildingAddress = await deployBuilding(config);

// 2. Get component addresses
const components = await getBuildingComponents(buildingAddress);

// 3. Set up compliance
await setupCompliance(components.token, complianceModules);

// 4. Initialize treasury
await initializeTreasury(components.treasury, treasuryConfig);

// 5. Start auto compounding
await startAutoCompounding(components.autoCompounder);
```

### Governance Workflow

```typescript
// 1. Create proposal
const proposalId = await createProposal(governor, proposalData);

// 2. Vote on proposal
await castVote(governor, proposalId, vote);

// 3. Execute proposal
await executeProposal(governor, proposalId);
```

### User Interaction

```typescript
// 1. Complete KYC
await completeKYC(userAddress, kycData);

// 2. Purchase tokens
await purchaseTokens(buildingToken, tokenAmount);

// 3. Deposit to auto compounder
await depositToAutoCompounder(autoCompounder, assetAmount);

// 4. Participate in governance
await castVote(governor, proposalId, vote);
```

## 🔗 Integration Points

### With External Systems

-   **KYC Providers**: Identity verification services
-   **Audit Services**: Building audit integration
-   **Payment Systems**: Business payment processing
-   **Analytics Platforms**: Performance tracking

### With Other DeFi Protocols

-   **Uniswap**: Token trading and liquidity
-   **Chainlink**: Price feeds and oracles
-   **Other Vaults**: Cross-vault interactions
-   **Lending Protocols**: Collateral usage

## 📈 Gas Optimization

### Efficient Deployment

-   **Factory Pattern**: Reduces deployment costs
-   **Beacon Proxies**: Shared implementation contracts
-   **Library Usage**: Reusable code components
-   **Storage Optimization**: Efficient data structures

### Runtime Optimization

-   **Cached Values**: Frequently accessed data
-   **Batch Operations**: Multiple operations in single transaction
-   **Gas-Efficient Math**: Optimized calculations
-   **Event Optimization**: Minimal event data

## 🚨 Error Handling

### Custom Errors

```solidity
error BuildingAlreadyExists();
error InvalidConfiguration();
error InsufficientPermissions();
error ComplianceViolation();
```

### Revert Conditions

-   Invalid configuration parameters
-   Insufficient permissions
-   Compliance violations
-   Governance failures
-   Treasury errors

## 🔄 Upgrade Path

### Component Upgrades

1. **Implementation Update**: Deploy new implementation
2. **Beacon Update**: Update beacon contract
3. **Governance Approval**: Community approval required
4. **Gradual Migration**: Phased rollout

### Data Migration

-   **State Preservation**: Maintain existing data
-   **Backward Compatibility**: Support old interfaces
-   **Migration Scripts**: Automated data transfer
-   **Validation**: Post-upgrade verification

## 📞 Support

For questions or issues related to the Buildings module:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [ERC721 Documentation](../erc721/README.md)
-   [Treasury Documentation](../treasury/README.md)
-   [Back to Main Documentation](../README.md)
