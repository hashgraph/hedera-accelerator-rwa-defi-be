import { ethers, upgrades } from "hardhat";
import { writeFile } from "fs/promises";
import TestnetDeployments from "../data/deployments/chain-296.json";

import { usdcAddress, uniswapRouterAddress, trexFactoryAddress } from "../constants";
import { BuildingFactoryInitStruct } from "../typechain-types/contracts/buildings/BuildingFactory.sol/BuildingFactory";

// Initial function for logs and configs
async function init(): Promise<Record<string, any>> {
    console.log(" - Deploying contracts...");
    return {
        ...TestnetDeployments,
    };
}

async function deployComplianceModules(contracts: Record<string, any>): Promise<Record<string, any>> {
    const [deployer] = await ethers.getSigners();

    // Deploy compliance Modules
    const requiresNFTModule = await ethers.deployContract("RequiresNFTModule", deployer);
    const countryAllowModule = await ethers.deployContract("CountryAllowModule", deployer);
    const maxOwnershipByCountryModule = await ethers.deployContract("MaxOwnershipByCountryModule", deployer);
    const maxTenPercentOwnershipModule = await ethers.deployContract("MaxTenPercentOwnershipModule", deployer);
    const onlyUsaModule = await ethers.deployContract("OnlyUsaModule", deployer);
    const transferLimitOneHundredModule = await ethers.deployContract("TransferLimitOneHundredModule", deployer);

    return {
        ...contracts,
        compliance: {
            RequiresNFTModule: await requiresNFTModule.getAddress(),
            CountryAllowModule: await countryAllowModule.getAddress(),
            MaxOwnershipByCountryModule: await maxOwnershipByCountryModule.getAddress(),
            MaxTenPercentOwnershipModule: await maxTenPercentOwnershipModule.getAddress(),
            OnlyUsaModule: await onlyUsaModule.getAddress(),
            TransferLimitOneHundredModule: await transferLimitOneHundredModule.getAddress(),
        },
    };
}

async function deployBuildingIdentityFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying Building Identity Factory...");
    const [owner] = await ethers.getSigners();
    const identityImplementation = await ethers.deployContract("Identity", [owner.address, true], owner);
    const identityImplementationAuthority = await ethers.deployContract(
        "ImplementationAuthority",
        [await identityImplementation.getAddress()],
        owner,
    );
    const identityFactory = await ethers.deployContract(
        "IdFactory",
        [await identityImplementationAuthority.getAddress()],
        owner,
    );

    const buildingIdentityFactory = await ethers.deployContract(
        "BuildingIdentityFactory",
        [await identityFactory.getAddress()],
        owner,
    );
    const buildingIdentityFactoryAddress = await buildingIdentityFactory.getAddress();

    await identityFactory.transferOwnership(buildingIdentityFactoryAddress);

    return {
        ...contracts,
        factories: {
            ...contracts.factories,
            BuildingIdentityFactory: buildingIdentityFactoryAddress,
        },
    };
}

async function deployVaultFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying RewardsVault4626Factory...");
    const [deployer] = await ethers.getSigners();

    const RewardsVault4626Factory = await ethers.getContractFactory("RewardsVault4626Factory");
    const vaultFactory = await RewardsVault4626Factory.deploy();
    await vaultFactory.waitForDeployment();
    const vaultFactoryAddress = await vaultFactory.getAddress();

    return {
        ...contracts,
        factories: {
            ...contracts.factories,
            RewardsVault4626Factory: vaultFactory.target,
        },
    };
}

async function deploySliceFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying Slice Factory...");

    const SliceFactory = await ethers.getContractFactory("SliceFactory");
    const sliceFactory = await SliceFactory.deploy();
    await sliceFactory.waitForDeployment();

    return {
        ...contracts,
        factories: {
            ...contracts.factories,
            SliceFactory: sliceFactory.target,
        },
    };
}

async function deployAutoCompounderFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying RewardsVaultAutoCompounderFactory...");

    const RewardsVaultAutoCompounderFactory = await ethers.getContractFactory("RewardsVaultAutoCompounderFactory");
    const autoCompounderFactory = await RewardsVaultAutoCompounderFactory.deploy(
        uniswapRouterAddress,
        usdcAddress,
        ethers.parseUnits("10", 6), // 10 USDC minimum claim threshold
        500, // 5% max slippage in basis points
    );
    await autoCompounderFactory.waitForDeployment();
    const autoCompounderFactoryAddress = await autoCompounderFactory.getAddress();

    return {
        ...contracts,
        factories: {
            ...contracts.factories,
            RewardsVaultAutoCompounderFactory: autoCompounderFactory.target,
        },
    };
}

