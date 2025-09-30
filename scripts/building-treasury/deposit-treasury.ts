import { ethers } from "hardhat";
import { usdcAddress } from "../../constants";
import { promptBuilding } from "../building/prompt-building";

// Description: 🏛️ - Deposit into Treasury
async function main() {
    console.log("🏛️  Deposit into Treasury Script");
    console.log("================================");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    // Prompt user for building address, else use first building from building factory
    const buildingDetails = await promptBuilding();
    const treasuryAddress = buildingDetails.treasury;

    // Configuration - Update these addresses
    const TREASURY_ADDRESS = treasuryAddress; // Update with your treasury address
    const USDC_ADDRESS = usdcAddress; // Update with USDC address

    // Deposit amount (adjust as needed)
    const DEPOSIT_AMOUNT = ethers.parseUnits("1000", 6); // 1000 USDC (6 decimals)

    console.log("\n📋 Configuration");
    console.log("================");
    console.log("Treasury Address:", TREASURY_ADDRESS);
    console.log("USDC Address:", USDC_ADDRESS);
    console.log("Amount to deposit:", ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC");

    try {
        // Get contracts
        const treasury = await ethers.getContractAt("Treasury", TREASURY_ADDRESS);
        const usdc = await ethers.getContractAt("@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20", USDC_ADDRESS);

        // Get treasury information
        console.log("\n📄 Treasury Information");
        console.log("======================");

        try {
            const usdcAddress = await treasury.usdc();
            const reserveAmount = await treasury.reserve();
            // const nPercentage = await treasury.nPercentage();
            // const mPercentage = await treasury.mPercentage();
            // const businessAddress = await treasury.businessAddress();

            console.log("USDC Address:", usdcAddress);
            console.log("Reserve Amount:", ethers.formatUnits(reserveAmount, 6), "USDC");
            // console.log("N Percentage:", nPercentage.toString(), "basis points");
            // console.log("M Percentage:", mPercentage.toString(), "basis points");
            // console.log("Business Address:", businessAddress);
        } catch (error) {
            console.log("⚠️  Could not get treasury details:", error.message);
        }

        // Check USDC balance
        console.log("\n💰 Checking USDC Balance");
        console.log("========================");

        const usdcBalance = await usdc.balanceOf(signer.address);
        console.log("Your USDC balance:", ethers.formatUnits(usdcBalance, 6), "USDC");

        if (usdcBalance < DEPOSIT_AMOUNT) {
            console.log("❌ Insufficient USDC balance");
            console.log(`Required: ${ethers.formatUnits(DEPOSIT_AMOUNT, 6)} USDC`);
            console.log(`Available: ${ethers.formatUnits(usdcBalance, 6)} USDC`);
            console.log("\n💡 You can mint USDC using:");
            console.log("yarn hardhat run scripts/mint-usdc.ts --network testnet");
            return;
        }

        console.log("✅ Sufficient USDC balance");

        // Check allowance
        console.log("\n🔐 Checking Allowance");
        console.log("====================");

        const allowance = await usdc.allowance(signer.address, TREASURY_ADDRESS);
        console.log("Current allowance:", ethers.formatUnits(allowance, 6), "USDC");

        if (allowance < DEPOSIT_AMOUNT) {
            console.log("🔓 Approving USDC...");
            const approveTx = await usdc.approve(TREASURY_ADDRESS, DEPOSIT_AMOUNT);
            await approveTx.wait();
            console.log("✅ USDC approved");
        } else {
            console.log("✅ Sufficient allowance");
        }

        // Check treasury balance before deposit
        console.log("\n📊 Treasury Balance Before");
        console.log("==========================");

        const treasuryBalanceBefore = await usdc.balanceOf(TREASURY_ADDRESS);
        console.log("Treasury USDC balance:", ethers.formatUnits(treasuryBalanceBefore, 6), "USDC");

        // Deposit into treasury
        console.log("\n💳 Depositing into Treasury...");
        console.log("=============================");

        const tx = await treasury.deposit(DEPOSIT_AMOUNT);
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
                const parsed = treasury.interface.parseLog(log);
                return parsed.name === "Deposit";
            } catch {
                return false;
            }
        });

        if (depositEvent) {
            const parsed = treasury.interface.parseLog(depositEvent);
            console.log("💳 Deposit Event:");
            console.log("  Depositor:", parsed.args.depositor);
            console.log("  Amount:", ethers.formatUnits(parsed.args.amount, 6), "USDC");
        }

        // Check treasury balance after deposit
        console.log("\n📊 Treasury Balance After");
        console.log("=========================");

        const treasuryBalanceAfter = await usdc.balanceOf(TREASURY_ADDRESS);
        const treasuryBalanceIncrease = BigInt(treasuryBalanceAfter - treasuryBalanceBefore);

        console.log("Treasury USDC balance:", ethers.formatUnits(treasuryBalanceAfter, 6), "USDC");
        console.log("Treasury balance increase:", ethers.formatUnits(treasuryBalanceIncrease, 6), "USDC");

        // Check your remaining balance
        const remainingBalance = await usdc.balanceOf(signer.address);
        const balanceDecrease = BigInt(usdcBalance - remainingBalance);
        console.log("Your remaining USDC balance:", ethers.formatUnits(remainingBalance, 6), "USDC");
        console.log("Your balance decrease:", ethers.formatUnits(balanceDecrease, 6), "USDC");

        // Verify the deposit was successful
        if (balanceDecrease === DEPOSIT_AMOUNT) {
            console.log("\n🎉 Treasury Deposit Successful!");
            console.log("==============================");
            console.log(`Deposited ${ethers.formatUnits(DEPOSIT_AMOUNT, 6)} USDC into treasury`);
            console.log("Funds have been distributed according to treasury rules");
            console.log(
                `Treasury balance increased by ${ethers.formatUnits(treasuryBalanceIncrease, 6)} USDC (M% portion)`,
            );
        } else {
            console.log("\n⚠️  Warning: Balance decrease doesn't match expected deposit amount");
            console.log("Expected deposit:", ethers.formatUnits(DEPOSIT_AMOUNT, 6), "USDC");
            console.log("Actual balance decrease:", ethers.formatUnits(balanceDecrease, 6), "USDC");
        }

        // Show distribution info
        console.log("\n📈 Fund Distribution");
        console.log("===================");
        console.log("The deposited funds are automatically distributed according to:");
        console.log("- N Percentage: Business operations");
        console.log("- M Percentage: Reserve fund");
        console.log("Check the treasury contract for specific distribution details");

        // Try to get distribution percentages
        try {
            const nPercentage = await treasury.nPercentage();
            const mPercentage = await treasury.mPercentage();
            const businessAddress = await treasury.businessAddress();

            const nAmount = (DEPOSIT_AMOUNT * nPercentage) / 10000n;
            const mAmount = DEPOSIT_AMOUNT - nAmount;

            console.log(`\n💰 Distribution Breakdown:`);
            console.log(
                `N% (${ethers.formatUnits(nPercentage, 2)}%): ${ethers.formatUnits(
                    nAmount,
                    6,
                )} USDC → Business (${businessAddress})`,
            );
            console.log(
                `M% (${ethers.formatUnits(mPercentage, 2)}%): ${ethers.formatUnits(
                    mAmount,
                    6,
                )} USDC → Treasury Reserve`,
            );
        } catch (error) {
            console.log("Could not retrieve distribution details:", error.message);
        }
    } catch (error) {
        console.log("❌ Failed to deposit into treasury:", error.message);

        if (error.message.includes("revert")) {
            console.log("\n💡 This might be a revert. Common causes:");
            console.log("- Insufficient USDC balance");
            console.log("- Insufficient allowance");
            console.log("- Invalid amount (zero or negative)");
            console.log("- Treasury contract not properly initialized");
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
