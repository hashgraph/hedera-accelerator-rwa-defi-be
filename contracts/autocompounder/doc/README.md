# AutoCompounder  
[Initial] Version 1.0  

## What is AutoCompounder 
So, what's an autocompounder? Think of it as an engine for personal growth in your investment. Instead of just gathering your earnings from the vaults, an autocompounder automatically reinvests those returns back into your asset, meaning your investment isn't idle but is constantly growing and compounding over time.
This is done through continual reinvestment: Autocompounders claim rewards from the vault and then swap them back into property tokens, which creates a cycle whereby your holdings grow without you having to lift a finger. Or in other words: The autocompounder may issue an aToken as proof of your stake, which increases in value as it compounds. Over time, one aToken might come to represent more underlying property tokens due to the accrued rewards.

## Overview  
The AutoCompounder contract allows users to deposit underlying asset tokens into the vault and receive aTokens back and automatically reinvest any earned USDC rewards back into the vault, compounding gains. It
supports both synchronous (ERC4626) and asynchronous (ERC7540) vaults.

## Initialisation  
| Parameters              | Description                                                    |
|-------------------------|----------------------------------------------------------------|
| `uniswapV2Router_`      | Address of Uniswap V2 router for swapping USDC => underlying.  |
| `vault_`                | Address of the target vault (must support ERC4626 or ERC7540). |
| `usdc_`                 | USDC token address used for rewards.                           |
| `name_`                 | Name of aToken.                                                |
| `symbol_`               | Symbol of aToken.                                              |
| `operator_`             | Controller allowed to fulfill ERC7540 requests.                |

## Deployment & Testing  
The contract can be deployed standardly via its contract factory and hardhat:  

```js
const AutoCompounder = await ethers.getContractFactory('AutoCompounder');
const autoCompounder = await AutoCompounder.deploy(*deploymentParams*);
await autoCompounder.waitForDeployment();
```

Or via script and the command:

```bash
yarn hardhat run examples/autocompounder/deploy-autocompounder.ts —-network testnet
```

The contract can be tested by the following command:

```bash
yarn hardhat test test/erc4626/autoCompounder.test.ts
```

## Roles & Permissions
OWNER (Ownable)
* The deployer or any address you transfer ownership to;
* Transfer Ownership:

```js
await vault.transferOwnership(newOwnerAddress);
```

## Errors
error ZeroReward();
* Throws during claim process if there is no reward to reinvest.

## Core Functions
### Deposit & Mint
deposit(uint256 assets, address receiver) returns uint256
* Transfers underlying assets from caller to AutoCompounder contract;
* Transfers Performs requestDeposit (for ERC7540) or direct deposit on vault;
* Mints amountToMint = assets/exchangeRate() aTokens to receiver.

### Withdraw
withdraw(uint256 aTokenAmount, address receiver) returns uint256
* Calculates underlyingAmount = aTokenAmount * exchangeRate();
* Burns aTokenAmount from caller;
* Calls withdraw on vault to transfer underlyingAmount to receiver.

## Claim & Reinvest
claim()
* Fetches pending USDC reward in vault;
* Reverts with ZeroReward() if reward == 0;
* Claims all USDC reward and swaps for underlying;
* Reinvests swapped underlying by depositing to vault.

## Exchange Rate
### Key Functions
exchangeRate() public view returns uint256
* Returns 1 if totalSupply == 0.

### Exchange Rate Calculation
$$
\text{exchangeRate} \;=\; \frac{\text{aTokenSupply}}{\text{vault.totalSupply()}}
$$

## View Functions
asset() returns address
* Returns the underlying asset address.

usdc() returns address
* Returns the USDC token address.

uniswapV2Router() returns address
* Returns the Uniswap V2 router address.

vault() returns address
* Returns the associated vault address.

supportsInterface(bytes4 interfaceId) returns bool
* ERC165 interface support check.