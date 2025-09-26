import { ethers } from "hardhat";
import { promptAddress } from "../building/prompt-address";
import * as readline from "readline";

/**
 * Script to deposit into a slice to create an imbalance for testing rebalancing
 *
 * This script:
 * 1. Prompts user to select a slice contract
 * 2. Shows current allocations and balances
 * 3. Allows user to deposit to specific allocations
 * 4. Creates intentional imbalance for rebalancing tests
 * 5. Shows before/after portfolio state
 *
 * Usage: npx hardhat run scripts/building-slice/deposit-to-slice.ts --network testnet
 */

// Configuration
const DEPOSIT_AMOUNTS = {
    small: ethers.parseUnits("50", 18), // 50 tokens
    medium: ethers.parseUnits("100", 18), // 100 tokens
    large: ethers.parseUnits("200", 18), // 200 tokens
    custom: null, // Will be set by user input
};

/**
 * Get slice address from user
 */
async function getSliceAddress(): Promise<string> {
    console.log("🎯 Select Slice for Deposit");
    console.log("===========================");

    const sliceAddress = await promptAddress("Slice Address");

    if (!sliceAddress) {
        throw new Error("Slice address is required");
    }

    return sliceAddress;
}

/**
 * Display current slice state
 */
async function displaySliceState(sliceAddress: string) {
    console.log("\n📊 Current Slice State");
    console.log("======================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    if (allocations.length === 0) {
        console.log("❌ No allocations found in the slice contract!");
        console.log("💡 Use the setup-allocations.ts script to add allocations.");
        throw new Error("No allocations found");
    }

    console.log(`Slice Address: ${sliceAddress}`);
    console.log(`Total Allocations: ${allocations.length}`);

    let totalValue = 0;

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        console.log(`\n--- Allocation ${i + 1} ---`);
        console.log(`AutoCompounder: ${allocation.aToken}`);
        console.log(`Asset: ${allocation.asset}`);
        console.log(`Target Percentage: ${allocation.targetPercentage / 100n}%`);

        try {
            // Get slice's aToken balance
            const autoCompounder = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const aTokenBalance = await autoCompounder.balanceOf(sliceAddress);
            console.log(`Current aToken Balance: ${ethers.formatUnits(aTokenBalance, 18)} aTokens`);

            if (aTokenBalance > 0) {
                // Convert to underlying asset amount
                const exchangeRate = await autoCompounder.exchangeRate();
                const underlyingAmount = (aTokenBalance * exchangeRate) / ethers.parseUnits("1", 18);
                console.log(`Underlying Asset Amount: ${ethers.formatUnits(underlyingAmount, 18)} tokens`);

                // Get USD value
                try {
                    const price = ethers.formatUnits(
                        await slice.getChainlinkDataFeedLatestAnswer(allocation.asset),
                        18,
                    );
                    const usdValue = (underlyingAmount * BigInt(Number(price))) / 10n ** 18n;
                    console.log(`USD Value: $${usdValue.toLocaleString()}`);
                    totalValue += Number(usdValue);
                } catch (error) {
                    console.log(`❌ Could not get price: ${error.message}`);
                }
            } else {
                console.log(`USD Value: $0`);
            }
        } catch (error) {
            console.log(`❌ Error getting allocation details: ${error.message}`);
        }
    }

    console.log(`\n📈 Total Portfolio Value: $${totalValue.toLocaleString()}`);
    return { allocations, totalValue };
}

/**
 * Get deposit amount from user
 */
