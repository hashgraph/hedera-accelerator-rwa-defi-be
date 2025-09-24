import { ethers } from "hardhat";
import { RewardsVaultAutoCompounder } from "../../typechain-types";
import { promptBuilding } from "../building/prompt-building";

// Description: 📊 - Check AutoCompounder status
async function main() {
    console.log("📊 Check AutoCompounder Status");
    console.log("==============================");

    // Prompt user for building address, else use first building from building factory
    const buildingDetails = await promptBuilding();
    const autoCompounderAddress = buildingDetails.autoCompounder;

    console.log("🏢 AutoCompounder Address:", autoCompounderAddress, "\n");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    try {
        // Get AutoCompounder contract
        const autoCompounder = (await ethers.getContractAt(
            "RewardsVaultAutoCompounder",
            autoCompounderAddress,
        )) as RewardsVaultAutoCompounder;

        // Basic information
        console.log("\n📋 AutoCompounder Information");
        console.log("=============================");

        const name = await autoCompounder.name();
        const symbol = await autoCompounder.symbol();
        const decimals = await autoCompounder.decimals();
        const vault = await autoCompounder.vault();
        const asset = await autoCompounder.asset();

        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Decimals:", decimals);
        console.log("Vault Address:", vault);
        console.log("Asset Address:", asset);

        // Asset information
        const assetContract = await ethers.getContractAt(
            "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
            asset,
        );
        const assetName = (await assetContract.name?.()) || "Unknown";
        const assetSymbol = (await assetContract.symbol?.()) || "Unknown";
        const assetDecimals = (await assetContract.decimals?.()) || 18;

        console.log("Asset Name:", assetName);
        console.log("Asset Symbol:", assetSymbol);
        console.log("Asset Decimals:", assetDecimals);

        // AutoCompounder state
        console.log("\n📊 AutoCompounder State");
        console.log("=======================");

        const totalAssets = await autoCompounder.totalAssets();
        const totalSupply = await autoCompounder.totalSupply();
        const exchangeRate = await autoCompounder.exchangeRate();

        console.log("Total Assets:", ethers.formatUnits(totalAssets, assetDecimals), assetSymbol);
        console.log("Total Supply:", ethers.formatEther(totalSupply), symbol);
        console.log("Exchange Rate:", ethers.formatEther(exchangeRate));

        // User information
        console.log("\n👤 Your Information");
        console.log("===================");

        const userShares = await autoCompounder.balanceOf(signer.address);
        const userAssets = await autoCompounder.assetsOf(signer.address);
        const userInfo = await autoCompounder.getUserInfo(signer.address);
        const canWithdraw = await autoCompounder.canWithdraw(signer.address);

        console.log("Your Shares:", ethers.formatEther(userShares), symbol);
        console.log("Your Assets:", ethers.formatUnits(userAssets, assetDecimals), assetSymbol);
        console.log("Deposit Timestamp:", userInfo.depositTimestamp.toString());
        console.log("Total Deposited:", ethers.formatUnits(userInfo.totalDeposited, assetDecimals), assetSymbol);
        console.log("Can Withdraw:", canWithdraw);

        // Asset balance
        const assetBalance = await assetContract.balanceOf(signer.address);
        console.log("Your Asset Balance:", ethers.formatUnits(assetBalance, assetDecimals), assetSymbol);

        // Vault information
        console.log("\n🏦 Vault Information");
        console.log("===================");

        const vaultContract = await ethers.getContractAt("RewardsVault4626", vault);
        const vaultTotalAssets = await vaultContract.totalAssets();
        const vaultTotalSupply = await vaultContract.totalSupply();

        console.log("Vault Total Assets:", ethers.formatUnits(vaultTotalAssets, assetDecimals), assetSymbol);
        console.log("Vault Total Supply:", ethers.formatEther(vaultTotalSupply));

        // Reward tokens
        const rewardTokensLength = await vaultContract.getRewardTokensLength();
        console.log("Number of Reward Tokens:", rewardTokensLength.toString());

        if (rewardTokensLength > 0) {
            console.log("\n🎁 Reward Tokens");
            console.log("================");

            for (let i = 0; i < rewardTokensLength; i++) {
                const rewardToken = await vaultContract.rewardTokens(i);
                const rewardTokenContract = await ethers.getContractAt(
                    "@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20",
                    rewardToken,
                );

                try {
                    const rewardTokenSymbol = (await rewardTokenContract.symbol?.()) || "Unknown";
                    const rewardBalance = await rewardTokenContract.balanceOf(autoCompounderAddress);
                    const claimableReward = await vaultContract.getClaimableReward(autoCompounderAddress, rewardToken);

                    console.log(`\nReward Token ${i + 1}:`);
                    console.log("  Address:", rewardToken);
                    console.log("  Symbol:", rewardTokenSymbol);
                    console.log("  Balance in AutoCompounder:", ethers.formatUnits(rewardBalance, 18));
                    console.log("  Claimable Reward:", ethers.formatUnits(claimableReward, 18));
                } catch (error) {
                    console.log(`\nReward Token ${i + 1}:`);
                    console.log("  Address:", rewardToken);
                    console.log("  Error getting info:", error.message);
                }
            }
        }

        // AutoCompounder configuration
        console.log("\n⚙️  AutoCompounder Configuration");
        console.log("===============================");

        const minThreshold = await autoCompounder.minimumClaimThreshold();
        const maxSlippage = await autoCompounder.maxSlippage();
        const intermediateToken = await autoCompounder.INTERMEDIATE_TOKEN();

        console.log("Min Claim Threshold:", ethers.formatUnits(minThreshold, 6), "USDC");
        console.log("Max Slippage:", maxSlippage.toString(), "basis points");
        console.log("Intermediate Token:", intermediateToken);

        console.log("\n🏁 Status Check Complete");
        console.log("========================");
    } catch (error) {
        console.log("❌ Failed to check AutoCompounder:", error.message);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
