# ERC3643 (T-REX)  
ERC-3643 (also known as T-REX) is an open-source Ethereum token standard that enables the issuance, management, and transfer of permissioned, compliance-driven tokens by embedding on-chain identity verification and modular compliance controls

## Overview  
ERC-3643 (T-REX) defines a modular, permissioned token architecture built on top of ERC-20 that embeds regulatory compliance directly into the smart contract. It adds:

- On-chain identity integration: Every token holder must be registered through a configurable identity registry, enabling issuers to enforce KYC/AML checks before any transfer.

- Pluggable compliance modules: Transfer managers, freeze managers, and whitelist/blacklist controllers can be mixed and matched to support caps, vesting schedules, token freezes, or jurisdiction-based restrictions without altering core token logic.

- Issuer control and governance: Issuers retain the ability to mint, burn, freeze, or rescue tokens in accordance with predefined rules, ensuring that security tokens and other regulated assets remain fully under issuer oversight.

Designed for security tokens, stablecoins, and other regulated digital assets, ERC-3643 streamlines compliance by packing rules into the token layer, helping developers launch regulated instruments on-chain with reduced operational overhead.

## ERC-3643 (T-REX) Deployment Guide
You can find the deployment code at [scripts/deploy.ts](https://github.com/hashgraph/hedera-accelerator-defi-eip/blob/main/scripts/deploy.ts)

Here is a step-by-step explanation of the deployment code

### 1. Grab the Deployer Account

>Fetch the first signer from Hardhat’s Ethers plugin. All deployments will be sent from this address.

```ts
const [deployer] = await ethers.getSigners();
```

### 2. Deploy Core ERC-3643 Implementations

>These contracts form the backbone of the T-REX standard:

```ts
// KYC/AML claim registry
const claimTopicsRegistryImplementation = await ethers.deployContract('ClaimTopicsRegistry', deployer);

// Issuers who can issue claims
const trustedIssuersRegistryImplementation = await ethers.deployContract('TrustedIssuersRegistry', deployer);

// Identity registry storage & API
const identityRegistryStorageImplementation = await ethers.deployContract('IdentityRegistryStorage', deployer);
const identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', deployer);

// Core compliance logic
const modularComplianceImplementation = await ethers.deployContract('ModularCompliance', deployer);

// Upgradable ERC-20 base for T-REX tokens
const tokenImplementation = await ethers.deployContract('Token', deployer);
```

### 3. Deploy Identity Proxy Components

>Each user gets a minimal-proxy “Identity” contract:

```ts
// 1. Identity logic contract
const identityImplementation = await ethers.deployContract('Identity', [deployer.address, true], deployer);

// 2. Authority to manage upgrades
const identityImplementationAuthority = await ethers.deployContract(
    'ImplementationAuthority',
    [await identityImplementation.getAddress()],
    deployer
);

// 3. Factory for spawning Identity proxies
const identityFactory = await ethers.deployContract(
    'IdFactory',
    [await identityImplementationAuthority.getAddress()],
    deployer
);

// 4. Read-only gateway for bulk identity lookup
const identityGateway = await ethers.deployContract(
    'IdentityGateway',
    [await identityFactory.getAddress(), []],
    deployer
);
```

### 4. Register the T-REX Version

>Deploy the TREXImplementationAuthority

```ts
const trexImplementationAuthority = await ethers.deployContract(
    'TREXImplementationAuthority',
    [true, ethers.ZeroAddress, ethers.ZeroAddress],
    deployer
  );
```
>Bundle your implementations

```ts 
const versionStruct = { major: 4, minor: 0, patch: 0 };
const contractsStruct = {
  tokenImplementation:   await tokenImplementation.getAddress(),
  ctrImplementation:     await claimTopicsRegistryImplementation.getAddress(),
  irImplementation:      await identityRegistryImplementation.getAddress(),
  irsImplementation:     await identityRegistryStorageImplementation.getAddress(),
  tirImplementation:     await trustedIssuersRegistryImplementation.getAddress(),
  mcImplementation:      await modularComplianceImplementation.getAddress(),
};
```
>Register and activate the version

```ts
const authority = await ethers.getContractAt(
  "TREXImplementationAuthority",
  await trexImplementationAuthority.getAddress()
);
await authority.addAndUseTREXVersion(
  versionStruct,
  contractsStruct
);

```

### 5. Deploy TREXFactory & TREXGateway

>These let you launch new T-REX tokens with custom compliance rules:

```ts
// Deploy the Factory
const TREXFactory = await ethers.getContractFactory('TREXFactory');
const trexFactory = await TREXFactory.deploy(
  await trexImplementationAuthority.getAddress(),
  await identityFactory.getAddress()
);
await trexFactory.waitForDeployment();

// Tell the IdFactory about the TREXFactory
await identityFactory.addTokenFactory(await trexFactory.getAddress());

// Deploy the Gateway for token creation
const TREXGateway = await ethers.getContractFactory('TREXGateway');
const trexGateway = await TREXGateway.deploy(
  await trexFactory.getAddress(),
  true
);
await trexGateway.waitForDeployment();

```

### 6. Transfer Ownership

>Lock down control so only the gateways can manage factories:

```ts
await trexFactory
  .connect(deployer)
  .transferOwnership(await trexGateway.getAddress());

await identityFactory
  .connect(deployer)
  .transferOwnership(await identityGateway.getAddress());
```


## Deploy Compliance Modules

>Each “rule” or “transfer manager” module is deployed separately, making it easy to plug and play as needed. The following are some modules used for the Buildings R US suite.

```ts
const requiresNFTModule = await ethers.deployContract('RequiresNFTModule', deployer);
const countryAllowModule = await ethers.deployContract('CountryAllowModule', deployer);
const maxOwnershipByCountryModule = await ethers.deployContract('MaxOwnershipByCountryModule', deployer);
const onlyUsaModule = await ethers.deployContract('OnlyUsaModule', deployer);
```


## Deploy T-REX suite

After deploying the core contracts, you can launch a new T-REX suite by calling the deployTREXSuite function on the TREXGateway contract. This call takes two parameters:

1. Token configuration — supplied as an [`ITREXFactory.TokenDetails`](https://github.com/hashgraph/hedera-accelerator-defi-eip/blob/main/contracts/erc3643/factory/ITREXFactory.sol) struct
2. Claim configuration — supplied as an [`ITREXFactory.ClaimDetails`](https://github.com/hashgraph/hedera-accelerator-defi-eip/blob/main/contracts/erc3643/factory/ITREXFactory.sol) struct

You can check the code at this external library at [src/contracts/buildings/library/BuildingToken.sol]([https://github.com/CamposBruno/hedera-accelerator-defi-eip/new/main/src/contracts/buildings/library/BuildingToken.sol](https://github.com/hashgraph/hedera-accelerator-defi-eip/blob/main/contracts/buildings/library/BuildingToken.sol))

Execute the deployTREXSuite passing the token details and the claim details
```ts
ITREXGateway(trexGateway).deployTREXSuite(
    buildTokenDetails(owner, name, symbol, decimals), 
    buildTokenClaimDetails()
);
```

Token details are created, in this case, with minimal deployment configuration.

- *irs* stands for Identity Registry Storage; passing the zero address will deploy a new storage.
- *onchainid* is the identity for the token; passing the zero address will deploy a new identity.
- *tokenAgents* the addresses responsible for managing token-related operations
- *complianceModules* are the module compliances that you want to enforce on token transfer.
- *complianceSettings* are the initial configurations for each compliance module.

```ts 
function buildTokenDetails(address owner, string memory name, string memory symbol, uint8 decimals) internal pure returns (ITREXFactory.TokenDetails memory)  {
    address irs = address(0);
    address onchainid = address(0);
    address[] memory irsAgents = new address[](0);
    address[] memory tokenAgents = new address[](1);
    address[] memory complianceModules = new address[](0);
    bytes[] memory complianceSettings = new bytes[](0);

    tokenAgents[0] = msg.sender; // set sender as token agent
    
    return ITREXFactory.TokenDetails(
        owner,
        name,
        symbol,
        decimals,
        irs,
        onchainid, 
        irsAgents, 
        tokenAgents, 
        complianceModules, 
        complianceSettings 
    );
}
```

Claim details are created, in this case, with minimal deployment configuration

```ts
function buildTokenClaimDetails () internal pure returns (ITREXFactory.ClaimDetails memory) {
    uint256[] memory claimTopics = new uint256[](0);
    address[] memory issuers = new address[](0);
    uint256[][] memory issuerClaims = new uint256[][](0);
    
    return ITREXFactory.ClaimDetails (
        claimTopics,
        issuers,
        issuerClaims
    );
}
```

#### Getting the address of the deployed token.

After deploying the token, you can derive its address by constructing the salt string as the concatenation of the deployer’s address and the token’s name, like so:
```ts
string memory salt  = string(abi.encodePacked(Strings.toHexString(deployer), tokenName));
address factory = ITREXGateway(trexGateway).getFactory();

token = ITREXFactory(factory).getToken(salt);
```
