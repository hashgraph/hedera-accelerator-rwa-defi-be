import { ethers } from "hardhat";
import { promptAddress } from "../building/prompt-address";

/**
 * Script to perform slice rebalance for the specified slice contract
 *
 * Usage: npx hardhat run scripts/building-slice/rebalance-slice.ts --network <network>
 */

// Description: 📦 - Slice contract address - replace with actual deployed address

/**
 * Check Uniswap pool liquidity for all asset pairs
 */
async function checkPoolLiquidity(SLICE_ADDRESS: string, allocations: any[], baseToken: string, uniswapRouter: string) {
    const router = await ethers.getContractAt("IUniswapV2Router02", uniswapRouter);

    for (const allocation of allocations) {
        try {
            // Check liquidity for asset -> baseToken
            const path1 = [allocation.asset, baseToken];
            const path2 = [baseToken, allocation.asset];

            // Try to get a small quote to test liquidity
            const testAmount = ethers.parseUnits("1", 18); // 1 token

            try {
                const amountsOut1 = await router.getAmountsOut(testAmount, path1);
                const amountsOut2 = await router.getAmountsOut(testAmount, path2);

                console.log(`  ${allocation.asset} <-> ${baseToken}:`);
                console.log(`    ${allocation.asset} -> ${baseToken}: ${ethers.formatUnits(amountsOut1[0], 18)}`);
                console.log(`    ${baseToken} -> ${allocation.asset}: ${ethers.formatUnits(amountsOut2[0], 18)}`);
                console.log("\n\n");
            } catch (error) {
                console.log(`  ⚠️  ${allocation.asset} <-> ${baseToken}: Insufficient liquidity or pool doesn't exist`);
                console.log(`    This may cause rebalance to fail with INSUFFICIENT_OUTPUT_AMOUNT error`);
            }
        } catch (error) {
            console.log(`  ❌ Error checking liquidity for ${allocation.asset}: ${error}`);
        }
    }
}

/**
 * Check if rebalance is actually needed
 */
async function shouldRebalance(SLICE_ADDRESS: string, allocations: any[], slice: any): Promise<boolean> {
    console.log("\n--- Analyzing Rebalance Necessity ---");

    let needsRebalance = false;
    let totalValue = 0;
    const allocationValues: number[] = [];

    // Calculate USD values for each allocation
    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        try {
            const aTokenContract = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const currentBalance = await aTokenContract.balanceOf(SLICE_ADDRESS);

            if (currentBalance > 0) {
                const exchangeRate = await aTokenContract.exchangeRate();
                const aTokenDecimals = await aTokenContract.decimals();

                // Convert aToken balance to underlying asset amount
                const underlyingValue = (currentBalance * exchangeRate) / ethers.parseUnits("1", aTokenDecimals);

                // Get price and calculate USD value
                const priceFeedAddress = await slice.priceFeed(allocation.asset);
                if (priceFeedAddress !== "0x0000000000000000000000000000000000000000") {
                    const priceFeed = await ethers.getContractAt("AggregatorV3Interface", priceFeedAddress);
                    const priceData = await priceFeed.latestRoundData();
                    const price = Number(priceData.answer);

                    // Calculate USD value (match slice contract formula)
                    const usdValue = (underlyingValue * BigInt(price)) / 10n ** BigInt(aTokenDecimals);
                    allocationValues.push(Number(usdValue));
                    totalValue += Number(usdValue);
                } else {
                    allocationValues.push(0);
                }
            } else {
                allocationValues.push(0);
            }
        } catch (error) {
            console.log(`  ${allocation.asset}: Error calculating value`);
            allocationValues.push(0);
        }
    }

    // Calculate current vs target percentages
    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        const currentValue = allocationValues[i];
        const currentPercentage = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
        const targetPercentage = Number(allocation.targetPercentage) / 100; // Convert from basis points

        const deviation = Math.abs(currentPercentage - targetPercentage);
        const threshold = 1; // 1% deviation threshold

        console.log(`  ${allocation.asset}:`);
        console.log(`    Current: ${currentPercentage.toFixed(2)}%, Target: ${targetPercentage.toFixed(2)}%`);
        console.log(`    Deviation: ${deviation.toFixed(2)}%`);

        if (deviation > threshold) {
            needsRebalance = true;
            console.log(`    ⚠️  Needs rebalance (deviation > ${threshold}%)`);
        } else {
            console.log(`    ✅ Within threshold`);
        }
    }

    return needsRebalance;
}

/**
 * Helper function to add liquidity to Uniswap pools if needed
 */
