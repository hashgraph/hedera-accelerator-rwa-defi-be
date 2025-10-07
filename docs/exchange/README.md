# Exchange

The Exchange module provides a one-sided exchange mechanism for token trading at predetermined prices. It enables controlled token swaps with configurable price thresholds and trading limits.

## 📋 Overview

The One-Sided Exchange contract allows:

-   **Controlled Trading**: Swap tokens at admin-defined prices
-   **Price Management**: Set buy and sell prices with time intervals
-   **Trading Limits**: Configure maximum buy/sell amounts per interval
-   **Permit Support**: Gasless token approvals using EIP-2612
-   **Threshold Management**: Time-based trading restrictions

## 🏗️ Architecture

### Key Features

-   **One-Sided Trading**: Swap between any two tokens at fixed rates
-   **Price Control**: Admin-controlled pricing with time validity
-   **Trading Limits**: Configurable volume restrictions
-   **Permit Integration**: Support for gasless approvals
-   **Reentrancy Protection**: Secure against reentrancy attacks

### Contract Structure

```solidity
contract OneSidedExchange is ReentrancyGuard, Ownable {
    // Price management
    mapping(address => Price) internal _buyPrices;
    mapping(address => Price) internal _sellPrices;
    mapping(address => PriceThreshold) internal _thresholds;

    // Trading tracking
    mapping(address => uint256) internal _buyAmounts;
    mapping(address => uint256) internal _sellAmounts;
}
```

## 🔧 Core Functions

### Trading Operations

#### Swap Tokens

```solidity
function swap(address tokenA, address tokenB, uint256 amount) public nonReentrant
```

**Parameters:**

-   `tokenA`: Token to sell
-   `tokenB`: Token to buy
-   `amount`: Amount of tokenA to sell

**Process:**

1. Validates token addresses and amount
2. Checks price validity and trading limits
3. Calculates tokenB amount to receive
4. Executes the swap
5. Updates trading volumes

#### Swap with Permit

```solidity
function swapWithSignature(
    address tokenA,
    address tokenB,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) public nonReentrant
```

**Parameters:**

-   `tokenA`: Token to sell
-   `tokenB`: Token to buy
-   `amount`: Amount of tokenA to sell
-   `deadline`: Permit signature deadline
-   `v`, `r`, `s`: Permit signature components

**Process:**

1. Validates permit signature
2. Executes standard swap logic

### Deposit and Withdrawal

#### Deposit Tokens

```solidity
function deposit(address token, uint256 amount) public nonReentrant onlyOwner
```

**Parameters:**

-   `token`: Token address to deposit
-   `amount`: Amount to deposit

**Requirements:**

-   Caller must be contract owner
-   Sufficient token balance and allowance

#### Withdraw Tokens

```solidity
function withdraw(address token, uint256 amount) public nonReentrant onlyOwner
```

**Parameters:**

-   `token`: Token address to withdraw
-   `amount`: Amount to withdraw

**Requirements:**

-   Caller must be contract owner
-   Sufficient contract balance

#### Deposit with Permit

```solidity
function depositWithSignature(
    address token,
    uint256 amount,
    uint256 deadline,
    uint8 v,
    bytes32 r,
    bytes32 s
) public nonReentrant onlyOwner
```

**Parameters:**

-   `token`: Token address to deposit
-   `amount`: Amount to deposit
-   `deadline`: Permit signature deadline
-   `v`, `r`, `s`: Permit signature components

## 📊 Price Management

### Set Buy Price

```solidity
function setBuyPrice(address token, uint256 amount, uint256 interval) public onlyOwner
```

**Parameters:**

-   `token`: Token address
-   `amount`: Buy price per token
-   `interval`: Price validity timestamp

### Set Sell Price

```solidity
function setSellPrice(address token, uint256 amount, uint256 interval) public onlyOwner
```

**Parameters:**

-   `token`: Token address
-   `amount`: Sell price per token
-   `interval`: Price validity timestamp

### Set Trading Thresholds

```solidity
function setThreshold(
    address token,
    uint256 maxSellAmount,
    uint256 maxBuyAmount,
    uint256 interval
) public onlyOwner
```

**Parameters:**

-   `token`: Token address
-   `maxSellAmount`: Maximum sell amount per interval
-   `maxBuyAmount`: Maximum buy amount per interval
-   `interval`: Threshold validity timestamp

## 🔍 Query Functions

### Estimate Token Returns

```solidity
function estimateTokenReturns(
    address tokenA,
    address tokenB,
    uint256 amount
) public view returns (uint256 tokenAAmount, uint256 tokenBAmount)
```

**Parameters:**

-   `tokenA`: Token to sell
-   `tokenB`: Token to buy
-   `amount`: Amount of tokenA to sell

**Returns:**

-   `tokenAAmount`: Amount of tokenA to sell
-   `tokenBAmount`: Amount of tokenB to receive

**Process:**

1. Validates price existence and validity
2. Calculates exchange rate
3. Adjusts for token decimals
4. Returns estimated amounts

## 📝 Data Structures

### Price

```solidity
struct Price {
    uint256 price;    // Price per token
    uint256 interval; // Validity timestamp
}
```

### PriceThreshold

```solidity
struct PriceThreshold {
    uint256 maxSellAmount; // Maximum sell amount per interval
    uint256 maxBuyAmount;  // Maximum buy amount per interval
    uint256 interval;      // Threshold validity timestamp
}
```

## 🚀 Deployment

### Constructor

```solidity
constructor() Ownable(msg.sender)
```

The contract is deployed with the deployer as the initial owner.

### Deployment Example

