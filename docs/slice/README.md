# Slice

The Slice contract is a smart contract abstraction that acts as a portfolio manager for yield-bearing real estate tokens. It enables users to deposit capital into a single contract that automatically allocates funds across a predefined set of assets with automated rebalancing.

## 📋 Overview

A Slice is a derivatives fund on tokenized assets (buildings) that:

-   **Portfolio Management**: Maintains predefined asset allocations
-   **Automated Rebalancing**: Periodically rebalances based on price oracles
-   **Yield Optimization**: Captures and compounds yield from underlying assets
-   **Diversification**: Enables seamless diversification across multiple buildings
-   **Dynamic Composition**: Adjusts portfolio based on building metadata

## 🏗️ Architecture

### Key Features

-   **Portfolio Rebalancing**: Maintains target allocation across assets
-   **Price Oracle Integration**: Uses Chainlink oracles for rebalancing
-   **Yield Capture**: Automatically compounds yield from underlying assets
-   **Asset Conversion**: Optional auto-conversion between assets and USDC
-   **Metadata-Based Allocation**: Dynamic composition based on building properties

### Contract Structure

```solidity
contract Slice is ISlice, ERC20, ERC20Permit, Ownable, ERC165 {
    // Asset management
    mapping(address => uint256) public targetAllocations;
    mapping(address => uint256) public currentAllocations;

    // Oracle integration
    mapping(address => address) public priceOracles;

    // Rebalancing
    uint256 public lastRebalanceTime;
    uint256 public rebalanceInterval;
}
```

## 🔧 Core Functions

### Portfolio Management

#### Add Asset to Portfolio

```solidity
function addAsset(
    address asset,
    uint256 targetAllocation,
    address priceOracle
) external onlyOwner
```

**Parameters:**

-   `asset`: Address of the asset to add
-   `targetAllocation`: Target allocation percentage (in basis points)
-   `priceOracle`: Chainlink price oracle address

**Process:**

1. Validates asset and oracle addresses
2. Sets target allocation
3. Configures price oracle
4. Initializes current allocation

#### Remove Asset from Portfolio

```solidity
function removeAsset(address asset) external onlyOwner
```

**Parameters:**

-   `asset`: Address of the asset to remove

**Process:**

1. Validates asset exists in portfolio
2. Withdraws all funds from asset
3. Removes asset from portfolio
4. Updates allocations

#### Update Target Allocation

```solidity
function updateTargetAllocation(address asset, uint256 newAllocation) external onlyOwner
```

**Parameters:**

-   `asset`: Address of the asset
-   `newAllocation`: New target allocation percentage

### Deposit and Withdrawal

#### Deposit Assets

```solidity
function deposit(address asset, uint256 amount) external
```

**Parameters:**

-   `asset`: Asset to deposit
-   `amount`: Amount to deposit

**Process:**

1. Transfers assets from user
2. Mints sTokens to user
3. Allocates assets according to target allocation
4. Updates portfolio balances

#### Withdraw Assets

```solidity
function withdraw(address asset, uint256 sTokenAmount) external
```

**Parameters:**

-   `asset`: Asset to withdraw
-   `sTokenAmount`: Amount of sTokens to burn

**Process:**

1. Calculates asset amount to withdraw
2. Burns sTokens
3. Withdraws assets from portfolio
4. Transfers assets to user

### Rebalancing

#### Manual Rebalancing

```solidity
function rebalance() external
```

**Process:**

1. Calculates current portfolio value
2. Determines required rebalancing
3. Executes trades to achieve target allocation
4. Updates current allocations

#### Automatic Rebalancing

```solidity
function checkAndRebalance() external
```

**Process:**

1. Checks if rebalancing is needed
2. Executes rebalancing if conditions are met
3. Updates last rebalance time

## 📊 Allocation Management

### Target Allocation

Target allocations define the desired percentage of each asset in the portfolio:

```solidity
// Example: 30% Building A, 30% Building B, 40% Building C
targetAllocations[buildingA] = 3000; // 30%
targetAllocations[buildingB] = 3000; // 30%
targetAllocations[buildingC] = 4000; // 40%
```

### Current Allocation

Current allocations track the actual percentage of each asset:

```solidity
function getCurrentAllocation(address asset) public view returns (uint256)
```

### Rebalancing Logic

The rebalancing process:

1. **Calculate Total Value**: Sum of all asset values in USD
2. **Determine Target Values**: Target allocation × Total Value
3. **Calculate Differences**: Current Value - Target Value
4. **Execute Trades**: Buy/sell assets to achieve targets

## 🔄 Price Oracle Integration

### Oracle Configuration

```solidity
function setPriceOracle(address asset, address oracle) external onlyOwner
```

**Parameters:**

-   `asset`: Asset address
-   `oracle`: Chainlink oracle address

### Price Fetching

```solidity
function getAssetPrice(address asset) public view returns (uint256)
```

**Process:**

1. Fetches price from Chainlink oracle
2. Converts to 18 decimal precision
3. Returns current asset price

## 🚀 Deployment

### Constructor

```solidity
constructor(
    address uniswapRouter_,
    address baseToken_,
    string memory name_,
    string memory symbol_,
    string memory metadataUrl_
)
```

**Parameters:**

-   `uniswapRouter_`: Uniswap V2 router address
-   `baseToken_`: Base stablecoin (USDC) address
-   `name_`: sToken name
-   `symbol_`: sToken symbol
-   `metadataUrl_`: Slice metadata URI

### Deployment Example

