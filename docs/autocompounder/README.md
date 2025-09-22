# Auto Compounder

The Auto Compounder is a smart contract that automatically reinvests vault rewards back into the underlying asset, creating a compounding effect for users. It supports both ERC4626 (synchronous) and ERC7540 (asynchronous) vaults.

## 📋 Overview

The Auto Compounder acts as an automated yield optimization tool that:

-   Accepts deposits of underlying assets
-   Issues aTokens representing the user's stake
-   Automatically claims rewards from the vault
-   Swaps rewards (USDC) back to underlying assets
-   Reinvests the swapped assets back into the vault
-   Maintains an exchange rate that increases over time

## 🏗️ Architecture

### Key Features

-   **Dual Vault Support**: Works with both ERC4626 and ERC7540 vaults
-   **Automatic Compounding**: Claims and reinvests rewards automatically
-   **Exchange Rate Tracking**: aTokens increase in value as rewards compound
-   **Uniswap Integration**: Swaps USDC rewards to underlying assets
-   **User Reward Tracking**: Tracks individual user reward claims

### Contract Structure

```solidity
contract AutoCompounder is IAutoCompounder, ERC20, ERC20Permit, Ownable, ERC165 {
    // Immutable vault and configuration
    IERC4626 private immutable _vault;
    bool private immutable isAsync;
    address private immutable _underlying;
    IUniswapV2Router02 private _uniswapV2Router;
    address private _usdc;

    // User reward tracking
    mapping(address => uint256) internal _userClaimedRewards;
}
```

## 🔧 Core Functions

### Deposit

```solidity
function deposit(uint256 assets, address receiver) external override returns (uint256 amountToMint)
```

**Parameters:**

-   `assets`: Amount of underlying assets to deposit
-   `receiver`: Address to receive the minted aTokens

**Process:**

1. Calculates aToken amount using current exchange rate
2. Transfers underlying assets from user
3. Deposits assets into the vault
4. Mints aTokens to receiver

**Returns:** Amount of aTokens minted

### Withdraw

```solidity
function withdraw(uint256 aTokenAmount, address receiver) external override returns (uint256 underlyingAmount)
```

**Parameters:**

-   `aTokenAmount`: Amount of aTokens to burn
-   `receiver`: Address to receive the underlying assets

**Process:**

1. Calculates underlying amount using exchange rate
2. Claims user's reward share
3. Burns aTokens
4. Withdraws underlying assets from vault
5. Transfers assets to receiver

**Returns:** Amount of underlying assets withdrawn

### Claim Rewards

```solidity
function claim() external
```

**Process:**

1. Checks if minimum reward threshold is met (10 USDC)
2. Claims all rewards from vault
3. Swaps USDC to underlying asset via Uniswap
4. Reinvests swapped assets back into vault

**Requirements:**

-   Minimum reward amount must be met
-   Sufficient gas for transaction

## 📊 Exchange Rate Mechanism

### Exchange Rate Calculation

```solidity
function exchangeRate() public view override returns (uint256)
```

The exchange rate determines how many aTokens a user receives for their underlying assets:

```
exchangeRate = aTokenTotalSupply / vaultTotalSupply
```

### How Compounding Works

1. **Initial Deposit**: User deposits 1000 underlying tokens
2. **aToken Minting**: Receives 1000 aTokens (1:1 ratio initially)
3. **Reward Accumulation**: Vault generates USDC rewards
4. **Auto Compounding**: Rewards are claimed and reinvested
5. **Exchange Rate Increase**: aToken value increases relative to underlying

### Example Scenario

```
Initial State:
- User deposits: 1000 underlying tokens
- User receives: 1000 aTokens
- Exchange rate: 1.0

After Compounding:
- Vault total supply: 1100 underlying tokens (100 rewards reinvested)
- aToken total supply: 1000 aTokens
- Exchange rate: 1.1
- User's aTokens now represent: 1100 underlying tokens
```

## 🔄 Reward Distribution

### User Reward Calculation

```solidity
function getPendingReward(address user) public view returns (uint256 pendingReward)
```

**Formula:**

```
userReward = (userBalance * totalReward) / totalSupply
pendingReward = userReward - claimedRewards
```

### Claiming User Rewards

```solidity
function claimExactUserReward(address receiver) public
```

**Process:**

1. Calculates user's share of total rewards
2. Subtracts already claimed rewards
3. Claims exact amount from vault
4. Transfers rewards to receiver

## 🏭 Factory Pattern

### AutoCompounderFactory

The factory contract deploys new AutoCompounder instances:

```solidity
function deployAutoCompounder(
    address uniswapV2Router_,
    address vault_,
    address usdc_,
    string memory name_,
    string memory symbol_,
    address operator_
) external returns (address)
```

**Parameters:**

-   `uniswapV2Router_`: Uniswap V2 router address
-   `vault_`: Target vault address (ERC4626 or ERC7540)
-   `usdc_`: USDC token address
-   `name_`: aToken name
-   `symbol_`: aToken symbol
-   `operator_`: Operator for ERC7540 vaults

## 🔧 Configuration

### Constructor Parameters

```solidity
constructor(
    address uniswapV2Router_,
    address vault_,
    address usdc_,
    string memory name_,
    string memory symbol_,
    address operator_
)
```

### Validation

-   Uniswap router address cannot be zero
-   Vault must support ERC4626 or ERC7540 interface
-   USDC address cannot be zero
-   For async vaults, operator is set automatically

