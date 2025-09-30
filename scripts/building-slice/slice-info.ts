import { ethers } from "hardhat";
import { promptAddress } from "../building/prompt-address";
import Deployments from "../../data/deployments/chain-296.json";
import { ZeroAddress } from "ethers";

/**
 * Script to get comprehensive information about a slice contract
 *
 * This script provides detailed information about:
 * - Slice basic info (name, symbol, total supply)
 * - Allocations and their details
 * - Token balances and values
 * - Price feed information
 * - Rebalance necessity analysis
 * - Uniswap pool information
 *
 * Usage: npx hardhat run scripts/building-slice/get-slice-info.ts --network testnet
 */

/**
 * Get basic slice information
 */
async function getSliceBasicInfo(sliceAddress: string) {
    console.log("\n📊 Slice Basic Information");
    console.log("==========================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);

    const name = await slice.name();
    const symbol = await slice.symbol();
    const totalSupply = await slice.totalSupply();
    const decimals = await slice.decimals();
    const uniswapRouter = await slice.uniswapV2Router();
    const baseToken = await slice.baseToken();
    const metadataUri = await slice.metadataUri();

    console.log(`Slice Address: ${sliceAddress}`);
    console.log(`Name: ${name}`);
    console.log(`Symbol: ${symbol}`);
    console.log(`Total Supply: ${ethers.formatUnits(totalSupply, decimals)} ${symbol}`);
    console.log(`Decimals: ${decimals}`);
    console.log(`Uniswap Router: ${uniswapRouter}`);
    console.log(`Base Token (USDC): ${baseToken}`);
    console.log(`Metadata URI: ${metadataUri}`);
}

/**
 * Get detailed allocation information
 */
async function getAllocationInfo(sliceAddress: string) {
    console.log("\n🎯 Allocation Information");
    console.log("========================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    if (allocations.length === 0) {
        console.log("❌ No allocations found in the slice contract!");
        console.log("💡 Use the setup-allocations.ts script to add allocations.");
        return;
    }

    console.log(`Total Allocations: ${allocations.length}`);

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        console.log(`\n--- Allocation ${i + 1} ---`);
        console.log(`AutoCompounder (aToken): ${allocation.aToken}`);
        console.log(`Asset (ERC3643 Token): ${allocation.asset}`);
        console.log(`Target Percentage: ${allocation.targetPercentage / 100n}%`);

        // Get autocompounder details
        try {
            const autoCompounder = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const aTokenName = await autoCompounder.name();
            const aTokenSymbol = await autoCompounder.symbol();
            const exchangeRate = await autoCompounder.exchangeRate();
            const vaultAddress = await autoCompounder.vault();

            console.log(`  aToken Name: ${aTokenName}`);
            console.log(`  aToken Symbol: ${aTokenSymbol}`);
            console.log(`  Exchange Rate: ${ethers.formatUnits(exchangeRate, 18)}`);
            console.log(`  Vault Address: ${vaultAddress}`);

            // Get vault details
            const vault = await ethers.getContractAt("RewardsVault4626", vaultAddress);
            const vaultAsset = await vault.asset();
            const vaultTotalAssets = await vault.totalAssets();
            const vaultTotalSupply = await vault.totalSupply();

            console.log(`  Vault Asset: ${vaultAsset}`);
            console.log(`  Vault Total Assets: ${ethers.formatUnits(vaultTotalAssets, 18)}`);
            console.log(`  Vault Total Supply: ${ethers.formatUnits(vaultTotalSupply, 18)}`);
        } catch (error: any) {
            console.log(`  ❌ Error getting autocompounder details: ${error.message}`);
        }

        // Get asset token details
        try {
            const assetToken = await ethers.getContractAt("ERC20Mock", allocation.asset);
            const assetName = await assetToken.name();
            const assetSymbol = await assetToken.symbol();
            const assetDecimals = await assetToken.decimals();

            console.log(`  Asset Name: ${assetName}`);
            console.log(`  Asset Symbol: ${assetSymbol}`);
            console.log(`  Asset Decimals: ${assetDecimals}`);
        } catch (error: any) {
            console.log(`  ❌ Error getting asset details: ${error.message}`);
        }
    }
}

