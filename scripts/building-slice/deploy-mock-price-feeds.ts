import { ethers } from "hardhat";

/**
 * Script to deploy MockV3Aggregator price feeds with reasonable values
 *
 * This script:
 * 1. Deploys multiple MockV3Aggregator contracts with different price values
 * 2. Updates the price feeds with realistic values for testing
 * 3. Provides the addresses for use in slice configurations
 * 4. Shows how to update prices dynamically
 *
 * Usage: npx hardhat run scripts/building-slice/deploy-mock-price-feeds.ts --network testnet
 */

// Price configurations for different tokens
const PRICE_CONFIGS = {
    // Standard tokens (like USDC, USDT)
    stablecoin: {
        decimals: 6,
        initialPrice: ethers.parseUnits("1", 6), // $1.00
        name: "Stablecoin Mock Price Feed",
    },

    // Building tokens (reasonable property values)
    building: {
        decimals: 18,
        initialPrice: ethers.parseUnits("1", 18), // $1.00
        name: "Building Token Mock Price Feed",
    },
};

/**
 * Deploy a single mock price feed
 */
async function deployMockPriceFeed(config: any, name: string): Promise<string> {
    console.log(`\n🔧 Deploying ${name}`);
    console.log(`Decimals: ${config.decimals}`);
    console.log(`Initial Price: $${ethers.formatUnits(config.initialPrice, config.decimals)}`);

    const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
    const mockPriceFeed = await MockV3Aggregator.deploy(config.decimals, config.initialPrice);

    await mockPriceFeed.waitForDeployment();
    const address = await mockPriceFeed.getAddress();

    console.log(`✅ Deployed: ${address}`);

    // Verify the deployment
    try {
        const latestData = await mockPriceFeed.latestRoundData();
        console.log(`✅ Verification - Price: $${ethers.formatUnits(latestData.answer, config.decimals)}`);
    } catch (error: any) {
        console.log(`❌ Verification failed: ${error.message}`);
    }

    return address;
}

/**
 * Deploy all mock price feeds
 */
async function deployAllMockPriceFeeds() {
    console.log("🏗️  Deploying Mock Price Feeds");
    console.log("===============================");

    const [owner] = await ethers.getSigners();
    console.log(`Using account: ${owner.address}`);

    const deployedFeeds: { [key: string]: string } = {};

    // Deploy different types of price feeds
    for (const [key, config] of Object.entries(PRICE_CONFIGS)) {
        deployedFeeds[key] = await deployMockPriceFeed(config, config.name);
    }

    return deployedFeeds;
}

/**
 * Show usage instructions
 */
function showUsageInstructions(deployedFeeds: { [key: string]: string }) {
    console.log("\n📋 Usage Instructions");
    console.log("====================");

    console.log("\n🔧 Available Price Feeds:");
    for (const [key, address] of Object.entries(deployedFeeds)) {
        const config = PRICE_CONFIGS[key as keyof typeof PRICE_CONFIGS];
        console.log(`${key.padEnd(12)}: ${address} ($${ethers.formatUnits(config.initialPrice, config.decimals)})`);
    }

    console.log("\n💡 How to Use:");
    console.log("1. **In Slice Creation Scripts:**");
    console.log("   ```typescript");
    console.log("   // Use building token price feed for property tokens");
    console.log("   await slice.addAllocation(aToken, deployedFeeds.building, 5000);");
    console.log("   ```");

    console.log("\n2. **In Fix Scripts:**");
    console.log("   ```typescript");
    console.log("   const MOCK_PRICE_FEEDS = {");
    for (const [key, address] of Object.entries(deployedFeeds)) {
        console.log(`     "${key}": "${address}",`);
    }
    console.log("   };");
    console.log("   ```");

    console.log("\n3. **For Different Token Types:**");
    console.log("   - **Building Tokens**: Use 'building' feed ($100)");
    console.log("   - **Premium Properties**: Use 'premium' feed ($1000)");
    console.log("   - **Stablecoins**: Use 'stablecoin' feed ($1)");
    console.log("   - **Low Value Assets**: Use 'low' feed ($0.10)");
}

/**
 * Show how to update prices dynamically
 */
function showPriceUpdateInstructions(deployedFeeds: { [key: string]: string }) {
    console.log("\n🔄 Dynamic Price Updates");
    console.log("=======================");

    console.log("You can update prices dynamically using the updateAnswer function:");
    console.log("```typescript");
    console.log("const priceFeed = await ethers.getContractAt('MockV3Aggregator', '${deployedFeeds.building}');");
    console.log("");
    console.log("// Update to new price (e.g., $150)");
    console.log("await priceFeed.updateAnswer(ethers.parseUnits('150', 8));");
    console.log("");
    console.log("// Update to simulate price volatility");
    console.log("await priceFeed.updateAnswer(ethers.parseUnits('95', 8)); // -5%");
    console.log("await priceFeed.updateAnswer(ethers.parseUnits('105', 8)); // +5%");
    console.log("```");

    console.log("\n🎯 Testing Scenarios:");
    console.log("1. **Price Stability**: Keep prices constant");
    console.log("2. **Price Volatility**: Update prices frequently");
    console.log("3. **Market Crashes**: Set very low prices");
    console.log("4. **Market Booms**: Set very high prices");
}

/**
 * Show integration with existing scripts
 */
function showIntegrationInstructions(deployedFeeds: { [key: string]: string }) {
    console.log("\n🔗 Integration with Existing Scripts");
    console.log("===================================");

    console.log("\n1. **Update fix-slice-price-feeds.ts:**");
    console.log("   Replace the MOCK_PRICE_FEEDS object with:");
    console.log("   ```typescript");
    console.log("   const MOCK_PRICE_FEEDS = {");
    for (const [key, address] of Object.entries(deployedFeeds)) {
        console.log(`     "${key}": "${address}",`);
    }
    console.log("   };");
    console.log("   ```");

    console.log("\n2. **Update create-slice-with-buildings-fixed.ts:**");
    console.log("   Use the building price feed:");
    console.log("   ```typescript");
    console.log("   const mockPriceFeed = '${deployedFeeds.building}';");
    console.log("   await slice.addAllocation(aToken, mockPriceFeed, percentage);");
    console.log("   ```");

    console.log("\n3. **Create a price feed registry:**");
    console.log("   Store these addresses in your deployment file or constants");
}

async function main() {
    console.log("🏗️  Mock Price Feed Deployment Script");
    console.log("=====================================");
    console.log("This script deploys MockV3Aggregator contracts for testing slice rebalancing.");

    try {
        // Deploy all mock price feeds
        const deployedFeeds = await deployAllMockPriceFeeds();

        // Show usage instructions
        showUsageInstructions(deployedFeeds);

        // Show price update instructions
        showPriceUpdateInstructions(deployedFeeds);

        // Show integration instructions
        showIntegrationInstructions(deployedFeeds);

        console.log("\n✅ Mock price feeds deployed successfully!");
        console.log("\n📝 Next Steps:");
        console.log("1. Copy the addresses above to your slice creation scripts");
        console.log("2. Test slice rebalancing with realistic price values");
    } catch (error) {
        console.error("❌ Error deploying mock price feeds:", error);
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
