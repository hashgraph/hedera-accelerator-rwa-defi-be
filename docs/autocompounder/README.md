# Auto Compounder (RewardsVaultAutoCompounder)

The RewardsVaultAutoCompounder is a smart contract that automatically reinvests vault rewards back into the underlying asset, creating a compounding effect for users. It's specifically designed to work with RewardsVault4626 contracts and provides enhanced Uniswap integration for reward token swapping.

## 📋 Overview

The RewardsVaultAutoCompounder acts as an automated yield optimization tool that:

-   Accepts deposits of underlying assets
-   Issues autocompounder tokens representing the user's stake
-   Automatically claims rewards from the RewardsVault4626
-   Swaps reward tokens to underlying assets via Uniswap
-   Reinvests the swapped assets back into the vault
-   Maintains an exchange rate that increases over time
-   Provides configurable swap paths and slippage protection

## 🏗️ Architecture

### Key Features

-   **RewardsVault4626 Integration**: Specifically designed for RewardsVault4626 contracts
-   **Automatic Compounding**: Claims and reinvests rewards automatically
-   **Exchange Rate Tracking**: Autocompounder tokens increase in value as rewards compound
-   **Enhanced Uniswap Integration**: Configurable swap paths and slippage protection
-   **Multi-Token Reward Support**: Handles multiple reward tokens from the vault
-   **User Information Tracking**: Tracks user deposit history and totals

### Contract Structure

```solidity
contract RewardsVaultAutoCompounder is IERC20, ReentrancyGuard, IRewardsVaultAutoCompounder, ERC165 {
    // Immutable vault and configuration
    RewardsVault4626 public immutable VAULT;
    IERC20 public immutable ASSET;
    IUniswapV2Router02 public immutable UNISWAP_ROUTER;
    address public immutable INTERMEDIATE_TOKEN;

    // Configuration
    uint256 public minimumClaimThreshold;
    uint256 public maxSlippage;

    // User tracking
    mapping(address => UserInfo) public userInfo;
    mapping(address => address[]) public swapPaths;
}
```

## 🔧 Core Functions

### Deposit

```solidity
function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares)
```

**Parameters:**

-   `assets`: Amount of underlying assets to deposit
-   `receiver`: Address to receive the minted autocompounder tokens

**Process:**

1. Calculates shares to mint using current exchange rate
2. Transfers underlying assets from user
3. Deposits assets into the RewardsVault4626
4. Mints autocompounder tokens to receiver
5. Updates user information

**Returns:** Number of shares minted

### Withdraw

```solidity
function withdraw(uint256 shares, address receiver) external nonReentrant returns (uint256 assets)
```

**Parameters:**

-   `shares`: Number of autocompounder tokens to burn
-   `receiver`: Address to receive the underlying assets

**Process:**

1. Calculates assets to withdraw using exchange rate
2. Burns autocompounder tokens
3. Redeems vault shares
4. Transfers assets to receiver
5. Updates user information

**Returns:** Amount of underlying assets withdrawn

### Auto Compound

```solidity
function autoCompound() external nonReentrant
```

**Process:**

1. Claims all available rewards from the vault
2. Iterates through all reward tokens
3. Swaps reward tokens to underlying asset via Uniswap
4. Reinvests all obtained assets back into the vault
5. Emits compounding event with statistics

**Features:**

-   Configurable minimum claim threshold
-   Slippage protection for swaps
-   Custom swap paths for different tokens
-   Graceful handling of failed swaps

## 📊 Exchange Rate Mechanism

### Exchange Rate Calculation

```solidity
function exchangeRate() public view returns (uint256)
```

The exchange rate determines how many autocompounder tokens a user receives for their underlying assets:

```
exchangeRate = totalAssets / totalSupply
```

### How Compounding Works

1. **Initial Deposit**: User deposits 1000 underlying tokens
2. **Token Minting**: Receives 1000 autocompounder tokens (1:1 ratio initially)
3. **Reward Accumulation**: Vault generates multiple reward tokens
4. **Auto Compounding**: Rewards are claimed, swapped, and reinvested
5. **Exchange Rate Increase**: Autocompounder token value increases relative to underlying

### Example Scenario

```
Initial State:
- User deposits: 1000 underlying tokens
- User receives: 1000 autocompounder tokens
- Exchange rate: 1.0

After Compounding:
- Vault total assets: 1100 underlying tokens (100 rewards reinvested)
- Autocompounder total supply: 1000 tokens
- Exchange rate: 1.1
- User's tokens now represent: 1100 underlying tokens
```