/**
 * Get balance information for the slice
 */
async function getBalanceInfo(sliceAddress: string) {
    console.log("\n💰 Balance Information");
    console.log("======================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    if (allocations.length === 0) {
        console.log("❌ No allocations to check balances for.");
        return;
    }

    let totalValue = 0;

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        console.log(`\n--- Allocation ${i + 1} Balances ---`);

        // Get slice's aToken balance
        try {
            const autoCompounder = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const aTokenBalance = await autoCompounder.balanceOf(sliceAddress);
            console.log(`Slice aToken Balance: ${ethers.formatUnits(aTokenBalance, 18)} aTokens`);

            // Convert to underlying asset amount
            if (aTokenBalance > 0) {
                const exchangeRate = await autoCompounder.exchangeRate();
                const underlyingAmount = (aTokenBalance * exchangeRate) / ethers.parseUnits("1", 18);
                console.log(`Underlying Asset Amount: ${ethers.formatUnits(underlyingAmount, 18)} tokens`);

                // Get price if possible
                try {
                    const priceData = ethers.formatUnits(
                        await slice.getChainlinkDataFeedLatestAnswer(allocation.asset),
                        18,
                    );
                    const price = Number(priceData);
                    const aTokenDecimals = await autoCompounder.decimals();
                    const usdValue = (underlyingAmount * BigInt(price)) / 10n ** BigInt(aTokenDecimals);
                    console.log(`USD Value: $${Number(usdValue).toLocaleString()}`);
                    totalValue += Number(usdValue);
                } catch (error: any) {
                    console.log(`❌ Could not get price: ${error.message}`);
                }
            }
        } catch (error: any) {
            console.log(`❌ Error getting aToken balance: ${error.message}`);
        }

        // Get slice's asset token balance (should be 0 if properly deposited)
        try {
            const assetToken = await ethers.getContractAt("ERC20Mock", allocation.asset);
            const assetBalance = await assetToken.balanceOf(sliceAddress);
            console.log(`Slice Asset Token Balance: ${ethers.formatUnits(assetBalance, 18)} tokens`);

            if (assetBalance > 0) {
                console.log(`⚠️  Warning: Slice has asset tokens (should be 0 if properly deposited)`);
            }
        } catch (error: any) {
            console.log(`❌ Error getting asset balance: ${error.message}`);
        }
    }

    console.log(`\n📈 Total Portfolio Value: $${totalValue.toLocaleString()}`);
}

/**
 * Get price feed information
 */
async function getPriceFeedInfo(sliceAddress: string) {
    console.log("\n📈 Price Feed Information");
    console.log("=========================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    if (allocations.length === 0) {
        console.log("❌ No allocations to check price feeds for.");
        return;
    }

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        console.log(`\n--- Allocation ${i + 1} Price Feed ---`);

        try {
            const priceFeedAddress = await slice.priceFeed(allocation.asset);
            const priceData = ethers.formatUnits(await slice.getChainlinkDataFeedLatestAnswer(allocation.asset), 18);

            console.log(`Price Feed Address: ${priceFeedAddress}`);
            console.log(`Price: ${Number(priceData)}`);

            // Check if price is valid
            const isValid = Number(priceData) > 0;
            console.log(`Status: ${isValid ? "✅ Valid" : "⚠️  Invalid/Zero"}`);
        } catch (error: any) {
            console.log(`❌ Error getting price feed: ${error.message}`);
        }
    }
}

/**
 * Analyze if rebalancing is needed
 */
