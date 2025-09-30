import { ethers } from "hardhat";
import { RewardsVaultAutoCompounder } from "../../typechain-types";
import { promptBuilding } from "../building/prompt-building";

// Description: 🎁 - Get user rewards
async function main() {
    console.log("🎁 Get User Rewards");
    console.log("===============================");

    // Prompt user for building address, else use first building from building factory
    const buildingDetails = await promptBuilding();
    const autoCompounderAddress = buildingDetails.autoCompounder;

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    try {
        // Get AutoCompounder contract
        const autoCompounder = (await ethers.getContractAt(
            "RewardsVaultAutoCompounder",
            autoCompounderAddress,
        )) as RewardsVaultAutoCompounder;

        // Get user information
        const userShares = await autoCompounder.balanceOf(signer.address);
        const userAssets = await autoCompounder.assetsOf(signer.address);
        const userInfo = await autoCompounder.getUserInfo(signer.address);
        const totalSupply = await autoCompounder.totalSupply();
        const totalAssets = await autoCompounder.totalAssets();

        console.log("\n👤 User Information");
        console.log("===================");
        console.log("Your Shares:", ethers.formatEther(userShares));
        console.log("Your Assets:", ethers.formatEther(userAssets));
        console.log("Total Deposited:", ethers.formatEther(userInfo.totalDeposited));
        console.log("Total Supply:", ethers.formatEther(totalSupply));
        console.log("Total Assets:", ethers.formatEther(totalAssets));

        if (userShares === 0n) {
            console.log("\n❌ You have no shares in the AutoCompounder");
            return;
        }

        // Calculate user's share percentage
        const userSharePercentage = (userShares * 10000n) / totalSupply;
        console.log("Your Share Percentage:", ethers.formatUnits(userSharePercentage, 2), "%");

        // Calculate rewards based on asset growth
        const initialDeposit = userInfo.totalDeposited;
        const currentAssets = userAssets;
        const assetGrowth = currentAssets - initialDeposit;

        console.log("\n💰 Reward Calculation");
        console.log("====================");
        console.log("Initial Deposit:", ethers.formatEther(initialDeposit), "tokens");
        console.log("Current Assets:", ethers.formatEther(currentAssets), "tokens");
        console.log("Asset Growth (Rewards):", ethers.formatEther(assetGrowth), "tokens");

        // Calculate percentage return
        const percentageReturn = (assetGrowth * 10000n) / initialDeposit;
        console.log("Percentage Return:", ethers.formatUnits(percentageReturn, 2), "%");

        // Get vault information
        const vault = await autoCompounder.vault();
        const vaultContract = await ethers.getContractAt("RewardsVault4626", vault);
        const rewardTokensLength = await vaultContract.getRewardTokensLength();

        console.log("\n🎁 Reward Token Analysis");
        console.log("=======================");
        console.log("Number of Reward Tokens:", rewardTokensLength.toString());

        for (let i = 0; i < rewardTokensLength; i++) {
            const rewardToken = await vaultContract.rewardTokens(i);
            const rewardTokenContract = await ethers.getContractAt("MockERC20", rewardToken);

            try {
                const rewardTokenSymbol = (await rewardTokenContract.symbol?.()) || "Unknown";
                const rewardTokenDecimals = (await rewardTokenContract.decimals?.()) || 18;

                console.log(`\nReward Token ${i + 1}: ${rewardTokenSymbol}`);
                console.log("=" + "=".repeat(rewardTokenSymbol.length + 15));

                // Get total claimable rewards for AutoCompounder from vault
                const totalClaimableRewards = await vaultContract.getClaimableReward(
                    autoCompounderAddress,
                    rewardToken,
                );
                console.log(
                    "Total Claimable Rewards (AutoCompounder):",
                    ethers.formatUnits(totalClaimableRewards, rewardTokenDecimals),
                    rewardTokenSymbol,
                );

                // Calculate user's proportional share of rewards
                const userRewards = (totalClaimableRewards * userShares) / totalSupply;
                console.log(
                    "Your Share of Claimable Rewards:",
                    ethers.formatUnits(userRewards, rewardTokenDecimals),
                    rewardTokenSymbol,
                );

                // Get current balance of reward token in AutoCompounder
                const currentBalance = await rewardTokenContract.balanceOf(autoCompounderAddress);
                console.log(
                    "Current Balance in AutoCompounder:",
                    ethers.formatUnits(currentBalance, rewardTokenDecimals),
                    rewardTokenSymbol,
                );

                // Calculate user's share of current balance
                const userCurrentBalance = (currentBalance * userShares) / totalSupply;
                console.log(
                    "Your Share of Current Balance:",
                    ethers.formatUnits(userCurrentBalance, rewardTokenDecimals),
                    rewardTokenSymbol,
                );
            } catch (error) {
                console.log(`\nReward Token ${i + 1}: Error getting info`);
                console.log("Error:", error.message);
            }
        }

        console.log("\n📊 Summary");
        console.log("==========");
        console.log("Your Share Percentage:", ethers.formatUnits(userSharePercentage, 2), "%");
        console.log("Total Rewards Earned:", ethers.formatEther(assetGrowth), "tokens");
        console.log("Percentage Return:", ethers.formatUnits(percentageReturn, 2), "%");

        console.log("\n💡 Key Insights");
        console.log("===============");
        console.log(
            "✅ Your assets have grown from",
            ethers.formatEther(initialDeposit),
            "to",
            ethers.formatEther(currentAssets),
        );
        console.log("✅ This represents", ethers.formatEther(assetGrowth), "tokens in rewards");
        console.log("✅ Your return is", ethers.formatUnits(percentageReturn, 2), "%");
        console.log("✅ Rewards are automatically compounded into your share value");
    } catch (error) {
        console.log("❌ Failed to get user rewards:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
