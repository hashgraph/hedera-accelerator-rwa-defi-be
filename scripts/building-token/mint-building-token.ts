import { ethers } from "hardhat";
import { promptBuilding } from "../building/prompt-building";

// Description: 🏗️ - Mint ERC3643 building token
async function main() {
    // Get signer
    const [signer] = await ethers.getSigners();

    console.log("🏗️  Mint Building Token Script");
    console.log("==============================");
    console.log("Using signer:", signer.address);

    // Prompt user for building address, else use first building from building factory
    const buildingDetails = await promptBuilding();
    const buildingTokenAddress = buildingDetails.erc3643Token;

    // Configuration - Update these addresses
    const BUILDING_TOKEN_ADDRESS = buildingTokenAddress; // Update with your building token address
    const RECIPIENT_ADDRESS = signer.address; // Update with recipient address

    // Amount to mint (adjust as needed)
    const MINT_AMOUNT = ethers.parseEther("1000"); // 1000 tokens (18 decimals)

    console.log("\n📋 Configuration");
    console.log("================");
    console.log("Building Token Address:", BUILDING_TOKEN_ADDRESS);
    console.log("Recipient Address:", RECIPIENT_ADDRESS);
    console.log("Amount to mint:", ethers.formatEther(MINT_AMOUNT), "tokens");

    try {
        // Get building token contract (ERC3643)
        const buildingToken = await ethers.getContractAt("IToken", BUILDING_TOKEN_ADDRESS);

        // Get token information
        const name = await buildingToken.name();
        const symbol = await buildingToken.symbol();
        const decimals = await buildingToken.decimals();
        const totalSupply = await buildingToken.totalSupply();

        console.log("\n📄 Token Information");
        console.log("===================");
        console.log("Name:", name);
        console.log("Symbol:", symbol);
        console.log("Decimals:", decimals);
        console.log("Current Total Supply:", ethers.formatUnits(totalSupply, decimals));

        // Check current balance
        const currentBalance = await buildingToken.balanceOf(RECIPIENT_ADDRESS);
        console.log("\n💰 Current Balance");
        console.log("==================");
        console.log("Recipient balance:", ethers.formatUnits(currentBalance, decimals), symbol);

        // Check if signer is an agent (required for minting)
        console.log("\n🔐 Checking Permissions");
        console.log("=======================");

        try {
            // Try to check if signer is an agent
            const agentRole = await buildingToken.AGENT_ROLE();
            const hasAgentRole = await buildingToken.hasRole(agentRole, signer.address);
            console.log("Signer has AGENT_ROLE:", hasAgentRole);

            if (!hasAgentRole) {
                console.log("❌ Signer does not have AGENT_ROLE required for minting");
                console.log("💡 You need to be an agent to mint ERC3643 tokens");
                return;
            }
        } catch (error) {
            console.log("⚠️  Could not check agent role:", error.message);
            console.log("💡 Proceeding with mint attempt...");
        }

        // Check if recipient is verified (required for ERC3643)
        console.log("\n✅ Checking Recipient Verification");
        console.log("===================================");

        try {
            const isVerified = await buildingToken.isVerified(RECIPIENT_ADDRESS);
            console.log("Recipient is verified:", isVerified);

            if (!isVerified) {
                console.log("❌ Recipient is not verified in the identity registry");
                console.log("💡 ERC3643 tokens require verified identities for minting");
                console.log("💡 You may need to register and verify the recipient identity first");
                return;
            }
        } catch (error) {
            console.log("⚠️  Could not check verification status:", error.message);
            console.log("💡 Proceeding with mint attempt...");
        }

        // Mint tokens
        console.log("\n🪙 Minting Building Tokens...");
        console.log("=============================");

        const tx = await buildingToken.mint(RECIPIENT_ADDRESS, MINT_AMOUNT);
        console.log("✅ Transaction sent:", tx.hash);

        // Wait for transaction to be mined
        console.log("⏳ Waiting for transaction to be mined...");
        const receipt = await tx.wait();
        console.log("✅ Transaction confirmed in block:", receipt.blockNumber);
        console.log("Gas used:", receipt.gasUsed.toString());

        // Check new balance
        const newBalance = await buildingToken.balanceOf(RECIPIENT_ADDRESS);
        const mintedAmount = newBalance - currentBalance;

        console.log("\n📊 Results");
        console.log("==========");
        console.log("Previous balance:", ethers.formatUnits(currentBalance, decimals), symbol);
        console.log("New balance:", ethers.formatUnits(newBalance, decimals), symbol);
        console.log("Minted amount:", ethers.formatUnits(mintedAmount, decimals), symbol);

        // Verify the mint was successful
        if (mintedAmount === MINT_AMOUNT) {
            console.log("\n🎉 Building Tokens Minted Successfully!");
            console.log("======================================");
            console.log(`Minted ${ethers.formatUnits(mintedAmount, decimals)} ${symbol} to ${RECIPIENT_ADDRESS}`);
        } else {
            console.log("\n⚠️  Warning: Minted amount doesn't match expected amount");
            console.log("Expected:", ethers.formatUnits(MINT_AMOUNT, decimals), symbol);
            console.log("Actual:", ethers.formatUnits(mintedAmount, decimals), symbol);
        }

        // Check final total supply
        const finalTotalSupply = await buildingToken.totalSupply();
        console.log("Final total supply:", ethers.formatUnits(finalTotalSupply, decimals), symbol);
    } catch (error) {
        console.log("❌ Failed to mint building tokens:", error.message);

        if (error.message.includes("revert")) {
            console.log("\n💡 This might be a revert. Common causes:");
            console.log("- Signer is not an agent (AGENT_ROLE required)");
            console.log("- Recipient is not verified in identity registry");
            console.log("- Compliance rules not met");
            console.log("- Invalid token address");
            console.log("- Insufficient gas");
        } else if (error.message.includes("Identity is not verified")) {
            console.log("\n💡 Identity verification error:");
            console.log("- The recipient address must be verified in the identity registry");
            console.log("- You may need to register and verify the identity first");
        } else if (error.message.includes("Compliance not followed")) {
            console.log("\n💡 Compliance error:");
            console.log("- The token has compliance rules that prevent this mint");
            console.log("- Check the compliance modules and their requirements");
        } else if (error.message.includes("onlyAgent")) {
            console.log("\n💡 Permission error:");
            console.log("- Only agents can mint ERC3643 tokens");
            console.log("- You need to be granted the AGENT_ROLE");
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
