import { ethers, upgrades } from 'hardhat';
import { writeFile } from 'fs/promises';
import { createFungibleToken } from "../scripts/utils";
import { Client, AccountId, PrivateKey } from "@hashgraph/sdk";
import TestnetDeployments from '../data/deployments/chain-296.json';

import {
  usdcAddress,
  uniswapRouterAddress,
  pythOracleAddress,
  pythUtilsAddress
} from "../constants";

// Initial function for logs and configs
async function init(): Promise<Record<string, any>> {
  console.log(" - Deploying contracts...");
  return {
    ...TestnetDeployments
  };
}

// Deploy main contracts for the ERC3643 Standart (T-REX)
async function deployERC3643(contracts: Record<string, any>): Promise<Record<string, any>> {
  console.log(' - Deploying ERC3643 contracts...');
  const [deployer] = await ethers.getSigners();

  //Deploy implementations
  const claimTopicsRegistryImplementation = await ethers.deployContract('ClaimTopicsRegistry', deployer);
  const trustedIssuersRegistryImplementation = await ethers.deployContract('TrustedIssuersRegistry', deployer);
  const identityRegistryStorageImplementation = await ethers.deployContract('IdentityRegistryStorage', deployer);
  const identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', deployer);
  const modularComplianceImplementation = await ethers.deployContract('ModularCompliance', deployer);
  const tokenImplementation = await ethers.deployContract('Token', deployer);
  const identityImplementation = await ethers.deployContract('Identity', [deployer.address, true], deployer);
  const identityImplementationAuthority = await ethers.deployContract('ImplementationAuthority', [await identityImplementation.getAddress()], deployer);
  const identityFactory = await ethers.deployContract('IdFactory', [await identityImplementationAuthority.getAddress()], deployer);
  const identityGateway = await ethers.deployContract('IdentityGateway', [await identityFactory.getAddress(), []], deployer);
  const trexImplementationAuthority = await ethers.deployContract('TREXImplementationAuthority', [true, ethers.ZeroAddress, ethers.ZeroAddress], deployer);

  // creates TREX Factory
  const versionStruct = {
    major: 4,
    minor: 0,
    patch: 0,
  };

  const contractsStruct = {
    tokenImplementation: await tokenImplementation.getAddress(),
    ctrImplementation: await claimTopicsRegistryImplementation.getAddress(),
    irImplementation: await identityRegistryImplementation.getAddress(),
    irsImplementation: await identityRegistryStorageImplementation.getAddress(),
    tirImplementation: await trustedIssuersRegistryImplementation.getAddress(),
    mcImplementation: await modularComplianceImplementation.getAddress(),
  };

  const trexImplementationAuthorityContract = await ethers.getContractAt(
    "TREXImplementationAuthority",
    await trexImplementationAuthority.getAddress()
  );

  await trexImplementationAuthorityContract.addAndUseTREXVersion(versionStruct, contractsStruct, { gasLimit: 15000000 });


  const TREXFactory = await ethers.getContractFactory('TREXFactory');
  const trexFactory = await TREXFactory.deploy(
    await trexImplementationAuthority.getAddress(),
    await identityFactory.getAddress(),
    { gasLimit: 15000000 }
  );
  await trexFactory.waitForDeployment();

  await identityFactory.addTokenFactory(await trexFactory.getAddress());

  const TREXGateway = await ethers.getContractFactory('TREXGateway');
  const trexGateway = await TREXGateway.deploy(
    await trexFactory.getAddress(),
    true,
    { gasLimit: 15000000 }
  );
  await trexGateway.waitForDeployment();

  await trexFactory.connect(deployer).transferOwnership(await trexGateway.getAddress());
  await identityFactory.connect(deployer).transferOwnership(await identityGateway.getAddress());

  return {
    ...contracts,
    implementations: {
      Token: await tokenImplementation.getAddress(),
      ClaimTopicsRegistry: await claimTopicsRegistryImplementation.getAddress(),
      TrustedIssuersRegistry: await trustedIssuersRegistryImplementation.getAddress(),
      IdentityRegistryStorage: await identityRegistryStorageImplementation.getAddress(),
      IdentityRegistry: await identityRegistryImplementation.getAddress(),
      ModularCompliance: await modularComplianceImplementation.getAddress(),
      Identity: await identityImplementation.getAddress(),
      ImplementationAuthority: await identityImplementationAuthority.getAddress(),
    },
    factories: {
      IdFactory: await identityFactory.getAddress(),
      TREXImplementationAuthority: await trexImplementationAuthority.getAddress(),
      TREXFactory: await trexFactory.getAddress(),
      TREXGateway: await trexGateway.getAddress(),
      IdentityGateway: await identityGateway.getAddress(),
    }
  }

}