## 🔄 Reward Distribution

### User Reward Calculation

```solidity
function claimUserRewards() external nonReentrant
```

**Process:**

1. Calculates user's proportion of total supply
2. Claims all vault rewards
3. Distributes proportional share to user
4. Transfers rewards to user

### User Information Tracking

```solidity
function getUserInfo(address user) external view returns (uint256 depositTimestamp, uint256 totalDeposited)
```

**Returns:**

-   `depositTimestamp`: When user first deposited
-   `totalDeposited`: Total amount user has deposited

### Withdrawal Eligibility

```solidity
function canWithdraw(address user) external view returns (bool)
```

**Returns:** Whether user can withdraw based on vault's lock period

## 🏭 Factory Pattern

### RewardsVaultAutoCompounderFactory

The factory contract deploys new RewardsVaultAutoCompounder instances:

```solidity
function deployAutoCompounder(
    RewardsVault4626 _vault,
    string memory _name,
    string memory _symbol,
    uint256 _minimumClaimThreshold,
    IUniswapV2Router02 _uniswapRouter,
    address _intermediateToken,
    uint256 _maxSlippage
) external returns (address)
```

**Parameters:**

-   `_vault`: RewardsVault4626 contract address
-   `_name`: Autocompounder token name
-   `_symbol`: Autocompounder token symbol
-   `_minimumClaimThreshold`: Minimum threshold for auto-compound
-   `_uniswapRouter`: Uniswap V2 router address
-   `_intermediateToken`: Intermediate token for swaps (e.g., WETH, USDC)
-   `_maxSlippage`: Maximum allowed slippage (in basis points)

## 🔧 Configuration

### Constructor Parameters

```solidity
constructor(
    RewardsVault4626 _vault,
    string memory _name,
    string memory _symbol,
    uint256 _minimumClaimThreshold,
    IUniswapV2Router02 _uniswapRouter,
    address _intermediateToken,
    uint256 _maxSlippage
)
```

### Validation

-   Vault address cannot be zero
-   Uniswap router address cannot be zero
-   Intermediate token address cannot be zero
-   Maximum slippage cannot exceed 50% (5000 basis points)
-   Asset token is automatically derived from vault

## 📝 Events

### Deposit

```solidity
event Deposit(address indexed user, uint256 assets, uint256 shares)
```

### Withdraw

```solidity
event Withdraw(address indexed user, uint256 shares, uint256 assets)
```

### Auto Compound

```solidity
event AutoCompound(uint256 totalAssetsReinvested, uint256 swapCount)
```

### Rewards Claimed

```solidity
event RewardsClaimed(address indexed user, address indexed rewardToken, uint256 amount)
```

### Token Swapped

```solidity
event TokenSwapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut)
```

### Swap Path Updated

```solidity
event SwapPathUpdated(address indexed rewardToken, address[] newPath)
```

### Ownership Transferred

```solidity
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner)
```

## 🚀 Deployment

### Using Factory

```typescript
// Deploy RewardsVaultAutoCompounder via factory
const autoCompounderFactory = await ethers.getContractAt("RewardsVaultAutoCompounderFactory", factoryAddress);

const tx = await autoCompounderFactory.deployAutoCompounder(
    rewardsVaultAddress,
    "Building Auto Compounder",
    "BAC",
    ethers.parseUnits("10", 6), // 10 USDC minimum threshold
    uniswapV2RouterAddress,
    usdcAddress, // Intermediate token
    300, // 3% max slippage
);

const receipt = await tx.wait();
const autoCompounderAddress = receipt.logs[0].args.autoCompounder;
```

### Direct Deployment

```typescript
// Deploy directly (not recommended)
const autoCompounder = await ethers.deployContract("RewardsVaultAutoCompounder", [
    rewardsVaultAddress,
    "Building Auto Compounder",
    "BAC",
    ethers.parseUnits("10", 6), // 10 USDC minimum threshold
    uniswapV2RouterAddress,
    usdcAddress, // Intermediate token
    300, // 3% max slippage
]);
```

## 🔒 Security Considerations

### Access Control

-   Only owner can perform administrative functions
-   Users can only withdraw their own autocompounder tokens
-   Auto-compounding is permissionless but tracked

### Reentrancy Protection

