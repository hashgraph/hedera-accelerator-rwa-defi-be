# Hedera RWA DeFi Accelerator Documentation

Welcome to the comprehensive documentation for the Hedera RWA (Real World Assets) DeFi Accelerator project. This documentation provides detailed guides for developers to understand, deploy, and interact with the various smart contract components.

## 📚 Table of Contents

-   [Overview](#overview)
-   [Architecture](#architecture)
-   [Components](#components)
-   [Getting Started](#getting-started)
-   [Deployment Guide](#deployment-guide)
-   [Testing](#testing)
-   [Data Folder](#data-folder)

## 🎯 Overview

The Hedera RWA DeFi Accelerator is a comprehensive suite of smart contracts designed to tokenize real-world assets (buildings) and provide DeFi functionality on the Hedera EVM. The project enables:

-   **Tokenized Real Estate**: Buildings represented as ERC3643-compliant security tokens
-   **Yield Generation**: Automated compounding and reward distribution
-   **Governance**: On-chain voting and decision making
-   **Compliance**: Built-in KYC/AML and regulatory compliance
-   **Portfolio Management**: Automated rebalancing and asset allocation

## 🏗️ Architecture

The project follows a modular architecture with the following key principles:

-   **Factory Pattern**: All major components use factory contracts for deployment
-   **Upgradeable Contracts**: Beacon proxy pattern for long-term maintainability
-   **Role-Based Access Control**: Granular permissions for different actors
-   **Composability**: Components can be combined to create complex DeFi products

## 🧩 Components

### Core Components

| Component                                     | Description                                  | Documentation                              |
| --------------------------------------------- | -------------------------------------------- | ------------------------------------------ |
| [Audit Registry](./audit/README.md)           | Manages audit records for building addresses | [📖 Read More](./audit/README.md)          |
| [Auto Compounder](./autocompounder/README.md) | Automatically reinvests vault rewards        | [📖 Read More](./autocompounder/README.md) |
| [Buildings](./buildings/README.md)            | Complete building tokenization suite         | [📖 Read More](./buildings/README.md)      |
| [ERC721 Metadata](./erc721/README.md)         | Enhanced NFT with on-chain metadata          | [📖 Read More](./erc721/README.md)         |
| [Exchange](./exchange/README.md)              | One-sided exchange for token trading         | [📖 Read More](./exchange/README.md)       |
| [Slice](./slice/README.md)                    | Portfolio management and rebalancing         | [📖 Read More](./slice/README.md)          |
| [Treasury](./treasury/README.md)              | Fund management and distribution             | [📖 Read More](./treasury/README.md)       |
| [Upkeeper](./upkeeper/README.md)              | Automated task execution system              | [📖 Read More](./upkeeper/README.md)       |
| [Vault V2](./vault/README.md)                 | ERC4626-compliant yield vault                | [📖 Read More](./vault/README.md)          |

### Supporting Components

-   **ERC3643 (T-REX)**: Security token standard with compliance
-   **ERC4626**: Standardized vault interface
-   **ERC7540**: Asynchronous vault operations
-   **OnchainID**: Identity verification system
-   **Uniswap V2**: DEX integration for swaps

## 🚀 Getting Started

### Prerequisites

-   Node.js 18+
-   Yarn package manager
-   Hardhat development environment
-   Hedera testnet/mainnet access

### Installation

```bash
# Clone the repository
git clone https://github.com/hashgraph/hedera-accelerator-defi-eip.git
cd hedera-accelerator-defi-eip

# Install dependencies
yarn install

# Compile contracts
yarn compile
```

### Environment Setup

Create a `.env` file with the following variables:

```env
RPC_URL=https://testnet.hashio.io/api
PRIVATE_KEY=your_private_key_here
COINMARKETCAP_API_KEY=your_api_key_here
```

## 🚀 Deployment Guide

### Quick Deployment

```bash
# Deploy all contracts to testnet
yarn deploy

# Deploy specific components
yarn hardhat run scripts/deploy-building.ts --network testnet
yarn hardhat run scripts/deploy-autocompounder-factory.ts --network testnet
```

### Step-by-Step Deployment

1. **Deploy Core Infrastructure**

    ```bash
    yarn hardhat run scripts/deploy.ts --network testnet
    ```

2. **Deploy Building Suite**

    ```bash
    yarn hardhat run scripts/deploy-building.ts --network testnet
    ```

3. **Deploy Vault Factory**

    ```bash
    yarn hardhat run scripts/deploy-rewards-vault4626-factory.ts --network testnet
    ```

4. **Deploy Auto Compounder**
    ```bash
    yarn hardhat run scripts/deploy-autocompounder-factory.ts --network testnet
    ```

## 🧪 Testing

### Run All Tests

```bash
# Run all test suites
yarn test

# Run specific test file
yarn hardhat test test/buildings/building.test.ts

# Run with gas reporting
yarn test --gas-report
```

### Test Coverage

```bash
# Generate coverage report
yarn hardhat coverage
```

### Test Structure

-   **Unit Tests**: Individual contract functionality
-   **Integration Tests**: Cross-contract interactions
-   **Fork Tests**: Mainnet state simulation

## 📁 Data Folder

The `data/` folder contains important deployment and configuration information:

### Structure

```
data/
├── abis/           # Contract ABIs for all deployed contracts
├── deployments/    # Deployment addresses by network
└── chain-296.json  # Hedera testnet deployment addresses
```

### Usage

-   **ABIs**: Used for frontend integration and contract interactions
-   **Deployments**: Contains all deployed contract addresses for each network
-   **Chain Configs**: Network-specific deployment information

### Accessing Deployment Data

```typescript
import deployments from "../data/deployments/chain-296.json";

// Get building factory address
const buildingFactory = deployments.factories.BuildingFactory;

// Get implementation addresses
const tokenImpl = deployments.implementations.Token;
```

## 🔗 Network Information

| Network           | Chain ID | RPC URL                          | Explorer                       |
| ----------------- | -------- | -------------------------------- | ------------------------------ |
| Hedera Testnet    | 296      | https://testnet.hashio.io/api    | https://hashscan.io/testnet    |
| Hedera Mainnet    | 295      | https://mainnet.hashio.io/api    | https://hashscan.io/mainnet    |
| Hedera Previewnet | 297      | https://previewnet.hashio.io/api | https://hashscan.io/previewnet |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## 📄 License

This project is licensed under the Apache License 2.0 - see the [LICENSE](../LICENSE) file for details.

## 🆘 Support

-   **Documentation Issues**: Open an issue in this repository
-   **Technical Support**: Check the [support guide](https://github.com/hashgraph/.github/blob/main/SUPPORT.md)
-   **Community**: Join the Hedera Discord

---

For detailed information about each component, please refer to the individual documentation files linked above.