async function deployComplianceModules(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();

  // Deploy compliance Modules
  const requiresNFTModule = await ethers.deployContract('RequiresNFTModule', deployer);
  const countryAllowModule = await ethers.deployContract('CountryAllowModule', deployer);
  const maxOwnershipByCountryModule = await ethers.deployContract('MaxOwnershipByCountryModule', deployer);
  const maxTenPercentOwnershipModule = await ethers.deployContract('MaxTenPercentOwnershipModule', deployer);
  const onlyUsaModule = await ethers.deployContract('OnlyUsaModule', deployer);
  const transferLimitOneHundredModule = await ethers.deployContract('TransferLimitOneHundredModule', deployer);

  return {
    ...contracts,
    compliance: {
      RequiresNFTModule: await requiresNFTModule.getAddress(),
      CountryAllowModule: await countryAllowModule.getAddress(),
      MaxOwnershipByCountryModule: await maxOwnershipByCountryModule.getAddress(),
      MaxTenPercentOwnershipModule: await maxTenPercentOwnershipModule.getAddress(),
      OnlyUsaModule: await onlyUsaModule.getAddress(),
      TransferLimitOneHundredModule: await transferLimitOneHundredModule.getAddress(),
    }
  }
}

// Deploy Vault contracts
async function deployVault(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying Vault with account:", deployer.address, "at:", network.name);

  let client = Client.forTestnet();

  const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
  const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

  client.setOperator(
    operatorAccountId,
    operatorPrKey
  );

  const stakingToken = await createFungibleToken(
    "ERC4626 on Hedera",
    "HERC4626",
    process.env.ACCOUNT_ID,
    operatorPrKey.publicKey,
    client,
    operatorPrKey
  );

  const stakingTokenAddress = "0x" + stakingToken!.toSolidityAddress();

  const rewardToken = await createFungibleToken(
    "Reward Token 1",
    "RT1",
    process.env.ACCOUNT_ID,
    operatorPrKey.publicKey,
    client,
    operatorPrKey
  );

  const feeConfig = {
    receiver: "0x091b4a7ea614a3bd536f9b62ad5641829a1b174f",
    token: "0x" + rewardToken!.toSolidityAddress(),
    minAmount: 0,
    feePercentage: 1000,
  };

  const HederaVault = await ethers.getContractFactory("HederaVault");
  const hederaVault = await HederaVault.deploy(
    stakingTokenAddress,
    "TST",
    "TST",
    feeConfig,
    deployer.address,
    deployer.address,
    { from: deployer.address, gasLimit: 3000000, value: ethers.parseUnits("16", 18) }
  );
  console.log("Hash ", hederaVault.deploymentTransaction()?.hash);
  await hederaVault.waitForDeployment();

  console.log("Vault deployed with address: ", await hederaVault.getAddress());

  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactory = await VaultFactory.deploy({ from: deployer.address });
  console.log("Hash ", vaultFactory.deploymentTransaction()?.hash);
  await vaultFactory.waitForDeployment();

  console.log("Vault Factory deployed with address: ", await vaultFactory.getAddress());

  return {
    ...contracts,
    vault: {
      Vault: hederaVault.target,
      VaultFactory: vaultFactory.target,
      StakingToken: stakingTokenAddress,
      Share: await hederaVault.share(),
      RewardToken: "0x" + rewardToken!.toSolidityAddress()
    }
  };
}

