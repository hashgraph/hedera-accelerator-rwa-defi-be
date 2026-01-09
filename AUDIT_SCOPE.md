# Hedera RWA-DeFi Accelerator - Audit Scope Document

## Overview

This document outlines the full scope for the security audit of the Hedera RWA-DeFi Accelerator smart contract system. The codebase implements tokenization of real-world assets (RWA) with DeFi functionality on Hedera EVM.

---

## Final Commit

| Field | Value |
|-------|-------|
| **Commit Hash** | `db3e226a7fbf0e2c9b1bdc67acaeb00a26e2430a` |
| **Date** | 2025-10-07 |
| **Branch** | `main` |
| **Repository** | hedera-accelerator-rwa-defi-be |

---

## Scope Summary

| Metric | Value |
|--------|-------|
| Total Contracts in Scope | 231 Solidity files |
| Total Lines of Code | ~37,676 |
| Solidity Version | 0.8.24 |
| Framework | Hardhat + Foundry |
| Target Network | Hedera EVM (Chain IDs: 295, 296, 297) |

---

## Contracts in Scope

### 1. Buildings Module (Core RWA Tokenization)
**Path:** `contracts/buildings/`

| Contract | Description |
|----------|-------------|
| `Building.sol` | Main building/property representation |
| `BuildingBase.sol` | Base implementation for buildings |
| `BuildingFactory.sol` | Factory for deploying building contracts |
| `BuildingFactoryStorage.sol` | Storage layout for factory |
| `BuildingIdentityFactory.sol` | Identity factory for buildings |
| `beacon/BuildingBeacon.sol` | Beacon proxy pattern |
| `extensions/BuildingAudit.sol` | Audit extension |
| `governance/BuildingGovernance.sol` | Governance implementation |
| `governance/BuildingGovernanceStorage.sol` | Governance storage |
| `library/*.sol` | Shared libraries (6 files) |

### 2. ERC3643 (T-REX Security Tokens)
**Path:** `contracts/erc3643/`

| Module | Files | Description |
|--------|-------|-------------|
| `token/` | Token.sol, TokenVotes.sol | Core security token |
| `compliance/modular/` | ModularCompliance.sol + 16 modules | Modular compliance system |
| `compliance/legacy/` | BasicCompliance.sol, DefaultCompliance.sol | Legacy compliance |
| `registry/` | 4 registry contracts | Identity, claim, issuer registries |
| `factory/` | TREXFactory.sol, TREXGateway.sol | Factory patterns |
| `proxy/` | 6 proxy contracts | Proxy implementations |
| `roles/` | AgentRole.sol, Roles.sol | Role management |
| `DVA/`, `DVD/` | Transfer managers | Delivery vs. payment |

### 3. OnchainID (Identity System)
**Path:** `contracts/onchainid/`

| Contract | Description |
|----------|-------------|
| `Identity.sol` | Core identity contract (599 LOC) |
| `ClaimIssuer.sol` | Claim issuer implementation |
| `factory/IdFactory.sol` | Identity factory |
| `gateway/Gateway.sol` | Gateway for identity operations |
| `proxy/*.sol` | Proxy implementations |
| `verifiers/*.sol` | Claim verifiers |

### 4. VaultV2 (Advanced Reward Vaults)
**Path:** `contracts/vaultV2/`

| Contract | LOC | Description |
|----------|-----|-------------|
| `RewardsVault4626.sol` | 507 | Main ERC4626 vault with rewards |
| `RewardsVaultAutoCompounder.sol` | 634 | Auto-compounding vault |
| `factory/RewardsVault4626Factory.sol` | - | Factory for reward vaults |
| `factory/RewardsVaultAutoCompounderFactory.sol` | - | Auto-compounder factory |

### 5. ERC4626 (Basic Vaults)
**Path:** `contracts/erc4626/`

| Contract | Description |
|----------|-------------|
| `BasicVault.sol` | Basic ERC4626 vault |
| `BasicVaultStorage.sol` | Storage layout |
| `VaultToken.sol` | Vault token implementation |
| `factory/VaultFactory.sol` | Vault factory |

### 6. ERC7540 (Async Vaults)
**Path:** `contracts/erc7540/`

| Contract | Description |
|----------|-------------|
| `AsyncVault.sol` | Asynchronous vault operations |
| `AsyncVaultStorage.sol` | Storage layout |
| `ERC7540.sol` | ERC7540 implementation |
| `factory/AsyncVaultFactory.sol` | Factory |

### 7. Slice (Portfolio Management)
**Path:** `contracts/slice/`

| Contract | LOC | Description |
|----------|-----|-------------|
| `Slice.sol` | 693 | Portfolio management |
| `SliceV2.sol` | 465 | V2 implementation |
| `factory/SliceFactory.sol` | - | Slice factory |

### 8. Treasury
**Path:** `contracts/treasury/`

| Contract | Description |
|----------|-------------|
| `Treasury.sol` | Main treasury management |
| `TreasuryStorage.sol` | Storage layout |
| `beacon/TreasuryBeacon.sol` | Beacon proxy |

### 9. AutoCompounder
**Path:** `contracts/autocompounder/`

| Contract | Description |
|----------|-------------|
| `AutoCompounder.sol` | Yield optimization |
| `factory/AutoCompounderFactory.sol` | Factory |

### 10. Upkeeper (Automation)
**Path:** `contracts/upkeeper/`

| Contract | Description |
|----------|-------------|
| `UpKeeper.sol` | Task automation |

### 11. Uniswap V2 Integration
**Path:** `contracts/uniswap/`