async function addLiquidityIfNeeded(
    SLICE_ADDRESS: string,
    allocations: any[],
    baseToken: string,
    uniswapRouter: string,
    owner: any,
) {
    console.log("\n--- Checking if Liquidity Addition is Needed ---");

    const router = await ethers.getContractAt("IUniswapV2Router02", uniswapRouter);

    for (const allocation of allocations) {
        try {
            // Check if pool exists and has sufficient liquidity
            const path = [allocation.asset, baseToken];
            const testAmount = ethers.parseUnits("100", 18); // Test with 100 tokens

            try {
                await router.getAmountsOut(testAmount, path);
                console.log(`  ✅ ${allocation.asset} <-> ${baseToken}: Pool has sufficient liquidity`);
            } catch (error) {
                console.log(`  ⚠️  ${allocation.asset} <-> ${baseToken}: Pool needs liquidity`);
                console.log(`    Consider adding liquidity to this pool before rebalancing`);

                // You could add automatic liquidity addition here if you have the tokens
                // This would require having tokens in the owner's account
            }
        } catch (error) {
            console.log(`  ❌ Error checking pool for ${allocation.asset}: ${error}`);
        }
    }
}

async function main() {
    const SLICE_ADDRESS = await promptAddress("Slice Address"); // "0x3dcb72632dba519b981906cf982cb669c522eb21";

    console.log("Starting Slice Rebalance Process...");

    // Get signers
    const [owner] = await ethers.getSigners();
    console.log(`Using account: ${owner.address}`);

    // Get slice contract instance
    const slice = await ethers.getContractAt("Slice", SLICE_ADDRESS);
    console.log(`Connected to Slice contract: ${SLICE_ADDRESS}`);

    try {
        // Get Uniswap router and base token info
        const uniswapRouter = await slice.uniswapV2Router();
        const baseToken = await slice.baseToken();
        console.log(`Uniswap Router: ${uniswapRouter}`);
        console.log(`Base Token: ${baseToken}`);

        // Get current allocations before rebalance
        console.log("\n--- Current Allocations ---");
        const allocations = await slice.allocations();

        if (allocations.length === 0) {
            console.log("⚠️  No allocations found in the slice contract!");
            console.log("This means the slice hasn't been properly initialized with token allocations.");
            console.log("You need to call addAllocation() for each token before rebalancing.");
            return;
        }

        console.log(`Found ${allocations.length} allocation(s):`);

        // Check Uniswap pool liquidity before attempting rebalance
        console.log("\n--- Checking Uniswap Pool Liquidity ---");
        await checkPoolLiquidity(SLICE_ADDRESS, allocations, baseToken, uniswapRouter);

        // Check if liquidity addition is needed
        await addLiquidityIfNeeded(SLICE_ADDRESS, allocations, baseToken, uniswapRouter, owner);

        // Check if rebalance is actually needed
        const needsRebalance = await shouldRebalance(SLICE_ADDRESS, allocations, slice);

        if (!needsRebalance) {
            console.log("\n✅ Portfolio is already balanced within acceptable thresholds.");
            console.log("No rebalance needed at this time.");
            return;
        }

        for (let i = 0; i < allocations.length; i++) {
            const allocation = allocations[i];
            console.log(`Allocation ${i + 1}:`);
            console.log(`  aToken: ${allocation.aToken}`);
            console.log(`  Asset: ${allocation.asset}`);
            console.log(`  Target Percentage: ${Number(allocation.targetPercentage) / 100}%`);

            // Get current balance of aToken in slice
            const aTokenContract = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const currentBalance = await aTokenContract.balanceOf(SLICE_ADDRESS);
            console.log(`  Current Balance: ${ethers.formatUnits(currentBalance, 18)} aTokens`);
        }

        // Get total portfolio value before rebalance
        console.log("\n--- Portfolio Value Before Rebalance ---");
        let totalValue = 0;
        for (const allocation of allocations) {
            try {
                // Get price feed for the asset
                const priceFeedAddress = await slice.priceFeed(allocation.asset);
                console.log(`    DEBUG - Price Feed Address: ${priceFeedAddress}`);
                if (priceFeedAddress !== "0x0000000000000000000000000000000000000000") {
                    // Use slice contract's price function directly (matches contract logic)
                    const priceData = ethers.formatUnits(
                        await slice.getChainlinkDataFeedLatestAnswer(allocation.asset),
                        18,
                    );

                    console.log(`    DEBUG - Price Data: ${priceData}`);
                    const price = Number(priceData);

                    // Get current balance and convert to USD value
                    const aTokenContract = await ethers.getContractAt("AutoCompounder", allocation.aToken);
                    const currentBalance = await aTokenContract.balanceOf(SLICE_ADDRESS);
                    const exchangeRate = await aTokenContract.exchangeRate();
                    const aTokenDecimals = await aTokenContract.decimals();

                    // Debug logging
                    console.log(`    DEBUG - Price: ${price}`);
                    console.log(`    DEBUG - Current Balance: ${ethers.formatUnits(currentBalance, aTokenDecimals)}`);
                    console.log(`    DEBUG - Exchange Rate: ${ethers.formatUnits(exchangeRate, 18)}`);
                    console.log(`    DEBUG - aToken Decimals: ${aTokenDecimals}`);

                    // Convert aToken balance to underlying asset amount (using BigInt for precision)
                    const underlyingValue = (currentBalance * exchangeRate) / ethers.parseUnits("1", aTokenDecimals);

                    console.log(`    DEBUG - Underlying Value: ${ethers.formatUnits(underlyingValue, 18)}`);

                    // Get underlying value in USD (match slice contract formula exactly)
                    const usdValue = (underlyingValue * BigInt(price)) / 10n ** BigInt(aTokenDecimals);

                    console.log(`    DEBUG - USD Value: ${Number(usdValue)}`);
                    console.log(`  ${allocation.asset}: $${Number(usdValue).toFixed(2)}`);
                    totalValue += Number(usdValue);
                }
            } catch (error) {
                console.log(`  ${allocation.asset}: Unable to fetch price data`);
            }
        }
        console.log(`  Total Portfolio Value: $${totalValue.toFixed(2)}`);

        // Perform rebalance
        console.log("\n--- Executing Rebalance ---");

        try {
            const rebalanceTx = await slice.rebalance({
                gasLimit: 15000000,
            });
            console.log(`Rebalance transaction submitted: ${rebalanceTx.hash}`);
            // console.log(`Rebalance NOT transaction submitted just testing`);

            // Wait for transaction confirmation
            console.log("Waiting for transaction confirmation...");
            const receipt = await rebalanceTx.wait();
            console.log(`Transaction confirmed in block: ${receipt?.blockNumber}`);
            console.log(`Gas used: ${receipt?.gasUsed}`);
        } catch (error: any) {
            console.error("\n❌ Rebalance transaction failed!");

            if (error.message && error.message.includes("INSUFFICIENT_OUTPUT_AMOUNT")) {
                console.log("\n🔍 DIAGNOSIS: Uniswap Pool Liquidity Issue");
                console.log("The rebalance failed because there's insufficient liquidity in the Uniswap pools.");
                console.log("This typically happens when:");
                console.log("  1. The trading pairs don't have enough liquidity");
                console.log("  2. The swap amounts are too large for the available liquidity");
                console.log("  3. The pools haven't been properly initialized");
                console.log("\n💡 SOLUTIONS:");
                console.log("  1. Add more liquidity to the Uniswap pools");
                console.log("  2. Reduce the rebalance amounts by adjusting allocations");
                console.log("  3. Check if the token pairs have proper Uniswap pools");
                console.log("  4. Verify the Uniswap router address is correct");
                console.log("\n📊 Check the liquidity analysis above for specific pool issues.");
            } else {
                console.log(`\nError details: ${error.message}`);
            }
            throw error;
        }

        // Get allocations after rebalance
        console.log("\n--- Allocations After Rebalance ---");
        for (let i = 0; i < allocations.length; i++) {
            const allocation = allocations[i];
            const aTokenContract = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const newBalance = await aTokenContract.balanceOf(SLICE_ADDRESS);
            console.log(`Allocation ${i + 1}:`);
            console.log(`  aToken: ${allocation.aToken}`);
            console.log(`  Asset: ${allocation.asset}`);
            console.log(`  Target Percentage: ${Number(allocation.targetPercentage) / 100}%`);
            console.log(`  New Balance: ${ethers.formatUnits(newBalance, 18)} aTokens`);
        }

        // Get total portfolio value after rebalance
        console.log("\n--- Portfolio Value After Rebalance ---");
        let newTotalValue = 0;
        for (const allocation of allocations) {
            try {
                const priceFeedAddress = await slice.priceFeed(allocation.asset);
                if (priceFeedAddress !== "0x0000000000000000000000000000000000000000") {
                    const priceFeed = await ethers.getContractAt("AggregatorV3Interface", priceFeedAddress);
                    const priceData = await priceFeed.latestRoundData();
                    // const price = Number(ethers.formatUnits(priceData.answer, 8));

                    const price = Number(ethers.formatUnits(priceData.answer, 18)); // Raw price feed answer

                    const aTokenContract = await ethers.getContractAt("AutoCompounder", allocation.aToken);
                    const newBalance = await aTokenContract.balanceOf(SLICE_ADDRESS);
                    const exchangeRate = await aTokenContract.exchangeRate();

                    const underlyingAmount = (Number(newBalance) * Number(exchangeRate)) / 1e18;
                    // const usdValue = underlyingAmount * price;
                    const usdValue = (underlyingAmount * price) / 10 ** 18; // Match slice contract division

                    console.log(`  ${allocation.asset}: $${usdValue.toFixed(2)}`);
                    newTotalValue += usdValue;
                }
            } catch (error) {
                console.log(`  ${allocation.asset}: Unable to fetch price data`);
            }
        }
        console.log(`  Total Portfolio Value: $${newTotalValue.toFixed(2)}`);

        console.log("\n✅ Slice rebalance completed successfully!");
    } catch (error) {
        console.error("❌ Error during slice rebalance:", error);
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
