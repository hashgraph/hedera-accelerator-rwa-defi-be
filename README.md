# Hedera RWA DeFi Accelerator

> **⚠️ WARNING**: No audits have been done on this codebase. No warranties. This code is 'in progress' and is intended for demonstration and/or start of your project. You need to do your own QA & Audits before using this.

A comprehensive suite of smart contracts for tokenizing real-world assets (RWA) and providing DeFi functionality on the Hedera EVM. This project enables the creation of compliant, governable, and yield-generating tokenized real estate assets.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/hashgraph/hedera-accelerator-defi-eip.git
cd hedera-accelerator-defi-eip

# Install dependencies
yarn install

# Compile contracts
yarn compile

# Run tests
yarn test

# Deploy to testnet
yarn deploy
```

## 📚 Documentation

Comprehensive documentation is available in the [`docs/`](./docs/) folder:

-   **[📖 Complete Documentation](./docs/README.md)** - Start here for an overview
-   **[🏗️ Buildings Module](./docs/buildings/README.md)** - Tokenized real estate assets
-   **[🔄 Auto Compounder](./docs/autocompounder/README.md)** - Automated yield optimization
-   **[📊 Vault](./docs/vault/README.md)** - ERC4626-compliant yield vaults
-   **[🎯 Slice](./docs/slice/README.md)** - Portfolio management and rebalancing
-   **[🏛️ Treasury](./docs/treasury/README.md)** - Fund management and distribution
-   **[🔍 Audit Registry](./docs/audit/README.md)** - Building audit management
-   **[🎨 ERC721 Metadata](./docs/erc721/README.md)** - Enhanced NFT with on-chain metadata
-   **[💱 Exchange](./docs/exchange/README.md)** - One-sided token exchange
-   **[⚙️ Upkeeper](./docs/upkeeper/README.md)** - Automated task execution system

## 🏗️ Architecture Overview

The Hedera RWA DeFi Accelerator provides a complete ecosystem for tokenizing real-world assets:

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Buildings     │    │   Auto          │    │   Vault         │
│   (ERC3643)     │◄──►│   Compounder    │◄──►│   (ERC4626)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Treasury      │    │   Slice         │    │   Exchange      │
│   Management    │◄──►│   Portfolio     │◄──►│   Trading       │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Audit         │    │   ERC721        │    │   Upkeeper      │
│   Registry      │    │   Metadata      │    │   Automation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🧩 Core Components

### 🏢 Buildings Module

Complete tokenization suite for real estate assets:

-   **ERC3643 Security Tokens** with built-in compliance
-   **ERC4626 Vaults** for asset management and yield generation
-   **Governance System** for on-chain decision making
-   **Treasury Management** for fund flows
-   **Identity Integration** using OnchainID for KYC/AML

### 🔄 Auto Compounder

Automated yield optimization:

-   **Dual Vault Support** (ERC4626 and ERC7540)
-   **Automatic Compounding** of rewards
-   **Exchange Rate Tracking** for performance monitoring
-   **Uniswap Integration** for asset swaps

### 📊 Vault V2 (RewardsVault4626)

ERC4626-compliant yield vault:

-   **Standard Compliance** with ERC4626 interface
-   **Multi-token Rewards** system
-   **Lock Periods** for withdrawal restrictions
-   **User Management** with individual tracking

### 🎯 Slice

Portfolio management and rebalancing:

-   **Automated Rebalancing** based on price oracles
-   **Multi-asset Portfolios** with target allocations
-   **Yield Optimization** across multiple buildings
-   **Dynamic Composition** based on metadata

## 🚀 Key Features

-   **🔒 Compliance Ready**: Built-in KYC/AML and regulatory compliance
-   **🏛️ Governance**: On-chain voting and decision making
-   **💰 Yield Generation**: Automated yield capture and compounding
-   **🔄 Automation**: Automated rebalancing and task execution
-   **📊 Portfolio Management**: Multi-asset portfolio management
-   **🔍 Audit Trail**: Complete audit and compliance tracking
-   **🎨 Metadata**: Rich on-chain metadata for assets
-   **💱 Trading**: Controlled token exchange mechanisms

## 🛠️ Technology Stack

-   **Solidity 0.8.24**: Smart contract development
-   **Hardhat**: Development framework
-   **OpenZeppelin**: Security and standards
-   **ERC3643 (T-REX)**: Security token standard
-   **ERC4626**: Vault standard
-   **ERC7540**: Asynchronous vault operations
-   **Chainlink**: Price oracles
-   **Uniswap V2**: DEX integration

## 🌐 Network Support

| Network           | Chain ID | Status    | Explorer                                              |
| ----------------- | -------- | --------- | ----------------------------------------------------- |
| Hedera Testnet    | 296      | ✅ Active | [HashScan Testnet](https://hashscan.io/testnet)       |
| Hedera Mainnet    | 295      | ✅ Active | [HashScan Mainnet](https://hashscan.io/mainnet)       |
| Hedera Previewnet | 297      | ✅ Active | [HashScan Previewnet](https://hashscan.io/previewnet) |

## 📁 Project Structure

```
hedera-accelerator-defi-eip/
├── contracts/           # Smart contracts
│   ├── audit/          # Audit registry
│   ├── autocompounder/ # Auto compounding
│   ├── buildings/      # Building tokenization
│   ├── erc721/         # Enhanced NFTs
│   ├── exchange/       # Token exchange
│   ├── slice/          # Portfolio management
│   ├── treasury/       # Fund management
│   ├── upkeeper/       # Task automation
│   └── vaultV2/        # ERC4626 vaults
├── docs/               # Documentation
├── examples/           # Usage examples
├── scripts/            # Deployment scripts
├── test/               # Test suites
└── data/               # Deployment data
    ├── abis/           # Contract ABIs
    └── deployments/    # Deployment addresses
