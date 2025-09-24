import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

// Description: 📍 - Get contract addresses
async function main() {
    console.log("📍 Get Contract Addresses");
    console.log("=========================");

    // Load deployment data
    const deploymentPath = path.join(__dirname, "../../data/deployments/chain-296.json");
    let deploymentData;

    try {
        const deploymentFile = fs.readFileSync(deploymentPath, "utf8");
        deploymentData = JSON.parse(deploymentFile);
        console.log("✅ Loaded deployment data");
    } catch (error) {
        console.log("❌ Could not load deployment data:", error.message);
        return;
    }

    console.log("\n📋 Deployed Contract Addresses");
    console.log("==============================");

    console.log("\n🏭 Factories:");
    Object.entries(deploymentData.factories).forEach(([name, address]) => {
        console.log(`  ${name}: ${address}`);
    });

    console.log("\n🔧 Implementations:");
    Object.entries(deploymentData.implementations).forEach(([name, address]) => {
        console.log(`  ${name}: ${address}`);
    });

    console.log("\n📚 Libraries:");
    Object.entries(deploymentData.libraries).forEach(([name, address]) => {
        console.log(`  ${name}: ${address}`);
    });

    console.log("\n🔒 Compliance Modules:");
    Object.entries(deploymentData.compliance).forEach(([name, address]) => {
        console.log(`  ${name}: ${address}`);
    });

    // Get signer
    const [signer] = await ethers.getSigners();
    console.log("\n👤 Current Signer:", signer.address);

    // Check if we have a building factory
    if (deploymentData.factories.BuildingFactory) {
        console.log("\n🏢 Building Factory Information");
        console.log("==============================");

        try {
            const buildingFactory = await ethers.getContractAt(
                "BuildingFactory",
                deploymentData.factories.BuildingFactory,
            );
            const buildingList = await buildingFactory.getBuildingList();

            console.log(`Number of deployed buildings: ${buildingList.length}`);

            if (buildingList.length > 0) {
                console.log("\n🏗️  Deployed Buildings:");
                for (let i = 0; i < buildingList.length; i++) {
                    const building = buildingList[i];
                    console.log(`  Building ${i + 1}:`);
                    console.log(`    Address: ${building.addr}`);
                    console.log(`    NFT ID: ${building.nftId}`);
                    console.log(`    Token URI: ${building.tokenURI}`);
                    console.log(`    ERC3643 Token: ${building.erc3643Token}`);
                    console.log(`    Treasury: ${building.treasury}`);
                    console.log(`    Governance: ${building.governance}`);
                    console.log(`    Vault: ${building.vault}`);
                    console.log(`    Auto Compounder: ${building.autoCompounder}`);
                    console.log(`    Audit Registry: ${building.auditRegistry}`);
                    console.log("");
                }
            } else {
                console.log("No buildings deployed yet.");
                console.log(
                    "Deploy a building first using: yarn hardhat run scripts/deploy-building.ts --network testnet",
                );
            }
        } catch (error) {
            console.log("❌ Error getting building information:", error.message);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Script failed:", error);
        process.exit(1);
    });
