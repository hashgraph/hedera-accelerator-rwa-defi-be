# Treasury

The Treasury contract manages fund collection, distribution, and reserve management for building operations. It provides automated fund distribution between business operations and reserve management with governance-controlled payment processing.

## 📋 Overview

The Treasury contract provides:

-   **Fund Collection**: Accepts USDC deposits from various sources
-   **Automated Distribution**: Splits funds between business and treasury
-   **Reserve Management**: Maintains operational reserves
-   **Payment Processing**: Governance-controlled payments
-   **Excess Fund Forwarding**: Automatically forwards excess funds to vaults

## 🏗️ Architecture

### Key Features

-   **Automated Distribution**: N% to business, M% to treasury
-   **Reserve Management**: Maintains minimum reserve amounts
-   **Governance Control**: Restricted payment capabilities
-   **Vault Integration**: Forwards excess funds to yield-generating vaults
-   **Role-Based Access**: Different roles for different operations

### Contract Structure

```solidity
contract Treasury is AccessControlUpgradeable, TreasuryStorage, ITreasury {
    // Roles
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    // Treasury data
    TreasuryData storage $ = _getTreasuryStorage();
}
```

## 🔧 Core Functions

### Fund Management

#### Deposit Funds

```solidity
function deposit(uint256 amount) external
```

**Parameters:**

-   `amount`: Amount of USDC to deposit

**Process:**

1. Transfers USDC from caller
2. Distributes funds according to N/M percentage split
3. Forwards excess funds to vault
4. Emits deposit event

#### Make Payment

```solidity
function makePayment(address to, uint256 amount) external onlyRole(GOVERNANCE_ROLE)
```

**Parameters:**

-   `to`: Recipient address
-   `amount`: Payment amount

**Process:**

1. Validates recipient and amount
2. Checks sufficient balance
3. Transfers USDC to recipient
4. Forwards excess funds to vault

### Configuration Management

#### Set Reserve Amount

```solidity
function setReserveAmount(uint256 newReserveAmount) external onlyRole(GOVERNANCE_ROLE)
```

**Parameters:**

-   `newReserveAmount`: New minimum reserve amount

**Process:**

1. Validates new reserve amount
2. Updates reserve configuration
3. Forwards excess funds to vault

#### Add Vault

```solidity
function addVault(address _vault) public onlyRole(FACTORY_ROLE)
```

**Parameters:**

-   `_vault`: Vault address for excess funds

**Process:**

1. Validates vault address
2. Sets vault for excess fund forwarding
3. Enables automatic fund forwarding

### Role Management

#### Grant Governance Role

```solidity
function grantGovernanceRole(address governance) external onlyRole(FACTORY_ROLE)
```

**Parameters:**

-   `governance`: Address to grant governance role

#### Grant Factory Role

```solidity
function grantFactoryRole(address factory) external onlyRole(DEFAULT_ADMIN_ROLE)
```

**Parameters:**

-   `factory`: Address to grant factory role

## 📊 Fund Distribution Logic

### N/M Percentage Split

The treasury automatically distributes incoming funds:

```solidity
function _distributeFunds(uint256 amount) internal {
    uint256 toBusiness = (amount * $.nPercentage) / 10000;
    uint256 toTreasury = amount - toBusiness;

    // N% to business
    IERC20($.usdc).safeTransfer($.businessAddress, toBusiness);

    // M% remains in treasury
    // Excess funds forwarded to vault
}
```

### Reserve Management

The treasury maintains a minimum reserve amount:

```solidity
function _forwardExcessFunds() internal {
    uint256 balance = IERC20($.usdc).balanceOf(address(this));
    if (balance > $.reserveAmount) {
        uint256 excessAmount = balance - $.reserveAmount;
        // Forward excess to vault
        IRewards($.vault).addReward($.usdc, excessAmount);
    }
}
```

## 🚀 Deployment

### Initialization

```solidity
function initialize(
    address _usdcAddress,
    uint256 _reserveAmount,
    uint256 _nPercentage,
    address _initialOwner,
    address _businessAddress,
    address _buildingFactory
) public initializer
```

**Parameters:**

-   `_usdcAddress`: USDC token address
-   `_reserveAmount`: Minimum reserve amount
-   `_nPercentage`: Business percentage (in basis points)
-   `_initialOwner`: Initial owner address
-   `_businessAddress`: Business address for payments
-   `_buildingFactory`: Building factory address

### Deployment Example

```typescript
// Deploy Treasury
const treasury = await ethers.deployContract("Treasury");

// Initialize Treasury
await treasury.initialize(
    usdcAddress,
    ethers.parseUnits("10000", 6), // 10,000 USDC reserve
    2000, // 20% to business
    deployerAddress,
    businessAddress,
    buildingFactoryAddress,
);

console.log("Treasury deployed to:", treasury.target);
```

## 🔒 Security Considerations

### Access Control

-   **Governance Role**: Payment processing and configuration
-   **Factory Role**: Vault management and role assignment
-   **Admin Role**: Initial setup and role management
-   **Public**: Fund deposits only