async function deployERC721Metadata(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying ERC721Metadata ...");
    const nftCollectionFactory = await ethers.getContractFactory("ERC721Metadata");
    const ERC721Metadata = await nftCollectionFactory.deploy("Buildings R Us", "BRUS");
    await ERC721Metadata.waitForDeployment();
    const ERC721MetadataAddress = await ERC721Metadata.getAddress();

    return {
        ...contracts,
        implementations: {
            ...contracts.implementations,
            ERC721Metadata: ERC721MetadataAddress,
        },
    };
}

async function deployUpkeeper(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying UpKeeper ...");
    const [owner] = await ethers.getSigners();
    const upkeeper = await ethers.deployContract("UpKeeper", owner);

    return {
        ...contracts,
        implementations: {
            ...contracts.implementations,
            UpKeeper: await upkeeper.getAddress(),
        },
    };
}

async function deployBuildingFactory(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying BuildingFactory ...");
    const buildingFact = await ethers.getContractFactory("Building");
    const buildingBeacon = await upgrades.deployBeacon(buildingFact);
    await buildingBeacon.waitForDeployment();
    const buildingBeaconAddress = await buildingBeacon.getAddress();

    const buildingIdentityFactory = await ethers.getContractAt(
        "BuildingIdentityFactory",
        contracts.factories.BuildingIdentityFactory,
    );
    const buildingIdentityFactoryAddress = await buildingIdentityFactory.getAddress();

    const buildingFactoryFactory = await ethers.getContractFactory("BuildingFactory", {
        libraries: contracts.libraries,
    });
    const buildingFactoryBeacon = await upgrades.deployBeacon(buildingFactoryFactory, {
        unsafeAllow: ["external-library-linking"],
    });
    await buildingFactoryBeacon.waitForDeployment();
    const buildingFactoryBeaconAddress = await buildingFactoryBeacon.getAddress();

    const uniswapRouter = await ethers.getContractAt("UniswapV2Router02", uniswapRouterAddress);
    const uniswapFactoryAddress = await uniswapRouter.factory();

    // Beacon Upgradable Pattern for Treasury
    const treasuryImplementation = await ethers.deployContract("Treasury", { gasLimit: 15000000 });
    await treasuryImplementation.waitForDeployment();
    const treasuryImplementationAddress = await treasuryImplementation.getAddress();
    const treasuryBeaconFactory = await ethers.getContractFactory("TreasuryBeacon");
    const treasuryBeacon = await treasuryBeaconFactory.deploy(treasuryImplementationAddress, { gasLimit: 15000000 });
    await treasuryBeacon.waitForDeployment();
    const treasuryBeaconAddress = await treasuryBeacon.getAddress();

    // Beacon Upgradable Pattern for Treasury
    const governanceImplementation = await ethers.deployContract("BuildingGovernance");
    await governanceImplementation.waitForDeployment();
    const governanceImplementationAddress = await governanceImplementation.getAddress();
    const governanceBeaconFactory = await ethers.getContractFactory("BuildingGovernanceBeacon");
    const governanceBeacon = await governanceBeaconFactory.deploy(governanceImplementationAddress, {
        gasLimit: 15000000,
    });
    await governanceBeacon.waitForDeployment();
    const governanceBeaconAddress = await governanceBeacon.getAddress();

    const buildingFactoryInit: BuildingFactoryInitStruct = {
        nft: contracts.implementations.ERC721Metadata,
        uniswapRouter: uniswapRouterAddress,
        uniswapFactory: uniswapFactoryAddress,
        trexFactory: trexFactoryAddress,
        usdc: usdcAddress,
        buildingBeacon: buildingBeaconAddress,
        treasuryBeacon: treasuryBeaconAddress,
        governanceBeacon: governanceBeaconAddress,
        upkeeper: contracts.implementations.UpKeeper,
        identityFactory: buildingIdentityFactoryAddress,
    };

    const buildingFactory = await upgrades.deployBeaconProxy(
        buildingFactoryBeaconAddress,
        buildingFactoryFactory,
        [buildingFactoryInit],
        { initializer: "initialize" },
    );

    await buildingFactory.waitForDeployment();
    const buildingFactoryAddress = await buildingFactory.getAddress();

    // age identity registry agents to be able to register identities for the erc3643 tokens
    await buildingFactory.addRegistryAgents([
        contracts.factories.RewardsVault4626Factory,
        contracts.factories.RewardsVaultAutoCompounderFactory,
    ]);

    const nftCollection = await ethers.getContractAt("ERC721Metadata", contracts.implementations.ERC721Metadata);
    await nftCollection.transferOwnership(buildingFactoryAddress);

    // grant TRUSTED_REGISTRY_ROLE to building factory
    const upkeeper = await ethers.getContractAt("UpKeeper", contracts.implementations.UpKeeper);
    await upkeeper.grantRole(await upkeeper.TRUSTED_REGISTRY_ROLE(), buildingFactoryAddress);

    await buildingIdentityFactory.grantRole(
        await buildingIdentityFactory.IDENTITY_DEPLOYER_ROLE(),
        buildingFactoryAddress,
    );

    return {
        ...contracts,
        factories: {
            ...contracts.factories,
            BuildingFactory: buildingFactoryAddress,
        },
    };
}

async function deployAudit(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying Audit ...");
    const [owner] = await ethers.getSigners();
    const AuditRegistry = await ethers.getContractFactory("AuditRegistry");
    const auditRegistry = await AuditRegistry.deploy(owner.address);
    await auditRegistry.waitForDeployment();
    const auditRegistryAddress = await auditRegistry.getAddress();

    return {
        ...contracts,
        implementations: {
            ...contracts.implementations,
            AuditRegistry: auditRegistryAddress,
        },
    };
}

async function deployExchange(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying Exchange ...");
    const oneSidedExchangeImplementation = await ethers.deployContract("OneSidedExchange");
    const exchangeAddress = await oneSidedExchangeImplementation.getAddress();

    return {
        ...contracts,
        implementations: {
            ...contracts.implementations,
            OneSidedExchange: exchangeAddress,
        },
    };
}

async function deployLibraries(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Deploying Libraries ...");
    const libraries = {
        BuildingTokenLib: await (
            await (await ethers.deployContract("BuildingTokenLib")).waitForDeployment()
        ).getAddress(),
        BuildingGovernanceLib: await (
            await (await ethers.deployContract("BuildingGovernanceLib")).waitForDeployment()
        ).getAddress(),
        BuildingTreasuryLib: await (
            await (await ethers.deployContract("BuildingTreasuryLib")).waitForDeployment()
        ).getAddress(),
        BuildingVaultLib: await (
            await (await ethers.deployContract("BuildingVaultLib")).waitForDeployment()
        ).getAddress(),
        BuildingAutoCompounderLib: await (
            await (await ethers.deployContract("BuildingAutoCompounderLib")).waitForDeployment()
        ).getAddress(),
    };

    return {
        ...contracts,
        libraries,
    };
}

async function logContracts(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(contracts);
    return contracts;
}

// creates a deployment file into data/deployments (eg: data/deployments/mainnet.json)
async function exportDeploymentVersion(contracts: Record<string, any>): Promise<Record<string, any>> {
    console.log(" - Export Deployment contract addresses...");
    const network = await ethers.provider.getNetwork();
    const filePath = `./data/deployments/chain-${network.chainId.toString()}.json`;
    const jsonData = JSON.stringify(contracts, null, 2);
    await writeFile(filePath, jsonData, "utf-8");
    console.log(` - Deployment addresses written to ${filePath}`);

    return contracts;
}

async function finish(): Promise<void> {
    console.log(" - Finished");
    process.exit();
}

// Description: 🔍 - Deploy Factory contracts and REIT Suite contracts
init()
    // add subsequent deployment script after this comment
    .then(deployBuildingIdentityFactory)
    .then(deployComplianceModules)
    .then(deployVaultFactory)
    .then(deploySliceFactory)
    .then(deployAutoCompounderFactory)
    .then(deployERC721Metadata)
    .then(deployUpkeeper)
    .then(deployLibraries)
    .then(deployBuildingFactory)
    .then(deployAudit)
    .then(deployExchange)
    .then(exportDeploymentVersion)
    .then(logContracts)
    .then(finish)
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