// Deploy Async Vault contracts
async function deployAsyncVault(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("Deploying Async Vault with account:", deployer.address, "at:", network.name);

  let client = Client.forTestnet();

  const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
  const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

  client.setOperator(
    operatorAccountId,
    operatorPrKey
  );

  const stakingToken = await createFungibleToken(
    "ERC7540 on Hedera",
    "HERC7540",
    process.env.ACCOUNT_ID,
    operatorPrKey.publicKey,
    client,
    operatorPrKey
  );

  const stakingTokenAddress = "0x" + stakingToken!.toSolidityAddress();

  const rewardToken = await createFungibleToken(
    "Reward Token 1",
    "RT1",
    process.env.ACCOUNT_ID,
    operatorPrKey.publicKey,
    client,
    operatorPrKey
  );

  const feeConfig = {
    receiver: "0x091b4a7ea614a3bd536f9b62ad5641829a1b174f",
    token: "0x" + rewardToken!.toSolidityAddress(),
    minAmount: 0,
    feePercentage: 1000,
  };

  const AsyncVault = await ethers.getContractFactory("AsyncVault");
  const asyncVault = await AsyncVault.deploy(
    stakingTokenAddress,
    "TST",
    "TST",
    feeConfig,
    deployer.address,
    deployer.address,
    { from: deployer.address, gasLimit: 3000000, value: ethers.parseUnits("20", 18) }
  );
  console.log("Hash ", asyncVault.deploymentTransaction()?.hash);
  await asyncVault.waitForDeployment();

  console.log("Vault deployed with address: ", await asyncVault.getAddress());

  return {
    ...contracts,
    asyncVault: {
      Vault: asyncVault.target,
      StakingToken: stakingTokenAddress,
      Share: await asyncVault.share(),
      RewardToken: "0x" + rewardToken!.toSolidityAddress()
    }
  };
}

// Deploy Token balancer
async function deployTokenBalancer(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();

  // Set Pyth Utils lib address
  const TokenBalancer = await ethers.getContractFactory("TokenBalancer", {
    libraries: {
      PythUtils: pythUtilsAddress
    }
  });

  const tokenBalancer = await TokenBalancer.deploy(
    pythOracleAddress,
    uniswapRouterAddress,
    usdcAddress
  );
  await tokenBalancer.waitForDeployment();

  return {
    ...contracts,
    balancer: {
      TokenBalancer: tokenBalancer.target
    }
  };
}

// Deploy AutoCompounder
async function deployAutoCompounder(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();

  const AutoCompounder = await ethers.getContractFactory("AutoCompounder");

  const autoCompounder = await AutoCompounder.deploy(
    uniswapRouterAddress,
    "0x0000000000000000000000000000000000423255",
    usdcAddress,
    "AToken",
    "AToken"
  );
  await autoCompounder.waitForDeployment();

  return {
    ...contracts,
    autoCompounder: {
      AutoCompounder: autoCompounder.target
    }
  };
}

// Deploy AutoCompounder
async function deployAutoCompounderFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();

  const AutoCompounderFactory = await ethers.getContractFactory("AutoCompounderFactory");
  const autoCompounderFactory = await AutoCompounderFactory.deploy();
  await autoCompounderFactory.waitForDeployment();

  return {
    ...contracts,
    autoCompounder: {
      AutoCompounderFactory: autoCompounderFactory.target
    }
  };
}

// deploy HTS Token Factory
async function deployHTSTokenFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
  const [deployer] = await ethers.getSigners();

  const htsToken = await ethers.deployContract("HTSToken", ["HTSTokenTest", "HTT", 8], {
    signer: deployer,
    value: ethers.parseEther("13"),
    gasLimit: 4800000,
  });
  const htsTokenFactory = await ethers.deployContract("HTSTokenFactory", [], { gasLimit: 4800000 });

  return {
    ...contracts,
    implementations: {
      ...contracts.implementations,
      HTSToken: await htsToken.getAddress(),
    },
    factories: {
      ...contracts.factories,
      HTSTokenFactory: await htsTokenFactory.getAddress(),
    },
  };
}


// deploy NFT metadata collection
async function createERC721Metadata(contracts: Record<string, any>): Promise<Record<string, any>> {
  const nftCollectionFactory = await ethers.getContractFactory('ERC721Metadata');
  const ERC721Metadata = await nftCollectionFactory.deploy("Buildings R Us", "BRUS",);
  await ERC721Metadata.waitForDeployment();
  const ERC721MetadataAddress = await ERC721Metadata.getAddress();


  return {
    ...contracts,
    implementations: {
      ...contracts.implementations,
      ERC721Metadata: ERC721MetadataAddress,
    }
  }
}