```

## 🧪 Testing

```bash
# Run all tests
yarn test

# Run specific test suite
yarn hardhat test test/buildings/

# Run with gas reporting
yarn test --gas-report

# Generate coverage report
yarn hardhat coverage
```

## 🚀 Deployment

### Environment Setup

Create a `.env` file:

```env
RPC_URL=https://testnet.hashio.io/api
PRIVATE_KEY=your_private_key_here
COINMARKETCAP_API_KEY=your_api_key_here
```

### Deploy to Testnet

```bash
# Deploy all contracts
yarn deploy

# Deploy specific components
yarn hardhat run scripts/deploy-building.ts --network testnet
yarn hardhat run scripts/deploy-autocompounder-factory.ts --network testnet
```

### Deploy to Mainnet

```bash
# Deploy to mainnet (use with caution)
yarn hardhat run scripts/deploy.ts --network mainnet
```

## 📊 Data Folder

The `data/` folder contains important deployment and configuration information:

-   **`abis/`**: Contract ABIs for all deployed contracts
-   **`deployments/`**: Deployment addresses by network
-   **`chain-296.json`**: Hedera testnet deployment addresses

### Accessing Deployment Data

```typescript
import deployments from "./data/deployments/chain-296.json";

// Get building factory address
const buildingFactory = deployments.factories.BuildingFactory;

// Get implementation addresses
const tokenImpl = deployments.implementations.Token;
```

## 🔗 Integration Examples

### Deploy a Building

```typescript
import { ethers } from "hardhat";

async function deployBuilding() {
    const buildingFactory = await ethers.getContractAt("BuildingFactory", factoryAddress);

    const buildingAddress = await buildingFactory.deployBuilding(buildingConfig, governanceConfig, treasuryConfig);

    console.log("Building deployed to:", buildingAddress);
}
```

### Create a Slice Portfolio

```typescript
async function createSlice() {
    const slice = await ethers.deployContract("Slice", [
        uniswapRouterAddress,
        usdcAddress,
        "Real Estate Slice",
        "RES",
        "https://example.com/metadata",
    ]);

    // Add allocations to portfolio
    await slice.addAllocation(buildingAAddress, oracleAAddress, 3000);
    await slice.addAllocation(buildingBAddress, oracleBAddress, 3000);
    await slice.addAllocation(buildingCAddress, oracleCAddress, 4000);
}
```

## 🤝 Contributing

We welcome contributions! Please see our [contributing guide](https://github.com/hashgraph/.github/blob/main/CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Code Standards

-   Follow Solidity style guide
-   Add comprehensive tests
-   Update documentation
-   Ensure gas optimization

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

-   **Documentation**: Check the [docs/](./docs/) folder
-   **Issues**: Open an issue in this repository
-   **Technical Support**: See our [support guide](https://github.com/hashgraph/.github/blob/main/SUPPORT.md)
-   **Community**: Join the Hedera Discord

## ⚠️ Disclaimer

This software is provided "as is" without warranty of any kind. The code is in active development and has not been audited. Use at your own risk and ensure proper testing and auditing before production use.

---

**Ready to get started?** Check out our [comprehensive documentation](./docs/README.md) or explore the [examples](./examples/) folder for practical usage examples.