-   All external functions protected with `nonReentrant` modifier
-   SafeERC20 for token transfers
-   Proper state updates before external calls

### Slippage Protection

-   Configurable maximum slippage (default 3%)
-   Minimum amount out calculated with slippage protection
-   Failed swaps are handled gracefully without reverting

## 🧪 Testing

### Test Coverage

The RewardsVaultAutoCompounder includes comprehensive tests:

-   Deposit and withdrawal functionality
-   Exchange rate calculations
-   Auto-compounding and reward distribution
-   Uniswap swap integration
-   Swap path configuration
-   Slippage protection
-   Edge cases and error conditions

### Running Tests

```bash
# Run RewardsVaultAutoCompounder tests
yarn hardhat test test/vaultV2/

# Run with gas reporting
yarn hardhat test test/vaultV2/ --gas-report
```

## 📚 Usage Examples

### Basic Deposit and Withdrawal

```typescript
// Connect to RewardsVaultAutoCompounder
const autoCompounder = await ethers.getContractAt("RewardsVaultAutoCompounder", autoCompounderAddress);

// Deposit underlying assets
await autoCompounder.deposit(ethers.parseEther("1000"), userAddress);

// Check autocompounder token balance
const tokenBalance = await autoCompounder.balanceOf(userAddress);

// Check exchange rate
const exchangeRate = await autoCompounder.exchangeRate();

// Withdraw assets
await autoCompounder.withdraw(tokenBalance, userAddress);
```

### Auto-Compounding

```typescript
// Trigger auto-compounding
await autoCompounder.autoCompound();

// Check user information
const userInfo = await autoCompounder.getUserInfo(userAddress);
console.log("Deposit timestamp:", userInfo.depositTimestamp);
console.log("Total deposited:", userInfo.totalDeposited);

// Check if user can withdraw
const canWithdraw = await autoCompounder.canWithdraw(userAddress);
```

### Swap Path Configuration

```typescript
// Configure custom swap path for a reward token
const customPath = [rewardTokenAddress, intermediateTokenAddress, assetAddress];
await autoCompounder.setSwapPath(rewardTokenAddress, customPath);

// Test a swap to verify it works
const estimatedOutput = await autoCompounder.testSwap(rewardTokenAddress, ethers.parseEther("100"));

// Get configured swap path
const swapPath = await autoCompounder.getSwapPath(rewardTokenAddress);
```

## 🔗 Integration Points

### With RewardsVault4626

-   **Direct Integration**: Specifically designed for RewardsVault4626
-   **Multi-Token Rewards**: Handles multiple reward tokens from vault
-   **Lock Period Support**: Respects vault's lock period restrictions
-   **Reward Claiming**: Automatic reward claiming and reinvestment

### With Uniswap

-   **Configurable Swap Paths**: Custom paths for different reward tokens
-   **Router**: Uniswap V2 Router
-   **Slippage Protection**: Configurable maximum slippage (default 3%)
-   **Intermediate Token**: Support for multi-hop swaps

### With Reward System

-   **Multiple Reward Tokens**: Handles any ERC20 reward token
-   **Automatic Swapping**: Swaps rewards to underlying asset
-   **Reinvestment**: Automatically reinvests swapped assets
-   **Distribution**: Proportional to autocompounder token holdings

## 📈 Gas Optimization

### Efficient Calculations

-   Uses `FixedPointMathLib` for precise math operations
-   Immutable variables for gas savings
-   Optimized swap path handling

### Batch Operations

-   Auto-compounding processes all reward tokens in single transaction
-   Efficient reward token iteration
-   Graceful handling of failed swaps

## 🚨 Error Handling

### Custom Errors

```solidity
error InsufficientReward(uint256 reward);
```

### Revert Conditions

-   Invalid asset amounts (zero)
-   Invalid receiver addresses
-   Insufficient balance for withdrawal
-   Invalid slippage configuration (>50%)
-   Invalid swap paths
-   Transfer failures

## 🔄 Upgrade Path

The RewardsVaultAutoCompounder is not upgradeable by design. For updates:

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
-   `AutoCompound` events for compounding activity
-   `RewardsClaimed` events for reward distribution
-   `TokenSwapped` events for swap activity

## 📞 Support

For questions or issues related to the RewardsVaultAutoCompounder:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Buildings Documentation](../buildings/README.md)
-   [Vault V2 Documentation](../vault/README.md)
-   [Back to Main Documentation](../README.md)
