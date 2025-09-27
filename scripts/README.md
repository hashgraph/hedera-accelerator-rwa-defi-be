# Scripts Directory

This directory contains all the utility scripts for the Hedera RWA DeFi Accelerator project.

## 🎮 Interactive Script Runner

The easiest way to run scripts is using the interactive runner:

### Quick Start

```bash
# Full interactive runner with search and details
yarn nteractive
```

### Features

-   **📋 Organized by Category**: Scripts are grouped by functionality
-   **🔍 Easy Selection**: Just enter the number of the script you want to run
-   **🚀 Auto-execution**: Scripts run with the correct network configuration
-   **🔄 Multiple Runs**: Run multiple scripts in sequence

## 📁 Script Categories

### Building

-   `add-liquidity` - Add liquidity for building token/USDC pairs
-   `deploy-building` - Deploy a new building with all components
-   `get-addresses` - Get all deployed contract addresses
-   `mint-usdc` - Mint USDC tokens
-   `prompt-address` - Interactive address prompt utility
-   `prompt-building` - Interactive building selection utility

### Building AutoCompounder

-   `check-autocompounder` - Check AutoCompounder status and configuration
-   `deposit-autocompounder` - Deposit assets into AutoCompounder
-   `get-user-rewards` - Calculate user rewards from AutoCompounder
-   `run-autocompounder` - Manually trigger auto-compounding

### Building Identity

-   `create-identity` - Create new on-chain identity
-   `register-identity` - Register identity with claim issuer

### Building Token

-   `mint-building-token` - Mint ERC3643 building tokens
-   `permit` - Create and execute token permits
-   `transfer-token` - Transfer building tokens

### Building Treasury

-   `deposit-treasury` - Deposit USDC into building treasury

### Root

-   `deploy-uniswap` - Deploy Uniswap V2 contracts
-   `deploy-usdc` - Deploy USDC contract
-   `deploy` - Main deployment script
-   `flatten` - Flatten contract source code
-   `initcodehash` - Calculate contract init code hash
-   `utils` - Utility functions

### Upkeeper

-   `deploy-keeper` - Deploy upkeeper contract

## 🛠️ Manual Script Execution

If you prefer to run scripts manually:

```bash
# Run any script directly
yarn hardhat run scripts/building/mint-usdc.ts --network testnet
yarn hardhat run scripts/building-autocompounder/check-autocompounder.ts --network testnet
```

## 📝 Adding New Scripts

1. Create your script in the appropriate subdirectory
2. Use TypeScript (.ts extension)
3. The interactive runner will automatically detect it
4. Follow the existing patterns for consistency

## 🔧 Script Requirements

-   All scripts should use `ethers.getSigners()` to get the signer
-   Include proper error handling with try/catch
-   Use descriptive console.log messages
-   Follow the existing naming conventions

## 🌐 Network Configuration

Scripts are configured to run on the `testnet` network by default. To change this:

1. Modify the `--network` parameter in the runner scripts
2. Or run scripts manually with your preferred network

## 📚 Examples

### Running the Interactive Runner

```bash
yarn interactove
# Select script by number
# Follow prompts
# Run multiple scripts in sequence
```

### Running a Specific Script

```bash
yarn hardhat run scripts/building/mint-usdc.ts --network testnet
```

### Getting Help

```bash
yarn hardhat help
yarn hardhat run --help
```

## 🚨 Troubleshooting

-   **"No scripts found"**: Make sure you're in the project root directory
-   **"Script failed"**: Check your network configuration and contract addresses
-   **"Permission denied"**: Ensure you have the correct private key configured
-   **"Contract not found"**: Verify contracts are deployed and addresses are correct

## 📖 Related Documentation

-   [Main Documentation](../docs/README.md)
-   [Building Documentation](../docs/buildings/README.md)
-   [AutoCompounder Documentation](../docs/autocompounder/README.md)
-   [Treasury Documentation](../docs/treasury/README.md)
