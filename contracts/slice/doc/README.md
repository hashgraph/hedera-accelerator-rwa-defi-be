# Slice  
[Initial] Version 1.0  

## What is Slice 
A Slice is a smart contract abstraction that acts as a portfolio manager for yield-bearing real estate tokens (represented as auto-compounding aTokens or vault-based vTokens). Rather than requiring users to manage individual building tokens and manually adjust their positions, a Slice allows users to deposit capital into a single contract that automatically allocates funds across a predefined set of assets. Each Slice maintains a target allocation strategy (e.g., 30% in Building M, 30% in Building N, and 40% in Building O) and periodically rebalances based on price oracles to keep the portfolio aligned. It enables seamless diversification, yield capture, and optional auto-conversion between underlying assets and USDC. Slices can also be dynamic, adjusting their composition based on building metadata (e.g., location, construction year), making them a powerful, composable tool for real estate-backed DeFi products.

## Overview  
The Slice contract functions as an automated, on‑chain portfolio manager and rebalancer, designed for tokenized real‑world assets (e.g., buildings). It enables users to deposit various yield‑bearing tokens (“aTokens”) representing underlying assets, receive a proportional sToken representing their stake in the Slice fund, and automatically maintains a user‑defined allocation across multiple assets.

## Initialisation  
| Parameters              | Description                                      |
|-------------------------|--------------------------------------------------|
| `uniswapRouter_`        | Address of Uniswap V2 router for swaps.          |
| `baseToken_`            | Base stablecoin (USDC) address.                  |
| `name_`                 | Name of sToken.                                  |
| `symbol_`               | Symbol of sToken.                                |
| `metadataUrl_`          | Slice metadata URI.                              |

## Deployment & Testing  
The contract can be deployed standardly via its contract factory and hardhat:  

```js
const Slice = await ethers.getContractFactory('Slice');
const slice = await Slice.deploy(*deploymentParams*);
await slice.waitForDeployment();
```

Or via script and the command:

```bash
yarn hardhat run examples/slice/deploy-slice.ts —-network testnet
```

The contract can be tested by the following command:

```bash
yarn hardhat test test/slice/slice.test.ts
```

## Roles & Permissions
OWNER (Ownable)
* The deployer or any address you transfer ownership to;
* Transfer Ownership:

```js
await slice.transferOwnership(newOwnerAddress);
```

## Errors
error AssociatedAllocationExists(address aToken);
* Throws when user tries to add new allocation, but allocation associated with passed aToken already exists.

error AllocationNotFound(address aToken);
* Throws when user passes existing allocation, but actually there is no one.

error AllocationsLimitReached();
* Throws when user tries to add new allocation, but allocations limit is reached.

error UnsupportedAToken(address aToken);
* Throws when user tries to add aToken which doesn't implement target interface.

## Core Functions
### Deposit & Mint
deposit(address aToken, uint256 amount) returns uint256
* Transfers amount of related underlying asset from caller => calls AutoCompounder’s deposit;
* Mints sToken equivalent received from AutoCompounder’s deposit.

### Withdraw
withdraw(uint256 sTokenAmount) returns uint256[]
* Calculates userShare = sTokenAmount / totalSupply();
* Burns sTokenAmount from caller;
* Calculates amount to return for each aToken amount = currentBalance / userShare and send back to a user.

## Allocation Management
### Key Functions
addAllocation(address aToken, address priceFeed, uint16 percentage)
* Registers a new aToken with its Chainlink USD price feed and target allocation (0 < percentage < 10_000);
* Passed aToken must implement IAutoCompounder interface, otherwise the UnsupportedAToken error occurs;
* Passed aToken mustn't have associated Allocation, otherwise the AssociatedAllocationExists error occurs.

setAllocationPercentage(address aToken, uint16 newPercentage)
* Updates the target percentage for an existing aToken;
* If there is no associated Allocation the AllocationNotFound error occurs.

## Rebalance Logic
The rebalancing process in a Slice contract ensures that the actual portfolio allocation of aTokens remains aligned with its target allocation percentages. Over time, due to market movements, yield accrual, and user activity, the actual value distribution across different building tokens may drift from the desired ratios (e.g., 30/30/40).

### Key Functions
rebalance()
* Makes set of swaps to closely maintain defined allocations.

### Core Formulas
1. Total Portfolio Value in USD (per token):
$$
\text{underlyingValue} = \text{aTokenBalance} \times \text{exchangeRate}
$$

$$
\text{currentValueUSD} = \frac{\text{underlyingValue} \times \text{priceUSD}}{10^{\text{aTokenDecimals}}}
$$

2. Target value calculation in USD (per token):
$$
\text{targetValue} = \frac{\text{totalValue} \times \text{targetPercentage}}{10000}
$$

3. Target amount in underlying asset (per token):
$$
\text{targetUnderlying} = \frac{\text{targetValue} \times 10^{\text{assetDecimals}}}{\text{underlyingPriceUSD}}
$$

4. Target amount in aToken (perToken):
$$
\text{aTokenTarget} = \text{targetUnderlying} \times \text{exchangeRate}
$$

## View Functions
getTokenAllocation(address aToken) returns Allocation
* Returns the allocation struct for the passed aToken.

allocations() returns Allocation[]
* Returns all existing allocations.

priceFeed(address token) returns address
* Returns the Chainlink aggregator address for the passed token.

uniswapV2Router() returns address
* Returns the Uniswap V2 router address.

baseToken() returns address
* Returns the USDC token address.

metadataUri() returns string
* Returns the URI which contains Slice metadata.

supportsInterface(bytes4 interfaceId) returns bool
* ERC165 interface support check.