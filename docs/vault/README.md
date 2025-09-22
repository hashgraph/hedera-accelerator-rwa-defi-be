# Vault V2 (RewardsVault4626)

The Vault V2 contract is an ERC4626-compliant vault implementation with enhanced reward distribution and lock period functionality. It provides a standardized interface for managing yield-bearing assets with built-in reward mechanisms.

## 📋 Overview

The RewardsVault4626 provides:

-   **ERC4626 Compliance**: Standardized vault interface
-   **Reward Distribution**: Multi-token reward system
-   **Lock Periods**: Configurable withdrawal restrictions
-   **Yield Generation**: Automated yield capture and distribution
-   **User Management**: Individual user tracking and rewards

## 🏗️ Architecture

### Key Features

-   **ERC4626 Standard**: Full compliance with ERC4626 standard
-   **Reward System**: Multi-token reward distribution
-   **Lock Periods**: Time-based withdrawal restrictions
-   **User Tracking**: Individual user reward tracking
-   **Yield Optimization**: Automated yield capture

### Contract Structure

```solidity
contract RewardsVault4626 is IERC4626 {
    // Core vault data
    IERC20 public immutable asset;
    uint256 public immutable lockPeriod;
    address public owner;

    // Reward system
    address[] public rewardTokens;
    mapping(address => RewardInfo) public rewardInfo;

    // User management
    mapping(address => UserInfo) public userInfo;
}
```

## 🔧 Core Functions

### Deposit and Withdrawal

#### Deposit Assets

```solidity
function deposit(uint256 assets, address receiver) public virtual override returns (uint256 shares)
```

**Parameters:**

-   `assets`: Amount of assets to deposit
-   `receiver`: Address to receive shares

**Process:**

1. Calculates shares to mint
2. Updates user rewards
3. Transfers assets from caller
4. Mints shares to receiver
5. Sets lock time for new users

#### Mint Shares

```solidity
function mint(uint256 shares, address receiver) public virtual override returns (uint256 assets)
```

**Parameters:**

-   `shares`: Amount of shares to mint
-   `receiver`: Address to receive shares

**Process:**

1. Calculates assets needed
2. Updates user rewards
3. Transfers assets from caller
4. Mints shares to receiver
5. Sets lock time for new users

#### Withdraw Assets

```solidity
function withdraw(uint256 assets, address receiver, address owner_) public virtual override returns (uint256 shares)
```

**Parameters:**

-   `assets`: Amount of assets to withdraw
-   `receiver`: Address to receive assets
-   `owner_`: Owner of the shares

**Process:**

1. Validates withdrawal is unlocked
2. Calculates shares to burn
3. Claims all rewards
4. Burns shares
5. Transfers assets to receiver

#### Redeem Shares

```solidity
function redeem(uint256 shares, address receiver, address owner_) public virtual override returns (uint256 assets)
```

**Parameters:**

-   `shares`: Amount of shares to redeem
-   `receiver`: Address to receive assets
-   `owner_`: Owner of the shares

**Process:**

1. Validates redemption is unlocked
2. Calculates assets to return
3. Claims all rewards
4. Burns shares
5. Transfers assets to receiver

## 📊 Reward System

### Add Rewards

```solidity
function addReward(address token, uint256 amount) external onlyOwner
```

**Parameters:**

-   `token`: Reward token address
-   `amount`: Amount of rewards to add

**Process:**

1. Validates token and amount
2. Calculates reward per share
3. Registers token if new
4. Updates reward information
5. Transfers rewards to vault

### Claim Rewards

#### Claim All Rewards

```solidity
function claimAllRewards() external
```

**Process:**

1. Iterates through all reward tokens
2. Claims rewards for caller
3. Updates user reward tracking

#### Claim Specific Rewards

```solidity
function claimSpecificsReward(address[] memory tokens) external returns (uint256)
```

**Parameters:**

-   `tokens`: Array of reward tokens to claim

**Process:**

1. Iterates through specified tokens
2. Claims rewards for caller
3. Returns number of tokens claimed

### Get Claimable Rewards

```solidity
function getClaimableReward(address user, address token) external view returns (uint256)
```

**Parameters:**

-   `user`: User address
-   `token`: Reward token address

**Returns:** Amount of claimable rewards

## 🔒 Lock Period Management

### Check Unlock Status

```solidity
function isUnlocked(address user) external view returns (bool)
```

**Parameters:**

-   `user`: User address

**Returns:** Whether user's assets are unlocked

### Get Time Until Unlock

```solidity
function getTimeUntilUnlock(address user) external view returns (uint256)
```

**Parameters:**

-   `user`: User address

**Returns:** Time remaining until unlock

### Unlock and Withdraw

```solidity
function unlock(uint256 startPosition, uint256 assets) external returns (uint256, uint256, uint256)
```

**Parameters:**

-   `startPosition`: Starting position for reward claiming
-   `assets`: Amount of assets to withdraw

**Process:**

1. Validates user has deposits
2. Validates unlock period has passed
3. Claims rewards with pagination
4. Withdraws assets
5. Returns unlock information

## 🚀 Deployment

### Constructor

```solidity
constructor(
    IERC20 _asset,
    string memory _name,
    string memory _symbol,
    uint8 _decimals,
    uint256 _lockPeriod,
    address _owner
)
```

**Parameters:**

-   `_asset`: Underlying asset token
-   `_name`: Vault token name
-   `_symbol`: Vault token symbol
-   `_decimals`: Token decimals
-   `_lockPeriod`: Lock period in seconds
-   `_owner`: Vault owner address