async function analyzeRebalanceNecessity(sliceAddress: string) {
    console.log("\n⚖️  Rebalance Analysis");
    console.log("======================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    if (allocations.length === 0) {
        console.log("❌ No allocations to analyze.");
        return;
    }

    let totalValue = 0;
    const allocationValues: { percentage: number; targetPercentage: number; needsRebalance: boolean }[] = [];

    // Calculate current percentages
    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        try {
            const autoCompounder = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const aTokenBalance = await autoCompounder.balanceOf(sliceAddress);

            if (aTokenBalance > 0) {
                const exchangeRate = await autoCompounder.exchangeRate();
                const underlyingAmount = (aTokenBalance * exchangeRate) / ethers.parseUnits("1", 18);

                const priceData = ethers.formatUnits(
                    await slice.getChainlinkDataFeedLatestAnswer(allocation.asset),
                    18,
                );
                const price = Number(priceData);
                const aTokenDecimals = await autoCompounder.decimals();
                const usdValue = (underlyingAmount * BigInt(price)) / 10n ** BigInt(aTokenDecimals);

                totalValue += Number(usdValue);
                allocationValues.push({
                    percentage: Number(usdValue), // Store actual USD value
                    targetPercentage: Number(allocation.targetPercentage) / 100,
                    needsRebalance: false,
                });

                console.log(
                    `Allocation ${i + 1}: $${Number(usdValue).toLocaleString()} (target: ${
                        Number(allocation.targetPercentage) / 100
                    }%)`,
                );
            } else {
                allocationValues.push({
                    percentage: 0,
                    targetPercentage: Number(allocation.targetPercentage) / 100,
                    needsRebalance: true,
                });
                console.log(`Allocation ${i + 1}: $0 (target: ${Number(allocation.targetPercentage) / 100}%)`);
            }
        } catch (error: any) {
            console.log(`❌ Error analyzing allocation ${i + 1}: ${error.message}`);
        }
    }

    if (totalValue === 0) {
        console.log("❌ No value found in any allocation. Slice needs initial deposits.");
        return;
    }

    // Calculate actual percentages and check if rebalancing is needed
    let needsRebalance = false;
    const threshold = 1; // 1% threshold

    console.log(`\nTotal Portfolio Value: $${totalValue.toLocaleString()}`);
    console.log("\nCurrent vs Target Allocations:");

    for (let i = 0; i < allocationValues.length; i++) {
        const currentPercentage =
            allocationValues[i].percentage > 0 ? (allocationValues[i].percentage / totalValue) * 100 : 0;
        const targetPercentage = allocationValues[i].targetPercentage;
        const deviation = Math.abs(currentPercentage - targetPercentage);

        allocationValues[i].needsRebalance = deviation > threshold;
        if (allocationValues[i].needsRebalance) needsRebalance = true;

        console.log(
            `Allocation ${i + 1}: ${currentPercentage.toFixed(2)}% vs ${targetPercentage.toFixed(
                2,
            )}% (deviation: ${deviation.toFixed(2)}%) ${allocationValues[i].needsRebalance ? "⚠️" : "✅"}`,
        );
    }

    console.log(`\nRebalance Status: ${needsRebalance ? "⚠️  REBALANCE NEEDED" : "✅ Balanced"}`);
}

/**
 * Get Uniswap pool information
 */
async function getUniswapPoolInfo(sliceAddress: string) {
    console.log("\n💧 Uniswap Pool Information");
    console.log("============================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();
    const uniswapRouter = await slice.uniswapV2Router();
    const baseToken = await slice.baseToken();

    if (allocations.length === 0) {
        console.log("❌ No allocations to check pools for.");
        return;
    }

    console.log(`Uniswap Router: ${uniswapRouter}`);
    console.log(`Base Token: ${baseToken}`);

    const router = await ethers.getContractAt("IUniswapV2Router02", uniswapRouter);

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const tokenAddress = allocation.asset;

        console.log(`\n--- Pool ${i + 1}: ${tokenAddress} <-> ${baseToken} ---`);

        try {
            // Get reserves
            const factoryAddress = await router.factory();
            const factory = await ethers.getContractAt("IUniswapV2Factory", factoryAddress);
            const pairAddress = await factory.getPair(tokenAddress, baseToken);

            if (pairAddress === ZeroAddress) {
                console.log("❌ Pool does not exist");
                continue;
            }

            const pair = await ethers.getContractAt("IUniswapV2Pair", pairAddress);
            const reserves = await pair.getReserves();
            const token0 = await pair.token0();

            // Uniswap sorts tokens by address, so we need to check order
            const [tokenReserve, baseReserve] =
                token0 === tokenAddress ? [reserves[0], reserves[1]] : [reserves[1], reserves[0]];

            console.log(`Pool Address: ${pairAddress}`);
            console.log(`Token Reserve: ${ethers.formatUnits(tokenReserve, 18)}`);
            console.log(`Base Reserve: ${ethers.formatUnits(baseReserve, 6)}`);

            // Calculate price
            if (tokenReserve > 0 && baseReserve > 0) {
                const price = Number(baseReserve) / 10 ** 6 / (Number(tokenReserve) / 10 ** 18);
                console.log(`Price: $${price.toFixed(6)} per token`);
            }

            // Check liquidity
            const minLiquidity = ethers.parseUnits("1000", 18); // 1000 tokens minimum
            const hasLiquidity = tokenReserve > minLiquidity && baseReserve > ethers.parseUnits("1000", 6);
            console.log(`Liquidity Status: ${hasLiquidity ? "✅ Sufficient" : "⚠️  Low"}`);
        } catch (error: any) {
            console.log(`❌ Error getting pool info: ${error.message}`);
        }
    }
}