## 📝 Events

### Deposit

```solidity
event Deposit(address indexed sender, address indexed receiver, uint256 assets, uint256 amountToMint);
```

### Withdraw

```solidity
event Withdraw(address indexed sender, uint256 aTokenAmount, uint256 underlyingAmount);
```

### Claim

```solidity
event Claim(uint256 underlyingAmount);
```

### UserClaimedReward

```solidity
event UserClaimedReward(address indexed sender, address indexed receiver, uint256 userReward);
```

## 🚀 Deployment

### Using Factory

```typescript
// Deploy AutoCompounder via factory
const autoCompounderFactory = await ethers.getContractAt("AutoCompounderFactory", factoryAddress);

const tx = await autoCompounderFactory.deployAutoCompounder(
    uniswapV2RouterAddress,
    vaultAddress,
    usdcAddress,
    "Building A Token",
    "BAT",
    operatorAddress,
);

const receipt = await tx.wait();
const autoCompounderAddress = receipt.logs[0].args.autoCompounder;
```

### Direct Deployment

```typescript
// Deploy directly (not recommended)
const autoCompounder = await ethers.deployContract("AutoCompounder", [
    uniswapV2RouterAddress,
    vaultAddress,
    usdcAddress,
    "Building A Token",
    "BAT",
    operatorAddress,
]);
```

## 🔒 Security Considerations

### Access Control

-   Only owner can perform administrative functions
-   Users can only withdraw their own aTokens
-   Reward claiming is permissionless but tracked

### Reentrancy Protection

-   No external calls in critical functions
-   SafeERC20 for token transfers
-   Proper state updates before external calls

### Slippage Protection

-   Uniswap swaps use minimum amount out of 0
-   Consider implementing slippage protection for production

## 🧪 Testing

### Test Coverage

The AutoCompounder includes comprehensive tests:

-   Deposit and withdrawal functionality
-   Exchange rate calculations
-   Reward claiming and distribution
-   Async vault integration
-   Edge cases and error conditions

### Running Tests

```bash
# Run AutoCompounder tests
yarn hardhat test test/autocompounder/autocompounder.test.ts

# Run with gas reporting
yarn hardhat test test/autocompounder/autocompounder.test.ts --gas-report
```

## 📚 Usage Examples

### Basic Deposit and Withdrawal

```typescript
// Connect to AutoCompounder
const autoCompounder = await ethers.getContractAt("AutoCompounder", autoCompounderAddress);

// Deposit underlying assets
await autoCompounder.deposit(ethers.parseEther("1000"), userAddress);

// Check aToken balance
const aTokenBalance = await autoCompounder.balanceOf(userAddress);

// Check exchange rate
const exchangeRate = await autoCompounder.exchangeRate();

// Withdraw assets
await autoCompounder.withdraw(aTokenBalance, userAddress);
```

### Reward Management

```typescript
// Check pending rewards
const pendingReward = await autoCompounder.getPendingReward(userAddress);

// Claim user rewards
await autoCompounder.claimExactUserReward(userAddress);

// Trigger auto compounding (if minimum threshold met)
await autoCompounder.claim();
```

### Integration with Vaults

```typescript
// For ERC4626 vaults
const vault = await ethers.getContractAt("IERC4626", vaultAddress);
const totalAssets = await vault.totalAssets();

// For ERC7540 vaults
const asyncVault = await ethers.getContractAt("IERC7540", vaultAddress);
const isAsync = await asyncVault.supportsInterface("0x...");
```

## 🔗 Integration Points

### With Vaults

-   **ERC4626 Vaults**: Direct deposit/withdraw calls
-   **ERC7540 Vaults**: Request-based operations with operator

### With Uniswap

-   **Swap Path**: USDC → Underlying Asset
-   **Router**: Uniswap V2 Router
-   **Slippage**: Currently set to 0 (consider adding protection)

### With Rewards System

-   **Reward Token**: USDC
-   **Claiming**: Automatic via `claim()` function
-   **Distribution**: Proportional to aToken holdings

## 📈 Gas Optimization

### Efficient Calculations

-   Uses `FixedPointMathLib` for precise math operations
-   Cached vault type detection
-   Immutable variables for gas savings

### Batch Operations

-   No batch operations currently implemented
-   Consider adding batch deposit/withdraw functions

## 🚨 Error Handling

### Custom Errors

```solidity
error InsufficientReward(uint256 reward);
```

### Revert Conditions

-   Invalid asset amounts (zero)
-   Invalid receiver addresses
-   Insufficient reward for compounding
-   Unsupported vault interface

## 🔄 Upgrade Path

The AutoCompounder is not upgradeable by design. For updates:

1. Deploy new version
2. Migrate user positions
3. Update integration points
4. Maintain backward compatibility

## 📊 Monitoring

### Key Metrics

-   **Exchange Rate**: Tracks compounding performance
-   **Total Assets**: Total underlying assets managed
-   **User Count**: Number of active users
-   **Reward Claims**: Frequency of compounding events

### Events to Monitor

-   `Deposit` events for user activity
-   `Claim` events for compounding activity
-   `UserClaimedReward` events for reward distribution

## 📞 Support

For questions or issues related to the AutoCompounder:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Buildings Documentation](../buildings/README.md)
-   [Vault V2 Documentation](../vault/README.md)
-   [Back to Main Documentation](../README.md)
