import { ethers } from "hardhat";
import { RewardsVaultAutoCompounder } from "../../typechain-types";
import { promptBuilding } from "../building/prompt-building";

// Description: 💰 - Deposit into RewardsVaultAutoCompounder
async function main() {
    console.log("💰 Deposit into RewardsVaultAutoCompounder");
    console.log("==========================================");

    const buildingDetails = await promptBuilding();
    const autoCompounderAddress = buildingDetails.autoCompounder;

    console.log("🏢 AutoCompounder Address:", autoCompounderAddress, "\n");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    // Deposit amount (adjust as needed)
    const DEPOSIT_AMOUNT = ethers.parseEther("100"); // 100 tokens (18 decimals)
    console.log("Amount to deposit:", ethers.formatEther(DEPOSIT_AMOUNT), "tokens");

    try {
        // Get AutoCompounder contract
        const autoCompounder = (await ethers.getContractAt(
            "RewardsVaultAutoCompounder",
            autoCompounderAddress,
        )) as RewardsVaultAutoCompounder;

        // Get vault and asset information
        const vault = await autoCompounder.vault();
        const asset = await autoCompounder.asset();
        const name = await autoCompounder.name();
        const symbol = await autoCompounder.symbol();

        console.log("\n📋 AutoCompounder Information");
        console.log("=============================");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Vault Address:", vault);
        console.log("Asset Address:", asset);

        // Get asset contract
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

        // Check current balances
        console.log("\n💰 Current Balances");
        console.log("===================");

        const assetBalance = await assetContract.balanceOf(signer.address);
        const autoCompounderBalance = await autoCompounder.balanceOf(signer.address);
        const totalAssets = await autoCompounder.totalAssets();
        const totalSupply = await autoCompounder.totalSupply();
        const exchangeRate = await autoCompounder.exchangeRate();

        console.log("Your Asset Balance:", ethers.formatUnits(assetBalance, assetDecimals), assetSymbol);
        console.log("Your AutoCompounder Shares:", ethers.formatEther(autoCompounderBalance));
        console.log("Total Assets in AutoCompounder:", ethers.formatUnits(totalAssets, assetDecimals), assetSymbol);
        console.log("Total AutoCompounder Supply:", ethers.formatEther(totalSupply));
        console.log("Exchange Rate:", ethers.formatEther(exchangeRate));

        // Check if we have enough assets
        if (assetBalance < DEPOSIT_AMOUNT) {
            console.log("❌ Insufficient asset balance");
            console.log(`Required: ${ethers.formatUnits(DEPOSIT_AMOUNT, assetDecimals)} ${assetSymbol}`);
            console.log(`Available: ${ethers.formatUnits(assetBalance, assetDecimals)} ${assetSymbol}`);
            return;
        }

        console.log("✅ Sufficient asset balance");

        // Check allowance
        console.log("\n🔐 Checking Allowance");
        console.log("====================");

        const allowance = await assetContract.allowance(signer.address, autoCompounderAddress);
        console.log("Current allowance:", ethers.formatUnits(allowance, assetDecimals), assetSymbol);

        if (allowance < DEPOSIT_AMOUNT) {
            console.log("🔓 Approving asset...");
            const approveTx = await assetContract.approve(autoCompounderAddress, DEPOSIT_AMOUNT);
            await approveTx.wait();
            console.log("✅ Asset approved");
        } else {
            console.log("✅ Sufficient allowance");
        }

        // Get user info before deposit
        console.log("\n👤 User Info Before Deposit");
        console.log("===========================");

        const userInfoBefore = await autoCompounder.getUserInfo(signer.address);
        console.log("Deposit Timestamp:", userInfoBefore.depositTimestamp.toString());
        console.log("Total Deposited:", ethers.formatUnits(userInfoBefore.totalDeposited, assetDecimals), assetSymbol);

        // Calculate expected shares
        // console.log("\n📊 Expected Results");
        // console.log("===================");

        // const expectedShares = await autoCompounder.previewDeposit(DEPOSIT_AMOUNT);
        // console.log("Expected shares to receive:", ethers.formatEther(expectedShares));

        // Deposit into AutoCompounder
        console.log("\n💳 Depositing into AutoCompounder...");
        console.log("====================================");

        const tx = await autoCompounder.deposit(DEPOSIT_AMOUNT, signer.address);
        console.log("✅ Transaction sent:", tx.hash);

        // Wait for transaction to be mined
        console.log("⏳ Waiting for transaction to be mined...");
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Parse events
        console.log("\n📋 Transaction Events");
        console.log("====================");

        // Look for Deposit event
        const depositEvent = receipt.logs.find((log) => {
            try {
                const parsed = autoCompounder.interface.parseLog(log);
                return parsed.name === "Deposit";
            } catch {
                return false;
            }
        });

        if (depositEvent) {
            const parsed = autoCompounder.interface.parseLog(depositEvent);
            console.log("💳 Deposit Event:");
            console.log("  User:", parsed.args.user);
            console.log("  Assets:", ethers.formatUnits(parsed.args.assets, assetDecimals), assetSymbol);
            console.log("  Shares:", ethers.formatEther(parsed.args.shares));
        }

        // Check final balances
        console.log("\n📊 Final Results");
        console.log("================");

        const finalAssetBalance = await assetContract.balanceOf(signer.address);
        const finalAutoCompounderBalance = await autoCompounder.balanceOf(signer.address);
        const finalTotalAssets = await autoCompounder.totalAssets();
        const finalTotalSupply = await autoCompounder.totalSupply();
        const finalExchangeRate = await autoCompounder.exchangeRate();

        console.log("Your Asset Balance:", ethers.formatUnits(finalAssetBalance, assetDecimals), assetSymbol);
        console.log("Your AutoCompounder Shares:", ethers.formatEther(finalAutoCompounderBalance));
        console.log(
            "Total Assets in AutoCompounder:",
            ethers.formatUnits(finalTotalAssets, assetDecimals),
            assetSymbol,
        );
        console.log("Total AutoCompounder Supply:", ethers.formatEther(finalTotalSupply));
        console.log("Exchange Rate:", ethers.formatEther(finalExchangeRate));

        // Calculate changes
        const assetChange = assetBalance - finalAssetBalance;
        const sharesChange = finalAutoCompounderBalance - autoCompounderBalance;

        console.log("\n📈 Changes");
        console.log("==========");
        console.log("Assets Deposited:", ethers.formatUnits(assetChange, assetDecimals), assetSymbol);
        console.log("Shares Received:", ethers.formatEther(sharesChange));

        // Get updated user info
        console.log("\n👤 User Info After Deposit");
        console.log("==========================");

        const userInfoAfter = await autoCompounder.getUserInfo(signer.address);
        console.log("Deposit Timestamp:", userInfoAfter.depositTimestamp.toString());
        console.log("Total Deposited:", ethers.formatUnits(userInfoAfter.totalDeposited, assetDecimals), assetSymbol);

        // Check if user can withdraw (based on vault's lock period)
        const canWithdraw = await autoCompounder.canWithdraw(signer.address);
        console.log("Can Withdraw:", canWithdraw);

        if (sharesChange > 0) {
            console.log("\n🎉 Deposit Successful!");
            console.log("=====================");
            console.log(`You deposited ${ethers.formatUnits(assetChange, assetDecimals)} ${assetSymbol}`);
            console.log(`You received ${ethers.formatEther(sharesChange)} ${symbol} shares`);
        } else {
            console.log("\n⚠️  No shares received - deposit may have failed");
        }
    } catch (error) {
        console.log("❌ Failed to deposit:", error.message);

        if (error.message.includes("revert")) {
            console.log("\n💡 This might be a revert. Common causes:");
            console.log("- Insufficient asset balance");
            console.log("- Insufficient allowance");
            console.log("- Invalid amount (zero)");
            console.log("- Invalid receiver address");
            console.log("- Vault deposit failed");
        } else if (error.message.includes("nonce")) {
            console.log("\n💡 Nonce error - try again in a moment");
        } else if (error.message.includes("gas")) {
            console.log("\n💡 Gas error - try increasing gas limit");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
