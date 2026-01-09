import { ethers } from "hardhat";

/**
 * Script to upgrade the BuildingGovernance implementation
 *
 * This script:
 * 1. Deploys a new BuildingGovernance implementation with the proposalThreshold fix
 * 2. Outputs instructions for upgrading the beacon
 *
 * The fix adds: proposalThreshold() returns 0 - which bypasses the getPastVotes check
 * that was causing "ERC20Votes: future lookup" errors on Hedera.
 *
 * Run with: yarn hardhat run scripts/upgrade-governance.ts --network testnet
 */

// If you know your governance beacon address, set it here:
const GOVERNANCE_BEACON_ADDRESS = ""; // e.g., "0x1234..."

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("=========================================");
    console.log("BuildingGovernance Upgrade Script");
    console.log("=========================================");
    console.log("Deployer account:", deployer.address);
    console.log("");

    // Deploy new governance implementation
    console.log("Step 1: Deploying new BuildingGovernance implementation...");
    const governanceImplementation = await ethers.deployContract("BuildingGovernance");
    await governanceImplementation.waitForDeployment();
    const newImplementationAddress = await governanceImplementation.getAddress();
    console.log("✅ New BuildingGovernance implementation deployed at:", newImplementationAddress);
    console.log("");

    if (GOVERNANCE_BEACON_ADDRESS) {
        console.log("Step 2: Upgrading beacon at", GOVERNANCE_BEACON_ADDRESS);
        try {
            const governanceBeacon = await ethers.getContractAt("BuildingGovernanceBeacon", GOVERNANCE_BEACON_ADDRESS);
            const tx = await governanceBeacon.upgradeTo(newImplementationAddress);
            await tx.wait();
            console.log("✅ Beacon upgraded successfully!");
        } catch (error) {
            console.error("❌ Error upgrading beacon:", error);
            console.log("");
            console.log("You may need to upgrade manually. See instructions below.");
        }
    } else {
        console.log("Step 2: Manual upgrade required");
        console.log("=========================================");
        console.log("");
        console.log("To complete the upgrade, you need to call upgradeTo() on the governance beacon.");
        console.log("");
        console.log("Option A: If you have the beacon address, run this script again with:");
        console.log('  const GOVERNANCE_BEACON_ADDRESS = "your_beacon_address";');
        console.log("");
        console.log("Option B: Call the beacon's upgradeTo function manually:");
        console.log("  1. Find your BuildingGovernanceBeacon contract address");
        console.log("  2. Call: beacon.upgradeTo('" + newImplementationAddress + "')");
        console.log("");
        console.log("Option C: Use Hashscan or a contract interaction tool:");
        console.log("  1. Go to your BuildingGovernanceBeacon contract on Hashscan");
        console.log("  2. Call the 'upgradeTo' function with the new implementation address");
        console.log("  3. New implementation address:", newImplementationAddress);
    }

    console.log("");
    console.log("=========================================");
    console.log("What this fix does:");
    console.log("=========================================");
    console.log("The new implementation adds proposalThreshold() returning 0, which");
    console.log("bypasses the getPastVotes check that caused 'ERC20Votes: future lookup'");
    console.log("errors when creating proposals on Hedera.");
    console.log("");
    console.log("After upgrading, all existing governance contracts will automatically");
    console.log("use the new implementation. Users will be able to create proposals");
    console.log("without the timing error.");
    console.log("=========================================");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