```typescript
// Deploy One-Sided Exchange
const oneSidedExchange = await ethers.deployContract("OneSidedExchange");

console.log("One-Sided Exchange deployed to:", oneSidedExchange.target);
```

## 🔒 Security Considerations

### Access Control

-   **Owner Only**: Price setting, threshold management, deposits, withdrawals
-   **Public**: Token swapping and estimation functions
-   **Reentrancy Protection**: All external functions protected

### Price Validation

-   **Time Validity**: Prices and thresholds have expiration times
-   **Amount Validation**: Zero amounts and invalid addresses rejected
-   **Balance Checks**: Sufficient balances required for operations

### Trading Limits

-   **Volume Restrictions**: Maximum buy/sell amounts per interval
-   **Time-Based Limits**: Thresholds reset after interval expiration
-   **Decimal Handling**: Proper decimal adjustment for different tokens

## 🧪 Testing

### Test Coverage

The Exchange includes comprehensive tests:

-   Token swapping functionality
-   Price management
-   Trading limits and thresholds
-   Permit signature support
-   Deposit and withdrawal operations
-   Edge cases and error conditions

### Running Tests

```bash
# Run exchange tests
yarn hardhat test test/exchange/exchange.test.ts

# Run with gas reporting
yarn hardhat test test/exchange/exchange.test.ts --gas-report
```

## 📚 Usage Examples

### Basic Token Swap

```typescript
// Connect to exchange
const exchange = await ethers.getContractAt("OneSidedExchange", exchangeAddress);

// Estimate swap returns
const [tokenAAmount, tokenBAmount] = await exchange.estimateTokenReturns(
    tokenAAddress,
    tokenBAddress,
    ethers.parseEther("100"),
);

// Execute swap
await exchange.swap(tokenAAddress, tokenBAddress, ethers.parseEther("100"));
```

### Price Management

```typescript
// Set buy price for token
await exchange.setBuyPrice(
    tokenAddress,
    ethers.parseEther("100"), // 100 wei per token
    Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
);

// Set sell price for token
await exchange.setSellPrice(
    tokenAddress,
    ethers.parseEther("95"), // 95 wei per token
    Math.floor(Date.now() / 1000) + 3600, // Valid for 1 hour
);

// Set trading thresholds
await exchange.setThreshold(
    tokenAddress,
    ethers.parseEther("1000"), // Max sell: 1000 tokens
    ethers.parseEther("1000"), // Max buy: 1000 tokens
    Math.floor(Date.now() / 1000) + 86400, // Valid for 24 hours
);
```

### Deposit and Withdrawal

```typescript
// Deposit tokens to exchange
await exchange.deposit(tokenAddress, ethers.parseEther("10000"));

// Withdraw tokens from exchange
await exchange.withdraw(tokenAddress, ethers.parseEther("1000"));
```

### Permit Support

```typescript
// Create permit signature
const permit = await createPermitSignature(tokenAddress, exchangeAddress, ethers.parseEther("100"), deadline);

// Swap with permit
await exchange.swapWithSignature(
    tokenAAddress,
    tokenBAddress,
    ethers.parseEther("100"),
    deadline,
    permit.v,
    permit.r,
    permit.s,
);
```

## 🔗 Integration Points

### With Token Contracts

The Exchange integrates with ERC20 tokens that support:

-   **Standard ERC20**: Basic token functionality
-   **EIP-2612 Permit**: Gasless approvals
-   **Decimal Support**: Proper decimal handling

### With Building Contracts

The Exchange can be used for:

-   **Building Token Trading**: Swap building tokens
-   **USDC Trading**: Exchange USDC for building tokens
-   **Portfolio Rebalancing**: Adjust token allocations

### With Frontend Applications

Frontend applications can use the Exchange for:

-   **Price Display**: Show current trading prices
-   **Trade Execution**: Execute token swaps
-   **Portfolio Management**: Rebalance token holdings

## 📈 Gas Optimization

### Efficient Operations

-   **Reentrancy Protection**: Minimal gas overhead
-   **Validation**: Early validation to prevent unnecessary operations
-   **Storage**: Optimized data structures
-   **Batch Operations**: No batch operations currently implemented

### Decimal Handling

-   **Automatic Adjustment**: Handles different token decimals
-   **Precision**: Maintains precision in calculations
-   **Gas Efficiency**: Optimized decimal conversion logic

## 🚨 Error Handling

### Custom Errors

```solidity
error InvalidAmount(string message, uint256 amount);
error NoPriceExists(string message);
error InvalidAddress(string message);
```

### Revert Conditions

-   Invalid token addresses (zero address)
-   Zero amounts
-   Non-existent prices
-   Expired prices or thresholds
-   Insufficient balances
-   Exceeded trading limits

## 🔄 Upgrade Path

The Exchange contract is not upgradeable by design. For updates:

1. Deploy new version
2. Migrate existing balances
3. Update integration points
4. Maintain backward compatibility

## 📊 Monitoring

### Key Metrics

-   **Trading Volume**: Total tokens swapped
-   **Price Updates**: Frequency of price changes
-   **Threshold Usage**: Trading limit utilization
-   **User Activity**: Number of active traders

### Events to Monitor

```solidity
// Trading events
event SwapSuccess(
    address indexed trader,
    address tokenA,
    address tokenB,
    uint256 tokenAAmount,
    uint256 tokenBAmount
);

// Deposit/withdrawal events
event Deposit(address token, uint256 amount);
event Withdraw(address token, uint256 amount);
```

## 📞 Support

For questions or issues related to the Exchange:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Slice Documentation](../slice/README.md)
-   [Treasury Documentation](../treasury/README.md)
-   [Back to Main Documentation](../README.md)