/**
 * Get building information if available
 */
async function getBuildingInfo(sliceAddress: string) {
    console.log("\n🏢 Building Information");
    console.log("======================");

    try {
        const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);
        const buildingList = await buildingFactory.getBuildingList();

        const slice = await ethers.getContractAt("Slice", sliceAddress);
        const allocations = await slice.allocations();

        if (allocations.length === 0) {
            console.log("❌ No allocations to match with buildings.");
            return;
        }

        // Find buildings that match the slice's autocompounders
        const matchedBuildings: any[] = [];

        for (const building of buildingList) {
            for (const allocation of allocations) {
                if (building.autoCompounder === allocation.aToken) {
                    matchedBuildings.push(building);
                    break;
                }
            }
        }

        if (matchedBuildings.length === 0) {
            console.log("❌ No matching buildings found for slice allocations.");
            return;
        }

        console.log(`Found ${matchedBuildings.length} matching building(s):`);

        for (let i = 0; i < matchedBuildings.length; i++) {
            const buildingDetails = matchedBuildings[i];
            const building = await buildingFactory.getBuildingDetails(buildingDetails.addr);

            console.log(`\n--- Building ${i + 1} ---`);
            console.log(`Building Address: ${building.addr}`);
            console.log(`NFT ID: ${building.nftId}`);
            console.log(`Token URI: ${building.tokenURI}`);
            console.log(`ERC3643 Token: ${building.erc3643Token}`);
            console.log(`Treasury: ${building.treasury}`);
            console.log(`Governance: ${building.governance}`);
            console.log(`Vault: ${building.vault}`);
            console.log(`AutoCompounder: ${building.autoCompounder}`);
            console.log(`Audit Registry: ${building.auditRegistry}`);
            console.log(`Initial Owner: ${building.initialOwner}`);
            console.log(`Token Mint Amount: ${ethers.formatUnits(building.tokenMintAmount, 18)}`);
            console.log(`Is Configured: ${building.isConfigured}`);
        }
    } catch (error: any) {
        console.log(`❌ Error getting building information: ${error.message}`);
    }
}

async function main() {
    console.log("📊 Slice Information Script");
    console.log("===========================");

    // Prompt for slice address
    const sliceAddress = await promptAddress("Slice Address");

    if (!sliceAddress) {
        throw new Error("Slice address is required");
    }

    console.log(`\n🔍 Analyzing Slice: ${sliceAddress}`);
    console.log("=====================================");

    try {
        // Get all information
        await getSliceBasicInfo(sliceAddress);
        await getAllocationInfo(sliceAddress);
        await getBalanceInfo(sliceAddress);
        await getPriceFeedInfo(sliceAddress);
        await analyzeRebalanceNecessity(sliceAddress);
        await getUniswapPoolInfo(sliceAddress);
        await getBuildingInfo(sliceAddress);

        console.log("\n✅ Slice analysis complete!");
    } catch (error) {
        console.error("❌ Error analyzing slice:", error);
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
