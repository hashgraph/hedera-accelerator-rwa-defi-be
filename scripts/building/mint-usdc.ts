import { ethers } from "hardhat";
import { USDC } from "../../typechain-types";
import { usdcAddress } from "../../constants";

// Description: 🪙 - Mint USDC
async function main() {
    console.log("💰 Mint USDC Script");
    console.log("==================");

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("Using signer:", signer.address);

    // USDC contract address from constants
    const USDC_CONTRACT_ADDRESS = usdcAddress;
    console.log("USDC Contract Address:", USDC_CONTRACT_ADDRESS);

    // Amount to mint (adjust as needed)
    const MINT_AMOUNT = ethers.parseUnits("10000", 6); // 10,000 USDC (6 decimals)
    console.log("Amount to mint:", ethers.formatUnits(MINT_AMOUNT, 6), "USDC");

    try {
        // Get USDC contract
        const usdc = (await ethers.getContractAt("USDC", USDC_CONTRACT_ADDRESS)) as USDC;

        // Check current balance
        const currentBalance = await usdc.balanceOf(signer.address);
        console.log("Current USDC balance:", ethers.formatUnits(currentBalance, 6), "USDC");

        // Mint USDC
        console.log("\n🪙 Minting USDC...");
        const tx = await usdc.mint(signer.address, MINT_AMOUNT);
        console.log("✅ Transaction sent:", tx.hash);

        // Wait for transaction to be mined
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check new balance
        const newBalance = await usdc.balanceOf(signer.address);
        console.log("New USDC balance:", ethers.formatUnits(newBalance, 6), "USDC");
        console.log("Minted amount:", ethers.formatUnits(newBalance - currentBalance, 6), "USDC");

        console.log("\n🎉 USDC Minted Successfully!");
        console.log("============================");
    } catch (error) {
        console.log("❌ Failed to mint USDC:", error.message);

        if (error.message.includes("revert")) {
            console.log("💡 This might be a revert. Common causes:");
            console.log("- Contract address is incorrect");
            console.log("- Contract doesn't have mint function");
            console.log("- Insufficient gas");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