### Fund Security

-   **Reserve Management**: Maintains minimum reserves
-   **Excess Forwarding**: Automatically forwards excess to vaults
-   **Payment Validation**: Validates all payments
-   **Balance Checks**: Ensures sufficient funds

### Upgradeability

-   **Upgradeable Contract**: Uses OpenZeppelin upgradeable contracts
-   **Storage Separation**: Uses separate storage contract
-   **Initialization**: Proper initialization pattern

## 🧪 Testing

### Test Coverage

The Treasury includes comprehensive tests:

-   Fund deposit and distribution
-   Payment processing
-   Reserve management
-   Role management
-   Vault integration
-   Edge cases and error conditions

### Running Tests

```bash
# Run treasury tests
yarn hardhat test test/treasury/treasury.test.ts

# Run with gas reporting
yarn hardhat test test/treasury/treasury.test.ts --gas-report
```

## 📚 Usage Examples

### Basic Fund Management

```typescript
// Connect to Treasury
const treasury = await ethers.getContractAt("Treasury", treasuryAddress);

// Deposit funds
await treasury.deposit(ethers.parseUnits("10000", 6)); // 10,000 USDC

// Check treasury balance
const balance = await treasury.getBalance();

// Check reserve amount
const reserve = await treasury.reserve();
```

### Payment Processing

```typescript
// Make payment (governance only)
await treasury.makePayment(
    recipientAddress,
    ethers.parseUnits("5000", 6), // 5,000 USDC
);

// Update reserve amount
await treasury.setReserveAmount(
    ethers.parseUnits("15000", 6), // 15,000 USDC
);
```

### Vault Integration

```typescript
// Add vault for excess funds
await treasury.addVault(vaultAddress);

// Check vault address
const vault = await treasury.vault();
```

### Role Management

```typescript
// Grant governance role
await treasury.grantGovernanceRole(governanceAddress);

// Grant factory role
await treasury.grantFactoryRole(factoryAddress);
```

## 🔗 Integration Points

### With Building Contracts

The Treasury integrates with building contracts to:

-   **Fund Collection**: Receive building-related payments
-   **Payment Processing**: Make building-related payments
-   **Reserve Management**: Maintain building reserves
-   **Vault Integration**: Forward excess funds to building vaults

### With Vault Contracts

The Treasury integrates with vault contracts to:

-   **Excess Fund Forwarding**: Automatically forward excess funds
-   **Reward Distribution**: Add rewards to vaults
-   **Yield Generation**: Generate yield on excess funds
-   **Balance Management**: Maintain optimal fund levels

### With Governance Contracts

The Treasury integrates with governance contracts to:

-   **Payment Authorization**: Governance-controlled payments
-   **Configuration Updates**: Governance-controlled settings
-   **Role Management**: Governance-controlled access
-   **Emergency Functions**: Governance-controlled emergency actions

## 📈 Gas Optimization

### Efficient Operations

-   **Batch Operations**: No batch operations currently implemented
-   **Storage Optimization**: Efficient data structures
-   **Event Optimization**: Minimal event data
-   **Gas Estimation**: Pre-calculate gas costs

### Fund Management

-   **Automatic Distribution**: Efficient fund splitting
-   **Excess Forwarding**: Automatic vault integration
-   **Reserve Management**: Efficient reserve calculations
-   **Payment Processing**: Optimized payment logic

## 🚨 Error Handling

### Custom Errors

```solidity
error Treasury: Invalid USDC address
error Treasury: Invalid governance address
error Treasury: Invalid N percentage
error Treasury: Reserve amount must be greater than zero
```

### Revert Conditions

-   Invalid USDC address
-   Invalid governance address
-   Invalid N percentage (must be ≤ 10000)
-   Reserve amount must be greater than zero
-   Insufficient funds for payments
-   Invalid recipient addresses

## 🔄 Upgrade Path

The Treasury is upgradeable using OpenZeppelin upgradeable contracts:

1. **Deploy New Implementation**: Deploy new implementation contract
2. **Update Proxy**: Update proxy to point to new implementation
3. **Data Migration**: Migrate existing data if necessary
4. **Validation**: Verify upgrade success

## 📊 Monitoring

### Key Metrics

-   **Treasury Balance**: Total USDC balance
-   **Reserve Amount**: Minimum reserve maintained
-   **Business Payments**: Total payments to business
-   **Excess Forwarding**: Funds forwarded to vaults

### Events to Monitor

```solidity
// Fund events
event Deposit(address indexed user, uint256 amount);
event FundsDistributed(uint256 toBusiness, uint256 toTreasury);
event ExcessFundsForwarded(uint256 amount);

// Payment events
event Payment(address indexed recipient, uint256 amount);

// Configuration events
event ReserveAmountUpdated(uint256 newAmount);
event VaultAdded(address indexed vault);
```

## 📞 Support

For questions or issues related to the Treasury:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Upkeeper Documentation](../upkeeper/README.md)
-   [Vault V2 Documentation](../vault/README.md)
-   [Back to Main Documentation](../README.md)