### Deployment Example

```typescript
// Deploy RewardsVault4626
const vault = await ethers.deployContract("RewardsVault4626", [
    assetAddress,
    "Building Vault",
    "BV",
    18,
    86400 * 30, // 30 days lock period
    ownerAddress,
]);

console.log("Vault deployed to:", vault.target);
```

## 🔒 Security Considerations

### Access Control

-   **Owner Only**: Reward management and configuration
-   **Public**: Deposit, withdrawal, and reward claiming
-   **Validation**: Input validation for all functions

### Lock Period Security

-   **Time-Based Locks**: Prevents early withdrawals
-   **Lock Extension Prevention**: Lock time not reset on deposits
-   **Unlock Validation**: Validates unlock conditions

### Reward Security

-   **Proportional Distribution**: Rewards distributed proportionally
-   **User Tracking**: Individual user reward tracking
-   **Claim Validation**: Validates reward claims

## 🧪 Testing

### Test Coverage

The Vault V2 includes comprehensive tests:

-   ERC4626 compliance
-   Deposit and withdrawal functionality
-   Reward distribution
-   Lock period management
-   Edge cases and error conditions

### Running Tests

```bash
# Run vault tests
yarn hardhat test test/vaultV2/

# Run specific test file
yarn hardhat test test/vaultV2/vault.test.ts

# Run with gas reporting
yarn hardhat test test/vaultV2/ --gas-report
```

## 📚 Usage Examples

### Basic Vault Operations

```typescript
// Connect to Vault
const vault = await ethers.getContractAt("RewardsVault4626", vaultAddress);

// Deposit assets
await vault.deposit(ethers.parseEther("1000"), userAddress);

// Check shares
const shares = await vault.balanceOf(userAddress);

// Check assets
const assets = await vault.assetsOf(userAddress);
```

### Reward Management

```typescript
// Add rewards (owner only)
await vault.addReward(rewardTokenAddress, ethers.parseEther("1000"));

// Claim all rewards
await vault.claimAllRewards();

// Claim specific rewards
await vault.claimSpecificsReward([rewardTokenAddress]);

// Check claimable rewards
const claimable = await vault.getClaimableReward(userAddress, rewardTokenAddress);
```

### Lock Period Management

```typescript
// Check if unlocked
const isUnlocked = await vault.isUnlocked(userAddress);

// Get time until unlock
const timeUntilUnlock = await vault.getTimeUntilUnlock(userAddress);

// Unlock and withdraw
const [timestamp, lockStart, lockPeriod] = await vault.unlock(
    0, // Start position
    ethers.parseEther("1000"), // Assets to withdraw
);
```

### Vault Information

```typescript
// Get vault details
const asset = await vault.asset();
const lockPeriod = await vault.lockPeriod();
const owner = await vault.owner();

// Get total value locked
const tvl = await vault.getTVL();

// Get reward tokens
const rewardTokensLength = await vault.getRewardTokensLength();
```

## 🔗 Integration Points

### With Building Contracts

The Vault V2 integrates with building contracts to:

-   **Asset Management**: Store building assets
-   **Yield Generation**: Generate yield from buildings
-   **Reward Distribution**: Distribute building rewards
-   **Lock Management**: Manage building lock periods

### With Auto Compounder

The Vault V2 integrates with auto compounder to:

-   **Reward Claiming**: Claim rewards automatically
-   **Asset Reinvestment**: Reinvest rewards
-   **Yield Optimization**: Optimize yield generation
-   **Exchange Rate**: Track compounding performance

### With Treasury Contracts

The Vault V2 integrates with treasury contracts to:

-   **Excess Fund Forwarding**: Receive excess funds
-   **Reward Distribution**: Distribute treasury rewards
-   **Fund Management**: Manage treasury funds
-   **Yield Generation**: Generate yield on treasury funds

## 📈 Gas Optimization

### Efficient Operations

-   **Batch Operations**: No batch operations currently implemented
-   **Storage Optimization**: Efficient data structures
-   **Event Optimization**: Minimal event data
-   **Gas Estimation**: Pre-calculate gas costs

### Reward Management

-   **Pagination**: Reward claiming with pagination
-   **Efficient Calculations**: Optimized reward calculations
-   **State Management**: Minimize state changes
-   **Memory Usage**: Optimized memory operations

## 🚨 Error Handling

### Custom Errors

```solidity
error Vault: Invalid token address
error Vault: Cannot add underlying asset as reward
error Vault: Amount must be greater than 0
error Vault: No shares minted yet
```

### Revert Conditions

-   Invalid token addresses
-   Cannot add underlying asset as reward
-   Zero amounts
-   No shares minted
-   Insufficient balances
-   Lock period not reached

## 🔄 Upgrade Path

The Vault V2 contract is not upgradeable by design. For updates:

1. Deploy new version
2. Migrate existing positions
3. Update integration points
4. Maintain backward compatibility

## 📊 Monitoring

### Key Metrics

-   **Total Value Locked (TVL)**: Total assets in vault
-   **User Count**: Number of active users
-   **Reward Distribution**: Reward distribution activity
-   **Lock Period Usage**: Lock period utilization

### Events to Monitor

```solidity
// Vault events
event Deposit(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);
event Withdraw(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);

// Reward events
event RewardAdded(address indexed token, uint256 amount);
event RewardClaimed(address indexed user, address indexed token, uint256 amount);
event RewardTokenRegistered(address indexed token);

// Ownership events
event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
```

## 📞 Support

For questions or issues related to the Vault V2:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Back to Main Documentation](../README.md)