// deploy upgradeable BuildingFactory
async function createBuildingFactory(contracts: Record<string, any>) : Promise<Record<string, any>> {  
  const buildingFact = await ethers.getContractFactory('Building');
  const buildingBeacon = await upgrades.deployBeacon(buildingFact);
  const buildingBeaconAddress = await buildingBeacon.getAddress();

  const buildingFactoryFactory = await ethers.getContractFactory('BuildingFactory');
  const buildingFactoryBeacon = await upgrades.deployBeacon(buildingFactoryFactory);
  const buildingFactoryBeaconAddress = await buildingFactoryBeacon.getAddress();
  const identityGateway = await ethers.getContractAt('IdentityGateway', contracts.factories.IdentityGateway);
  const identityGatewayAddress = await identityGateway.getAddress();

  const uniswapRouter = await ethers.getContractAt('UniswapRouterMock', uniswapRouterAddress);
  const uniswapFactoryAddress = await uniswapRouter.factory();

  const trexGatewayAddress = contracts.factories.TREXGateway;
  const trexGateway = await ethers.getContractAt('TREXGateway', trexGatewayAddress);

  // Beacon Upgradable Pattern for Treasury
  const treasuryImplementation = await ethers.deployContract('Treasury');
  const treasuryImplementationAddress = await treasuryImplementation.getAddress();
  const treasuryBeaconFactory = await ethers.getContractFactory('TreasuryBeacon');
  const treasuryBeacon = await treasuryBeaconFactory.deploy(treasuryImplementationAddress)
  await treasuryBeacon.waitForDeployment();
  const treasuryBeaconAddress = await treasuryBeacon.getAddress();

  // Beacon Upgradable Pattern for Treasury
  const governanceImplementation = await ethers.deployContract('BuildingGovernance');
  const governanceImplementationAddress = await governanceImplementation.getAddress();
  const governanceBeaconFactory = await ethers.getContractFactory('BuildingGovernanceBeacon');
  const governanceBeacon = await governanceBeaconFactory.deploy(governanceImplementationAddress)
  await governanceBeacon.waitForDeployment();
  const governanceBeaconAddress = await governanceBeacon.getAddress();

  // deploy new ERC20 to be used as USDC for demo/phase1 porpose
  const usdcMock = await ethers.deployContract('ERC20Mock', ["USDC", "USDC", 6]);
  const usdcMockAddress = await usdcMock.getAddress();

  const buildingFactory = await upgrades.deployBeaconProxy(
    buildingFactoryBeaconAddress,
    buildingFactoryFactory,
    [
      contracts.implementations.ERC721Metadata, 
      uniswapRouterAddress, 
      uniswapFactoryAddress,
      identityGatewayAddress,
      trexGatewayAddress,
      usdcMockAddress,
      buildingBeaconAddress,
      contracts.vault.VaultFactory,
      treasuryBeaconAddress,
      governanceBeaconAddress
    ],
    { 
      initializer: 'initialize'
    }
  );

  await buildingFactory.waitForDeployment();
  const buildingFactoryAddress = await buildingFactory.getAddress()

  const nftCollection = await ethers.getContractAt('ERC721Metadata', contracts.implementations.ERC721Metadata);
  await nftCollection.transferOwnership(buildingFactoryAddress);
  await trexGateway.addDeployer(buildingFactoryAddress);

  return {
    ...contracts,
    factories: {
      ...contracts.factories,
      BuildingFactory: buildingFactoryAddress
    }
  }
}

async function logContracts(contracts: Record<string, any>): Promise<Record<string, any>> {
  console.log(contracts);
  return contracts;
}

// creates a deployment file into data/deployments (eg: data/deployments/mainnet.json)
async function exportDeploymentVersion(contracts: Record<string, any>): Promise<Record<string, any>> {
  console.log(' - Export Deployment contract addresses...');
  const network = await ethers.provider.getNetwork();
  const filePath = `./data/deployments/chain-${network.chainId.toString()}.json`
  const jsonData = JSON.stringify(contracts, null, 2);
  await writeFile(filePath, jsonData, 'utf-8');
  console.log(` - Deployment addresses written to ${filePath}`);

  return contracts;
}

// Finish function
async function finish(): Promise<void> {
  console.log(' - Finished');
  process.exit();
}

init()
  // add subsequent deployment script after this comment
  .then(deployERC3643)
  .then(deployComplianceModules)
  .then(deployVault)
  .then(deployTokenBalancer)
  .then(deployAutoCompounder)
  .then(deployAutoCompounderFactory)
  .then(deployHTSTokenFactory)
  .then(createERC721Metadata)
  .then(createBuildingFactory)
  .then(exportDeploymentVersion)
  .then(logContracts)
  .then(finish)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });


