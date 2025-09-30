import { ethers } from "hardhat";
import { v4 as uuidv4 } from "uuid";
import { LogDescription } from "ethers";
import Deployments from "../../data/deployments/chain-296.json";
import { uniswapRouterAddress, chainlinkAggregatorMockAddress, usdcAddress } from "../../constants";
import { promptBuilding } from "../building/prompt-building";

/**
 * Script to create a slice using existing buildings with ERC3643 compliance setup
 * This script:
 * 1. Prompts user to select two buildings
 * 2. Gets building details (vault, autocompounder, token addresses)
 * 3. Deploys a slice with 50/50 allocation
 * 4. Uses BuildingFactory to deploy and register slice identity for ERC3643 compliance
 * 5. Sets up Uniswap pools with liquidity
 * 6. Adds initial deposits for testing
 *
 * Usage: npx hardhat run scripts/building-slice/create-slice-with-buildings-fixed.ts --network testnet
 */

// Description: 📝 - Create Slice with 50/50 allocation
// Configuration
const SLICE_CONFIG = {
    name: "BuildingSlice",
    symbol: "BSLICE",
    metadataUri: "ipfs://bafybeibnsoufr2renqzsh347nrx54wcubt5lgkeivez63xvivplfwhtpym/m",
    allocationPercentage1: 5000, // 50%
    allocationPercentage2: 5000, // 50%
};

const LIQUIDITY_CONFIG = {
    tokenAmount: ethers.parseUnits("10000", 18), // 10,000 tokens per pool
    usdcAmount: ethers.parseUnits("10000", 6), // 10,000 USDC per pool
};

const DEPOSIT_CONFIG = {
    depositAmount: ethers.parseUnits("100", 18), // 100 tokens per building
};

/**
 * Get building details from user selection
 */
async function selectBuildings() {
    console.log("🏢 Select Buildings for Slice");
    console.log("=============================");
    console.log("You need to select 2 buildings to create a slice with 50/50 allocation.\n");

    // Get first building
    console.log("📍 Select First Building (50% allocation):");
    const building1Details = await promptBuilding();

    // Get second building
    console.log("📍 Select Second Building (50% allocation):");
    const building2Details = await promptBuilding();

    // Verify buildings are different
    if (building1Details.addr === building2Details.addr) {
        throw new Error("Please select two different buildings for the slice");
    }

    console.log("\n✅ Buildings Selected:");
    console.log(`Building 1: ${building1Details.addr}`);
    console.log(`  - ERC3643 Token: ${building1Details.erc3643Token}`);
    console.log(`  - Vault: ${building1Details.vault}`);
    console.log(`  - AutoCompounder: ${building1Details.autoCompounder}`);

    console.log(`Building 2: ${building2Details.addr}`);
    console.log(`  - ERC3643 Token: ${building2Details.erc3643Token}`);
    console.log(`  - Vault: ${building2Details.vault}`);
    console.log(`  - AutoCompounder: ${building2Details.autoCompounder}`);

    return { building1Details, building2Details };
}

/**
 * Deploy the slice with building allocations
 */
async function deploySlice(building1Details: any, building2Details: any): Promise<string> {
    const [owner] = await ethers.getSigners();
    const salt = `0x${uuidv4().replace(/-/g, "")}`;

    console.log(`\n--- Deploying Slice ---`);

    const sliceFactory = await ethers.getContractAt("SliceFactory", Deployments.factories.SliceFactory);

    const sliceDetails = {
        uniswapRouter: uniswapRouterAddress,
        usdc: usdcAddress,
        name: SLICE_CONFIG.name,
        symbol: SLICE_CONFIG.symbol,
        metadataUri: SLICE_CONFIG.metadataUri,
    };

    const tx = await sliceFactory.deploySlice(salt, sliceDetails);
    await tx.wait();

    // Get slice address from event
    const logs = await sliceFactory.queryFilter(
        sliceFactory.filters.SliceDeployed,
        tx.blockNumber as number,
        tx.blockNumber as number,
    );
    const event = logs[0];
    const decodedEvent = sliceFactory.interface.parseLog(event) as LogDescription;
    const sliceAddress = decodedEvent.args[0];

    console.log(`Slice deployed: ${sliceAddress}`);

    // Add allocations for the buildings
    const slice = await ethers.getContractAt("Slice", sliceAddress);

    console.log(`\n--- Adding Building Allocations ---`);

    // Add first building allocation
    const allocationTx1 = await slice.addAllocation(
        building1Details.autoCompounder,
        chainlinkAggregatorMockAddress,
        SLICE_CONFIG.allocationPercentage1,
    );
    console.log(`Building 1 Allocation (50%): ${allocationTx1.hash}`);
    console.log(`  - AutoCompounder: ${building1Details.autoCompounder}`);
    console.log(`  - ERC3643 Token: ${building1Details.erc3643Token}`);

    // Add second building allocation
    const allocationTx2 = await slice.addAllocation(
        building2Details.autoCompounder,
        chainlinkAggregatorMockAddress,
        SLICE_CONFIG.allocationPercentage2,
    );
    console.log(`Building 2 Allocation (50%): ${allocationTx2.hash}`);
    console.log(`  - AutoCompounder: ${building2Details.autoCompounder}`);
    console.log(`  - ERC3643 Token: ${building2Details.erc3643Token}`);

    return sliceAddress;
}

/**
 * Register slice with ERC3643 identity registry for compliance using BuildingFactory
 */
async function registerSliceWithERC3643(sliceAddress: string, building1Details: any, building2Details: any) {
    const [owner] = await ethers.getSigners();

    console.log(`\n--- Registering Slice with ERC3643 Compliance (Using BuildingFactory) ---`);

    const buildings = [building1Details, building2Details];

    for (let i = 0; i < buildings.length; i++) {
        const building = buildings[i];
        const tokenAddress = building.erc3643Token;

        try {
            console.log(`\nRegistering slice for Building ${i + 1} token:`);
            console.log(`  Building Address: ${building.addr}`);
            console.log(`  Token Address: ${tokenAddress}`);

            // Get ERC3643 token contract
            const tokenContract = await ethers.getContractAt("ITokenVotes", tokenAddress);

            // Get identity registry from token
            const identityRegistryAddress = await tokenContract.identityRegistry();
            console.log(`  Identity Registry: ${identityRegistryAddress}`);

            // Get identity registry contract
            const identityRegistry = await ethers.getContractAt("IIdentityRegistry", identityRegistryAddress);

            // Check if slice is already registered
            const isRegistered = await identityRegistry.contains(sliceAddress);
            if (isRegistered) {
                console.log(`  ✅ Slice already registered with this token's identity registry`);
                continue;
            }

            // Use BuildingFactory to deploy identity for slice
            const buildingFactory = await ethers.getContractAt(
                "BuildingFactory",
                Deployments.factories.BuildingFactory,
            );

            console.log(`  Step 1: Deploying identity for slice using BuildingFactory...`);
            try {
                const deployIdentityTx = await buildingFactory.deployIdentityForWallet(sliceAddress);
                await deployIdentityTx.wait();
                console.log(`  ✅ Identity deployed for slice: ${deployIdentityTx.hash}`);
            } catch (error) {
                console.log(`  ❌ Error deploying identity for slice: ${error.message}`);
            }

            // Use BuildingFactory to register slice with identity registry
            console.log(`  Step 2: Registering slice identity with BuildingFactory...`);
            const registerIdentityTx = await buildingFactory.registerIdentity(
                building.addr, // building address
                sliceAddress, // wallet (slice) address
                840, // country code (USA)
            );
            await registerIdentityTx.wait();
            console.log(`  ✅ Slice registered with identity registry: ${registerIdentityTx.hash}`);

            // Verify registration
            const isNowRegistered = await identityRegistry.contains(sliceAddress);
            if (isNowRegistered) {
                console.log(`  ✅ Verification successful: Slice is now registered`);
            } else {
                console.log(`  ⚠️  Verification failed: Slice registration may have failed`);
            }
        } catch (error: any) {
            console.error(`  ❌ Error registering slice for Building ${i + 1}: ${error.message}`);

            if (error.message.includes("onlyAgent")) {
                console.log(`    💡 The owner account needs to be an agent of the identity registry`);
                console.log(
                    `    This is a common issue - the slice will still work for testing without ERC3643 compliance`,
                );
            } else if (error.message.includes("Identity for wallet not found")) {
                console.log(`    💡 The identity deployment may have failed`);
                console.log(`    Try running the script again or check BuildingFactory permissions`);
            }
        }
    }
}

/**
 * Set up Uniswap pools with liquidity for building tokens
 */
async function setupUniswapPools(sliceAddress: string, building1Details: any, building2Details: any) {
    const [owner] = await ethers.getSigners();
    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const uniswapRouter = await slice.uniswapV2Router();
    const baseToken = await slice.baseToken();

    console.log(`\n--- Setting up Uniswap Pools for Building Tokens ---`);

    const router = await ethers.getContractAt("IUniswapV2Router02", uniswapRouter);
    const baseTokenContract = await ethers.getContractAt("ERC20Mock", baseToken);

    // Mint base tokens to owner if needed
    try {
        await baseTokenContract.mint(owner.address, ethers.parseUnits("50000", 6));
        console.log(`Minted 50,000 base tokens to owner`);
    } catch (error) {
        console.log(`Base token minting failed (might not be supported): ${error}`);
    }

    const buildings = [building1Details, building2Details];

    for (let i = 0; i < buildings.length; i++) {
        const building = buildings[i];
        const tokenAddress = building.erc3643Token;

        try {
            console.log(`\nSetting up pool for Building ${i + 1}:`);
            console.log(`  Building Address: ${building.addr}`);
            console.log(`  Token Address: ${tokenAddress}`);

            // Get building token contract
            const buildingTokenContract = await ethers.getContractAt("ERC20Mock", tokenAddress);

            // Mint building tokens to owner if needed
            try {
                await buildingTokenContract.mint(owner.address, ethers.parseUnits("50000", 18));
                console.log(`  Minted 50,000 building tokens to owner`);
            } catch (error) {
                console.log(`  Building token minting failed (might not be supported): ${error}`);
            }

            // Check balances
            const ownerTokenBalance = await buildingTokenContract.balanceOf(owner.address);
            const ownerBaseBalance = await baseTokenContract.balanceOf(owner.address);

            console.log(`  Owner token balance: ${ethers.formatUnits(ownerTokenBalance, 18)}`);
            console.log(`  Owner base balance: ${ethers.formatUnits(ownerBaseBalance, 6)}`);

            // Approve tokens for router
            await buildingTokenContract.approve(uniswapRouter, LIQUIDITY_CONFIG.tokenAmount);
            await baseTokenContract.approve(uniswapRouter, LIQUIDITY_CONFIG.usdcAmount);

            // Add liquidity
            const addLiquidityTx = await router.addLiquidity(
                tokenAddress,
                baseToken,
                LIQUIDITY_CONFIG.tokenAmount,
                LIQUIDITY_CONFIG.usdcAmount,
                (LIQUIDITY_CONFIG.tokenAmount * 95n) / 100n, // 5% slippage
                (LIQUIDITY_CONFIG.usdcAmount * 95n) / 100n, // 5% slippage
                owner.address,
                Math.floor(Date.now() / 1000) + 1800, // 30 minutes deadline
                { gasLimit: 3000000 },
            );

            console.log(`  Liquidity added: ${addLiquidityTx.hash}`);
        } catch (error: any) {
            console.error(`  ❌ Error setting up pool for Building ${i + 1}: ${error.message}`);
        }
    }
}

/**
 * Add initial deposits to the slice for testing
 */
async function addInitialDeposits(sliceAddress: string, building1Details: any, building2Details: any) {
    const [owner] = await ethers.getSigners();
    const slice = await ethers.getContractAt("Slice", sliceAddress);

    console.log(`\n--- Adding Initial Deposits ---`);

    const buildings = [building1Details, building2Details];

    for (let i = 0; i < buildings.length; i++) {
        const building = buildings[i];
        const tokenAddress = building.erc3643Token;

        try {
            console.log(`\nDepositing to Building ${i + 1}:`);
            console.log(`  Building Address: ${building.addr}`);
            console.log(`  Token Address: ${tokenAddress}`);
            console.log(`  AutoCompounder: ${building.autoCompounder}`);

            const buildingTokenContract = await ethers.getContractAt("ERC20Mock", tokenAddress);

            // Check if owner has enough tokens
            const balance = await buildingTokenContract.balanceOf(owner.address);
            if (balance < DEPOSIT_CONFIG.depositAmount) {
                console.log(
                    `  ⚠️  Insufficient balance (need ${ethers.formatUnits(
                        DEPOSIT_CONFIG.depositAmount,
                        18,
                    )}, have ${ethers.formatUnits(balance, 18)}), skipping deposit`,
                );
                continue;
            }

            // Approve and deposit to slice
            await buildingTokenContract.approve(sliceAddress, DEPOSIT_CONFIG.depositAmount);
            const depositTx = await slice.deposit(building.autoCompounder, DEPOSIT_CONFIG.depositAmount);

            console.log(`  Deposit transaction: ${depositTx.hash}`);
            console.log(`  Deposited ${ethers.formatUnits(DEPOSIT_CONFIG.depositAmount, 18)} tokens`);
        } catch (error: any) {
            console.error(`  ❌ Error depositing to Building ${i + 1}: ${error.message}`);

            if (error.message.includes("execution reverted")) {
                console.log(`    💡 This might be due to ERC3643 compliance restrictions`);
                console.log(`    The slice needs to be registered with the identity registry`);
                console.log(`    Try running the ERC3643 registration step again`);
            }
        }
    }
}

/**
 * Verify the slice setup
 */
async function verifySliceSetup(sliceAddress: string, building1Details: any, building2Details: any) {
    console.log(`\n--- Verifying Slice Setup ---`);

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    console.log(`Slice Address: ${sliceAddress}`);
    console.log(`Total Allocations: ${allocations.length}`);

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const building = i === 0 ? building1Details : building2Details;

        console.log(`  Allocation ${i + 1}:`);
        console.log(`    Building Address: ${building.addr}`);
        console.log(`    aToken (AutoCompounder): ${allocation.aToken}`);
        console.log(`    Asset (ERC3643 Token): ${allocation.asset}`);
        console.log(`    Target Percentage: ${allocation.targetPercentage}%`);

        // Check aToken balance in slice
        const aTokenContract = await ethers.getContractAt("AutoCompounder", allocation.aToken);
        const balance = await aTokenContract.balanceOf(sliceAddress);
        console.log(`    Current Balance: ${ethers.formatUnits(balance, 18)} aTokens`);

        // Check building token balance
        const buildingTokenContract = await ethers.getContractAt("ERC20Mock", allocation.asset);
        const buildingBalance = await buildingTokenContract.balanceOf(sliceAddress);
        console.log(`    Building Token Balance: ${ethers.formatUnits(buildingBalance, 18)} tokens`);
    }

    // Check total supply
    const totalSupply = await slice.totalSupply();
    console.log(`Total sToken Supply: ${ethers.formatUnits(totalSupply, 18)}`);

    // Check slice metadata
    const sliceName = await slice.name();
    const sliceSymbol = await slice.symbol();
    console.log(`Slice Name: ${sliceName}`);
    console.log(`Slice Symbol: ${sliceSymbol}`);
}

async function main() {
    console.log("🏢 Creating Slice with Existing Buildings (BuildingFactory ERC3643 Compliant)");
    console.log("==============================================================================");

    const [owner] = await ethers.getSigners();
    console.log(`Using account: ${owner.address}`);

    try {
        // Step 1: Select buildings
        console.log("\n🏢 Step 1: Selecting Buildings");
        const { building1Details, building2Details } = await selectBuildings();

        // Step 2: Deploy slice with building allocations
        console.log("\n🎯 Step 2: Deploying Slice");
        const sliceAddress = await deploySlice(building1Details, building2Details);

        // Step 3: Register slice with ERC3643 compliance using BuildingFactory
        console.log("\n🔐 Step 3: Registering Slice with ERC3643 Compliance (BuildingFactory)");
        await registerSliceWithERC3643(sliceAddress, building1Details, building2Details);

        // Step 4: Set up Uniswap pools for building tokens
        console.log("\n💧 Step 4: Setting up Uniswap Pools");
        await setupUniswapPools(sliceAddress, building1Details, building2Details);

        // Step 5: Add initial deposits
        console.log("\n💰 Step 5: Adding Initial Deposits");
        await addInitialDeposits(sliceAddress, building1Details, building2Details);

        // Step 6: Verify setup
        await verifySliceSetup(sliceAddress, building1Details, building2Details);

        console.log("\n✅ Slice Creation Complete!");
        console.log("============================");
        console.log(`🎯 Slice Address: ${sliceAddress}`);
        console.log(`🏢 Building 1: ${building1Details.addr}`);
        console.log(`🏢 Building 2: ${building2Details.addr}`);
        console.log(`🏦 Building 1 Vault: ${building1Details.vault}`);
        console.log(`🏦 Building 2 Vault: ${building2Details.vault}`);
        console.log(`⚙️  Building 1 AutoCompounder: ${building1Details.autoCompounder}`);
        console.log(`⚙️  Building 2 AutoCompounder: ${building2Details.autoCompounder}`);
        console.log(`🪙 Building 1 Token: ${building1Details.erc3643Token}`);
        console.log(`🪙 Building 2 Token: ${building2Details.erc3643Token}`);

        console.log("\n📝 Next Steps:");
        console.log("1. Test rebalancing: npx hardhat run scripts/building-slice/rebalance-slice.ts --network testnet");
        console.log("2. Use the slice address above when prompted");
        console.log("3. The slice is ready for rebalancing operations with real building tokens!");

        console.log("\n⚠️  Note:");
        console.log("This script uses BuildingFactory to handle ERC3643 compliance:");
        console.log("1. deployIdentityForWallet() - Creates identity for the slice");
        console.log("2. registerIdentity() - Registers slice with each building's identity registry");
        console.log("If deposits still fail, check BuildingFactory agent permissions");
    } catch (error) {
        console.error("❌ Error creating slice:", error);
        throw error;
    }
}

// Execute the script
main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
