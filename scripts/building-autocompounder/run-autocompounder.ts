import { ethers } from "hardhat";
import { RewardsVaultAutoCompounder } from "../../typechain-types";
import { promptBuilding } from "../building/prompt-building";

// Description: 🔄 - Run AutoCompounder
async function main() {
    console.log("🔄 Run AutoCompounder");
    console.log("==============================");

    // Prompt user for building address, else use first building from building factory
    const buildingDetails = await promptBuilding();
    const autoCompounderAddress = buildingDetails.autoCompounder;

    // Get the AutoCompounder contract
    const autoCompounder = (await ethers.getContractAt(
        "RewardsVaultAutoCompounder",
        autoCompounderAddress,
    )) as RewardsVaultAutoCompounder;

    console.log("📋 1. Basic Configuration");
    console.log("========================");

    // Get basic configuration
    const vault = await autoCompounder.vault();
    const asset = await autoCompounder.asset();
    const owner = await autoCompounder.owner();
    const name = await autoCompounder.name();
    const symbol = await autoCompounder.symbol();
    const decimals = await autoCompounder.decimals();

    console.log("Vault Address:", vault);
    console.log("Asset Address:", asset);
    console.log("Owner:", owner);
    console.log("Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals);

    console.log("\n📊 2. Swap Configuration");
    console.log("=======================");

    // Get swap configuration
    const intermediateToken = await autoCompounder.INTERMEDIATE_TOKEN();
    const minThreshold = await autoCompounder.minimumClaimThreshold();
    const maxSlippage = await autoCompounder.maxSlippage();

    console.log("Intermediate Token:", intermediateToken);
    console.log("Min Claim Threshold:", ethers.formatUnits(minThreshold, 6), "USDC");
    console.log("Max Slippage:", maxSlippage.toString(), "basis points");

    console.log("\n💰 3. Asset Information");
    console.log("======================");

    // Get asset information
    const assetContract = await ethers.getContractAt("contracts/vaultV2/IERC20.sol:IERC20", asset);
    const assetName = (await assetContract.name?.()) || "Unknown";
    const assetSymbol = (await assetContract.symbol?.()) || "Unknown";
    const assetDecimals = (await assetContract.decimals?.()) || 18;

    console.log("Asset Name:", assetName);
    console.log("Asset Symbol:", assetSymbol);
    console.log("Asset Decimals:", assetDecimals);

    console.log("\n🏦 4. Vault Information");
    console.log("======================");

    // Get vault information
    const vaultContract = await ethers.getContractAt("RewardsVault4626", vault);
    const vaultTotalAssets = await vaultContract.totalAssets();
    const vaultTotalSupply = await vaultContract.totalSupply();

    console.log("Vault Total Assets:", ethers.formatUnits(vaultTotalAssets, assetDecimals));
    console.log("Vault Total Supply:", ethers.formatUnits(vaultTotalSupply, decimals));

    console.log("\n🎯 5. Reward Tokens Analysis");
    console.log("===========================");

    // Get reward tokens from vault
    const rewardTokensLength = await vaultContract.getRewardTokensLength();
    console.log("Number of Reward Tokens:", rewardTokensLength.toString());

    for (let i = 0; i < rewardTokensLength; i++) {
        const rewardToken = await vaultContract.rewardTokens(i);
        const rewardTokenContract = await ethers.getContractAt("contracts/vaultV2/IERC20.sol:IERC20", rewardToken);

        try {
            const rewardTokenName = (await rewardTokenContract.name?.()) || "Unknown";
            const rewardTokenSymbol = (await rewardTokenContract.symbol?.()) || "Unknown";
            const rewardTokenDecimals = (await rewardTokenContract.decimals?.()) || 18;

            console.log(`\nReward Token ${i}:`);
            console.log("  Address:", rewardToken);
            console.log("  Name:", rewardTokenName);
            console.log("  Symbol:", rewardTokenSymbol);
            console.log("  Decimals:", rewardTokenDecimals);

            // Check balance in AutoCompounder
            const balance = await rewardTokenContract.balanceOf(autoCompounderAddress);
            console.log("  Balance in AutoCompounder:", ethers.formatUnits(balance, rewardTokenDecimals));

            // Check if balance meets minimum threshold
            const meetsThreshold = balance >= minThreshold;
            console.log("  Meets Min Threshold:", meetsThreshold);

            // Check swap path
            const swapPath = await autoCompounder.getSwapPath(rewardToken);
            console.log("  Swap Path Length:", swapPath.length);
            if (swapPath.length > 0) {
                console.log("  Swap Path:", swapPath);
            } else {
                console.log("  ⚠️  No swap path configured!");
            }

            // Test swap if balance is sufficient
            if (balance > 0) {
                try {
                    const testAmount = balance > minThreshold ? minThreshold : balance;
                    const amountOut = await autoCompounder.testSwap(rewardToken, testAmount);
                    console.log("  Test Swap Result:", ethers.formatUnits(amountOut, assetDecimals), assetSymbol);
                } catch (error) {
                    console.log("  ❌ Test Swap Failed:", error.message);
                }
            }
        } catch (error) {
            console.log(`\nReward Token ${i}:`);
            console.log("  Address:", rewardToken);
            console.log("  ❌ Error getting token info:", error.message);
        }
    }

    console.log("\n📈 6. AutoCompounder State");
    console.log("==========================");

    // Get AutoCompounder state
    const totalAssets = await autoCompounder.totalAssets();
    const totalSupply = await autoCompounder.totalSupply();
    const exchangeRate = await autoCompounder.exchangeRate();

    console.log("Total Assets:", ethers.formatUnits(totalAssets, assetDecimals));
    console.log("Total Supply:", ethers.formatUnits(totalSupply, decimals));
    console.log("Exchange Rate:", ethers.formatUnits(exchangeRate, 18));

    console.log("\n🔧 7. Recommended Fixes");
    console.log("======================");

    // Check for common issues and provide fixes
    let hasIssues = false;

    for (let i = 0; i < rewardTokensLength; i++) {
        const rewardToken = await vaultContract.rewardTokens(i);
        const swapPath = await autoCompounder.getSwapPath(rewardToken);

        if (swapPath.length === 0) {
            hasIssues = true;
            const rewardTokenContract = await ethers.getContractAt("contracts/vaultV2/IERC20.sol:IERC20", rewardToken);
            const rewardTokenSymbol = (await rewardTokenContract.symbol?.()) || "Unknown";

            console.log(`\n⚠️  Issue: No swap path for ${rewardTokenSymbol} (${rewardToken})`);
            console.log("Fix: Set swap path using:");
            console.log(`await autoCompounder.setSwapPath("${rewardToken}", ["${rewardToken}", "${asset}"]);`);

            // If it's not the asset itself, suggest intermediate token path
            if (rewardToken !== asset) {
                console.log(`// OR with intermediate token:`);
                console.log(
                    `await autoCompounder.setSwapPath("${rewardToken}", ["${rewardToken}", "${intermediateToken}", "${asset}"]);`,
                );
            }
        }
    }

    if (!hasIssues) {
        console.log("✅ No obvious configuration issues found.");
    }

    console.log("\n🧪 8. Test AutoCompound");
    console.log("======================");

    // Check if we can call autoCompound
    try {
        console.log("Attempting to call autoCompound...");
        const tx = await autoCompounder.autoCompound();
        console.log("✅ AutoCompound transaction sent:", tx.hash);

        // Wait for transaction to be mined
        const receipt = await tx.wait();
        console.log("✅ Transaction mined in block:", receipt.blockNumber);

        // Check events
        const autoCompoundEvent = receipt.logs.find((log) => {
            try {
                const parsed = autoCompounder.interface.parseLog(log);
                return parsed.name === "AutoCompound";
            } catch {
                return false;
            }
        });

        if (autoCompoundEvent) {
            const parsed = autoCompounder.interface.parseLog(autoCompoundEvent);
            console.log("📊 AutoCompound Event:");
            console.log(
                "  Total Assets Reinvested:",
                ethers.formatUnits(parsed.args.totalAssetsReinvested, assetDecimals),
            );
            console.log("  Swap Count:", parsed.args.swapCount.toString());
        }

        // Check for TokenSwapped events
        const swapEvents = receipt.logs.filter((log) => {
            try {
                const parsed = autoCompounder.interface.parseLog(log);
                return parsed.name === "TokenSwapped";
            } catch {
                return false;
            }
        });

        if (swapEvents.length > 0) {
            console.log("🔄 Token Swapped Events:");
            swapEvents.forEach((event, index) => {
                const parsed = autoCompounder.interface.parseLog(event);
                console.log(`  Swap ${index + 1}:`);
                console.log(`    From: ${parsed.args.fromToken}`);
                console.log(`    To: ${parsed.args.toToken}`);
                console.log(`    Amount In: ${ethers.formatUnits(parsed.args.amountIn, 6)}`);
                console.log(`    Amount Out: ${ethers.formatUnits(parsed.args.amountOut, assetDecimals)}`);
            });
        } else {
            console.log("⚠️  No TokenSwapped events found - swaps may have failed");
        }
    } catch (error) {
        console.log("❌ AutoCompound failed:", error.message);
    }

    console.log("\n🏁 Debug Complete");
    console.log("=================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