async function getDepositAmount(): Promise<bigint> {
    console.log("\n💰 Select Deposit Amount");
    console.log("========================");
    console.log("1. Small: 50 tokens");
    console.log("2. Medium: 100 tokens");
    console.log("3. Large: 200 tokens");
    console.log("4. Custom amount");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const userInput = await new Promise<string>((resolve) => {
        rl.question("Enter choice (1-4): ", (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

    switch (userInput) {
        case "1":
            return DEPOSIT_AMOUNTS.small;
        case "2":
            return DEPOSIT_AMOUNTS.medium;
        case "3":
            return DEPOSIT_AMOUNTS.large;
        case "4":
            const customRl = readline.createInterface({
                input: process.stdin,
                output: process.stdout,
            });

            const customAmount = await new Promise<string>((resolve) => {
                customRl.question("Enter custom amount (tokens): ", (answer) => {
                    customRl.close();
                    resolve(answer.trim());
                });
            });
            return ethers.parseUnits(customAmount, 18);
        default:
            console.log("Invalid choice, using medium amount (100 tokens)");
            return DEPOSIT_AMOUNTS.medium;
    }
}

/**
 * Get allocation to deposit to
 */
async function getTargetAllocation(allocations: any[]): Promise<number> {
    console.log("\n🎯 Select Target Allocation");
    console.log("===========================");

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];
        console.log(`${i + 1}. AutoCompounder: ${allocation.aToken}`);
        console.log(`   Asset: ${allocation.asset}`);
        console.log(`   Target: ${allocation.targetPercentage / 100n}%`);
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const userInput = await new Promise<string>((resolve) => {
        rl.question(`Enter allocation number (1-${allocations.length}): `, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

    const allocationIndex = parseInt(userInput) - 1;

    if (allocationIndex < 0 || allocationIndex >= allocations.length) {
        console.log("Invalid choice, using allocation 1");
        return 0;
    }

    return allocationIndex;
}

/**
 * Perform deposit to slice
 */
async function performDeposit(
    sliceAddress: string,
    allocationIndex: number,
    depositAmount: bigint,
    allocations: any[],
) {
    const [owner] = await ethers.getSigners();
    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocation = allocations[allocationIndex];

    console.log(`\n💳 Performing Deposit`);
    console.log("====================");
    console.log(`Target Allocation: ${allocationIndex + 1}`);
    console.log(`AutoCompounder: ${allocation.aToken}`);
    console.log(`Asset: ${allocation.asset}`);
    console.log(`Deposit Amount: ${ethers.formatUnits(depositAmount, 18)} tokens`);

    try {
        // Get asset token contract
        const assetToken = await ethers.getContractAt("ERC20Mock", allocation.asset);

        // Check owner balance
        const ownerBalance = await assetToken.balanceOf(owner.address);
        console.log(`Owner Balance: ${ethers.formatUnits(ownerBalance, 18)} tokens`);

        if (ownerBalance < depositAmount) {
            console.log(
                `❌ Insufficient balance! Need ${ethers.formatUnits(depositAmount, 18)}, have ${ethers.formatUnits(
                    ownerBalance,
                    18,
                )}`,
            );

            // Try to mint tokens if possible
            try {
                console.log("Attempting to mint tokens...");
                await assetToken.mint(owner.address, depositAmount);
                console.log(`✅ Minted ${ethers.formatUnits(depositAmount, 18)} tokens`);
            } catch (error) {
                console.log(`❌ Could not mint tokens: ${error.message}`);
                throw new Error("Insufficient balance and cannot mint");
            }
        }

        // Approve slice to spend tokens
        console.log("Approving slice to spend tokens...");
        await assetToken.approve(sliceAddress, depositAmount);

        // Perform deposit
        console.log("Depositing to slice...");
        const depositTx = await slice.deposit(allocation.aToken, depositAmount);
        await depositTx.wait();

        console.log(`✅ Deposit successful! Transaction: ${depositTx.hash}`);
        console.log(`Deposited ${ethers.formatUnits(depositAmount, 18)} tokens to allocation ${allocationIndex + 1}`);

        return depositTx;
    } catch (error: any) {
        console.error(`❌ Deposit failed: ${error.message}`);

        if (error.message.includes("execution reverted")) {
            console.log("💡 This might be due to:");
            console.log("   - ERC3643 compliance restrictions");
            console.log("   - Insufficient allowance");
            console.log("   - Slice contract issues");
        }

        throw error;
    }
}

/**
 * Display updated slice state after deposit
 */
async function displayUpdatedState(sliceAddress: string) {
    console.log("\n📊 Updated Slice State");
    console.log("======================");

    const slice = await ethers.getContractAt("Slice", sliceAddress);
    const allocations = await slice.allocations();

    let totalValue = 0;
    const allocationValues: number[] = [];

    for (let i = 0; i < allocations.length; i++) {
        const allocation = allocations[i];

        console.log(`\n--- Allocation ${i + 1} ---`);
        console.log(`Target Percentage: ${allocation.targetPercentage / 100n}%`);

        try {
            const autoCompounder = await ethers.getContractAt("AutoCompounder", allocation.aToken);
            const aTokenBalance = await autoCompounder.balanceOf(sliceAddress);
            console.log(`Current aToken Balance: ${ethers.formatUnits(aTokenBalance, 18)} aTokens`);

            if (aTokenBalance > 0) {
                const exchangeRate = await autoCompounder.exchangeRate();
                const underlyingAmount = (aTokenBalance * exchangeRate) / ethers.parseUnits("1", 18);

                try {
                    const priceData = ethers.formatUnits(
                        await slice.getChainlinkDataFeedLatestAnswer(allocation.asset),
                        18,
                    );

                    const price = Number(priceData);
                    const usdValue = (underlyingAmount * BigInt(price)) / 10n ** 18n;
                    console.log(`USD Value: $${usdValue.toLocaleString()}`);
                    totalValue += Number(usdValue);
                    allocationValues.push(Number(usdValue));
                } catch (error) {
                    console.log(`❌ Could not get price`);
                    allocationValues.push(0);
                }
            } else {
                console.log(`USD Value: $0`);
                allocationValues.push(0);
            }
        } catch (error) {
            console.log(`❌ Error getting allocation details`);
            allocationValues.push(0);
        }
    }

    console.log(`\n📈 Total Portfolio Value: $${totalValue.toLocaleString()}`);

    // Show current vs target percentages
    if (totalValue > 0) {
        console.log("\n⚖️  Current vs Target Allocations:");
        for (let i = 0; i < allocations.length; i++) {
            const currentPercentage = (allocationValues[i] / totalValue) * 100;
            const targetPercentage = allocations[i].targetPercentage / 100n;
            const deviation = Math.abs(currentPercentage - Number(targetPercentage));

            console.log(
                `Allocation ${i + 1}: ${currentPercentage.toFixed(
                    2,
                )}% vs ${targetPercentage}% (deviation: ${deviation.toFixed(2)}%) ${deviation > 1 ? "⚠️" : "✅"}`,
            );
        }

        const needsRebalance = allocationValues.some((value, i) => {
            const currentPercentage = (value / totalValue) * 100;
            const targetPercentage = allocations[i].targetPercentage / 100n;
            return Math.abs(currentPercentage - Number(targetPercentage)) > 1;
        });

        console.log(`\nRebalance Status: ${needsRebalance ? "⚠️  REBALANCE NEEDED" : "✅ Balanced"}`);
    }
}

/**
 * Create multiple deposits to create imbalance
 */

async function main() {
    console.log("💰 Slice Deposit Script");
    console.log("=======================");
    console.log("This script deposits into a slice to create imbalances for testing rebalancing.");

    const [owner] = await ethers.getSigners();
    console.log(`Using account: ${owner.address}`);

    try {
        // Step 1: Get slice address
        const sliceAddress = await getSliceAddress();

        // Step 2: Display current state
        const { allocations, totalValue: initialValue } = await displaySliceState(sliceAddress);

        // Step 3: Get deposit details
        const depositAmount = await getDepositAmount();
        const allocationIndex = await getTargetAllocation(allocations);

        // Step 4: Perform deposit
        await performDeposit(sliceAddress, allocationIndex, depositAmount, allocations);

        // Step 5: Display updated state
        await displayUpdatedState(sliceAddress);

        console.log("\n✅ Deposit process complete!");
        console.log("\n📝 Next Steps:");
        console.log("1. Test rebalancing: npx hardhat run scripts/building-slice/rebalance-slice.ts --network testnet");
        console.log("2. Use the slice address above when prompted");
        console.log("3. The slice now has an imbalance and is ready for rebalancing tests!");
    } catch (error) {
        console.error("❌ Error during deposit process:", error);
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