| Module | Description |
|--------|-------------|
| `v2-core/UniswapV2Pair.sol` | AMM pair contract |
| `v2-core/UniswapV2Factory.sol` | Pair factory |
| `v2-periphery/UniswapV2Router02.sol` | Router |
| `weth/WETH9.sol` | Wrapped ETH |

### 12. Additional Contracts
**Various paths:**

| Contract | Path | Description |
|----------|------|-------------|
| `AuditRegistry.sol` | `contracts/audit/` | Audit tracking |
| `OneSidedExchange.sol` | `contracts/exchange/` | Token exchange |
| `ERC721Metadata.sol` | `contracts/erc721/` | NFT metadata |
| `FeeConfiguration.sol` | `contracts/common/` | Fee settings |
| `FixedPointMathLib.sol` | `contracts/math/` | Math library |
| `USDC.sol` | `contracts/usdc/` | USDC mock/wrapper |

---

## Out of Scope

The following are **excluded** from the audit scope:

- `contracts/mock/` - Testing mocks only
- `contracts/erc3643/_testContracts/` - Test utilities
- `contracts/onchainid/_testContracts/` - Test utilities
- `contracts/buildings/governance/mock/` - Governance mocks
- `node_modules/` - External dependencies
- Test files (`test/**/*`)
- Deployment scripts (`scripts/**/*`)

---

## External Dependencies

| Dependency | Version | Usage |
|------------|---------|-------|
| OpenZeppelin Contracts | 5.0.2 | ERC standards, access control, upgrades |
| OpenZeppelin Upgradeable | 5.0.2 | Upgradeable contract patterns |
| Chainlink Contracts | ^1.3.0 | Price feeds/oracles |
| Safe Contracts | ^1.4.1-2 | MultiSig wallet integration |

---

## Key Audit Focus Areas

### Critical Priority
1. **Access Control** - Role-based permissions across all modules
2. **Vault Mechanisms** - Reward distribution, lock periods, share calculations
3. **ERC3643 Compliance** - Security token transfer restrictions
4. **Proxy Patterns** - Beacon proxies, upgrade safety

### High Priority
5. **Governance** - On-chain governance via Safe multisig
6. **Treasury Operations** - Fund flows, distribution logic
7. **Portfolio Rebalancing** - Slice contract oracle dependencies
8. **Identity Verification** - OnchainID claim verification

### Medium Priority
9. **Uniswap Integration** - Router and swap mechanics
10. **Math & Rounding** - Fixed-point calculations, precision loss
11. **Factory Patterns** - Deployment safety, initialization
12. **Auto-compounding** - Yield optimization logic

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     HEDERA RWA-DEFI SYSTEM                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   BUILDINGS  │    │   ERC3643    │    │  ONCHAINID   │      │
│  │  (RWA Core)  │◄──►│ (Compliance) │◄──►│  (Identity)  │      │
│  └──────┬───────┘    └──────────────┘    └──────────────┘      │
│         │                                                       │
│         ▼                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │  GOVERNANCE  │    │   TREASURY   │    │    SLICE     │      │
│  │    (Safe)    │◄──►│   (Funds)    │◄──►│ (Portfolio)  │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │   VAULTV2    │    │   ERC4626    │    │   ERC7540    │      │
│  │  (Rewards)   │◄──►│   (Basic)    │◄──►│   (Async)    │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐      │
│  │ AUTOCOMPOUNDER│   │   UNISWAP    │    │   UPKEEPER   │      │
│  │   (Yield)    │◄──►│   (DEX)      │    │ (Automation) │      │
│  └──────────────┘    └──────────────┘    └──────────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Supporting Documentation

| Document | Location | Description |
|----------|----------|-------------|
| Main README | `/README.md` | Project overview |
| Docs Index | `/docs/README.md` | Documentation hub |
| Audit Docs | `/docs/audit/README.md` | Audit registry |
| Buildings Docs | `/docs/buildings/README.md` | Building tokenization |
| Governance Docs | `/docs/governance/README.md` | Governance system |
| Vault Docs | `/docs/vault/README.md` | ERC4626 vaults |
| Slice Docs | `/docs/slice/README.md` | Portfolio management |
| Treasury Docs | `/docs/treasury/README.md` | Treasury management |
| AutoCompounder Docs | `/docs/autocompounder/README.md` | Yield optimization |
| Exchange Docs | `/docs/exchange/README.md` | Exchange mechanism |
| Upkeeper Docs | `/docs/upkeeper/README.md` | Task automation |
| Scripts Docs | `/scripts/README.md` | Deployment guide |

---

## Test Coverage

| Module | Test Files | Location |
|--------|------------|----------|
| ERC3643 | 33 | `test/erc3643/` |
| VaultV2 | 8 | `test/vaultV2/` |
| Slice | 5 | `test/slice/` |
| ERC4626 | 5 | `test/erc4626/` |
| Buildings | 4 | `test/buildings/` |
| Others | 9 | Various |

**Total: 64 test files**

---

## Network Configuration

| Network | Chain ID | Explorer |
|---------|----------|----------|
| Hedera Mainnet | 295 | HashScan Mainnet |
| Hedera Testnet | 296 | HashScan Testnet |
| Hedera Previewnet | 297 | HashScan Previewnet |

---

## Compilation Settings

```javascript
{
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 100
      }
    }
  }
}
```

---

## Contact & Repository

- **Repository**: hedera-accelerator-rwa-defi-be
- **Branch**: main
- **Final Commit**: `db3e226a7fbf0e2c9b1bdc67acaeb00a26e2430a`

---

*Document generated: 2025-12-16*