```typescript
// Deploy Slice contract
const slice = await ethers.deployContract("Slice", [
    uniswapRouterAddress,
    usdcAddress,
    "Real Estate Slice",
    "RES",
    "https://example.com/metadata",
]);

console.log("Slice deployed to:", slice.target);
```

## 🔒 Security Considerations

### Access Control

-   **Owner Only**: Portfolio management, rebalancing, oracle updates
-   **Public**: Deposit, withdrawal, price queries
-   **Validation**: Input validation for all functions

### Price Oracle Security

-   **Oracle Validation**: Ensures oracle addresses are valid
-   **Price Validation**: Checks for stale or invalid prices
-   **Fallback Mechanisms**: Handles oracle failures gracefully

### Rebalancing Security

-   **Slippage Protection**: Implements slippage protection for trades
-   **Gas Optimization**: Efficient rebalancing to minimize costs
-   **Error Handling**: Graceful handling of rebalancing failures

## 🧪 Testing

### Test Coverage

The Slice includes comprehensive tests:

-   Portfolio management
-   Deposit and withdrawal functionality
-   Rebalancing logic
-   Price oracle integration
-   Edge cases and error conditions

### Running Tests

```bash
# Run slice tests
yarn hardhat test test/slice/

# Run specific test file
yarn hardhat test test/slice/slice.test.ts

# Run with gas reporting
yarn hardhat test test/slice/ --gas-report
```

## 📚 Usage Examples

### Portfolio Setup

```typescript
// Connect to Slice
const slice = await ethers.getContractAt("Slice", sliceAddress);

// Add assets to portfolio
await slice.addAsset(
    buildingAAddress,
    3000, // 30% allocation
    chainlinkOracleA,
);

await slice.addAsset(
    buildingBAddress,
    3000, // 30% allocation
    chainlinkOracleB,
);

await slice.addAsset(
    buildingCAddress,
    4000, // 40% allocation
    chainlinkOracleC,
);
```

### User Interactions

```typescript
// Deposit assets
await slice.deposit(buildingAAddress, ethers.parseEther("1000"));

// Check sToken balance
const sTokenBalance = await slice.balanceOf(userAddress);

// Withdraw assets
await slice.withdraw(buildingAAddress, sTokenBalance);
```

### Rebalancing

```typescript
// Manual rebalancing
await slice.rebalance();

// Check if rebalancing is needed
const needsRebalancing = await slice.needsRebalancing();

// Get current allocations
const currentAllocation = await slice.getCurrentAllocation(buildingAAddress);
const targetAllocation = await slice.getTargetAllocation(buildingAAddress);
```

### Price Management

```typescript
// Get asset price
const assetPrice = await slice.getAssetPrice(buildingAAddress);

// Update price oracle
await slice.setPriceOracle(buildingAAddress, newOracleAddress);
```

## 🔗 Integration Points

### With Building Contracts

The Slice integrates with building contracts to:

-   **Asset Management**: Hold building tokens
-   **Yield Capture**: Collect building rewards
-   **Price Discovery**: Use building price oracles
-   **Compliance**: Maintain building compliance requirements

### With Uniswap

The Slice uses Uniswap for:

-   **Asset Swaps**: Rebalancing trades
-   **Liquidity**: Asset conversion
-   **Price Discovery**: Market price validation
-   **Slippage Protection**: Trade execution

### With Chainlink

The Slice integrates with Chainlink for:

-   **Price Feeds**: Real-time asset prices
-   **Oracle Security**: Reliable price data
-   **Fallback Mechanisms**: Price validation
-   **Multi-source Data**: Price aggregation

## 📈 Gas Optimization

### Efficient Rebalancing

-   **Batch Operations**: Multiple trades in single transaction
-   **Gas Estimation**: Pre-calculate gas costs
-   **Optimized Routes**: Efficient swap paths
-   **State Management**: Minimize state changes

### Storage Optimization

-   **Packed Structs**: Optimized data structures
-   **Cached Values**: Frequently accessed data
-   **Event Optimization**: Minimal event data
-   **Memory Management**: Efficient array operations

## 🚨 Error Handling

### Custom Errors

```solidity
error Slice: Asset not found
error Slice: Invalid allocation
error Slice: Oracle not set
error Slice: Rebalancing not needed
```

### Revert Conditions

-   Asset not in portfolio
-   Invalid allocation percentages
-   Oracle not configured
-   Insufficient balances
-   Rebalancing failures

## 🔄 Upgrade Path

The Slice contract is not upgradeable by design. For updates:

1. Deploy new version
2. Migrate existing positions
3. Update integration points
4. Maintain backward compatibility

## 📊 Monitoring

### Key Metrics

-   **Portfolio Value**: Total value of all assets
-   **Allocation Drift**: Deviation from target allocations
-   **Rebalancing Frequency**: How often rebalancing occurs
-   **User Activity**: Deposit and withdrawal activity

### Events to Monitor

```solidity
// Portfolio events
event AssetAdded(address indexed asset, uint256 targetAllocation);
event AssetRemoved(address indexed asset);
event TargetAllocationUpdated(address indexed asset, uint256 newAllocation);

// Trading events
event Rebalanced(address indexed asset, uint256 amount, bool isBuy);
event Deposit(address indexed user, address indexed asset, uint256 amount);
event Withdraw(address indexed user, address indexed asset, uint256 amount);
```

## 📞 Support

For questions or issues related to the Slice:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Treasury Documentation](../treasury/README.md)
-   [Upkeeper Documentation](../upkeeper/README.md)
-   [Back to Main Documentation](../README.md)
