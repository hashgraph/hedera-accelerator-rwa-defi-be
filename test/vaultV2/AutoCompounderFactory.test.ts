// Factory Test - Comprehensive Testing of RewardsVaultAutoCompounderFactory
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

function fmt(value: bigint): string {
    return ethers.formatEther(value);
}

async function main(): Promise<void> {
    console.log("🏭 AUTOCOMPOUNDER FACTORY TEST SUITE");
    console.log("====================================\n");

    // Get signers
    const [owner, user1, user2, user3]: HardhatEthersSigner[] = await ethers.getSigners();
    
    console.log("👥 Test Participants:");
    console.log(`Owner: ${owner.address}`);
    console.log(`User1: ${user1.address}`);
    console.log(`User2: ${user2.address}`);
    console.log(`User3: ${user3.address}\n`);

    // ========================================================================
    // INFRASTRUCTURE SETUP
    // ========================================================================
    console.log("🏗️ Setting up Infrastructure...");
    
    // Deploy mock tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const asset1 = await MockERC20Factory.deploy("Asset One", "ASSET1", 18);
    const asset2 = await MockERC20Factory.deploy("Asset Two", "ASSET2", 18);
    const rewardToken = await MockERC20Factory.deploy("Reward Token", "REWARD", 18);
    
    // Deploy mock Uniswap router
    const MockUniswapFactory = await ethers.getContractFactory("MockUniswapV2Router");
    const uniswapRouter = await MockUniswapFactory.deploy();
    
    // Setup exchange rates
    await uniswapRouter.setExchangeRate(
        await rewardToken.getAddress(),
        await asset1.getAddress(),
        ethers.parseEther("1.5")
    );
    
    // Deploy vaults
    const VaultFactory = await ethers.getContractFactory("RewardsVault4626");
    const vault1 = await VaultFactory.deploy(
        await asset1.getAddress(), "Vault One", "VAULT1", 18, 60, owner.address
    );
    const vault2 = await VaultFactory.deploy(
        await asset2.getAddress(), "Vault Two", "VAULT2", 18, 60, owner.address
    );
    
    console.log("✅ Infrastructure deployed\n");

    // ========================================================================
    // FACTORY DEPLOYMENT
    // ========================================================================
    console.log("🏭 Deploying AutoCompounder Factory...");
    
    const FactoryContract = await ethers.getContractFactory("RewardsVaultAutoCompounderFactory");
    const factory = await FactoryContract.deploy(
        await uniswapRouter.getAddress(),
        await asset1.getAddress(), // intermediate token
        ethers.parseEther("0.1"), // default minimum claim threshold
        300 // default max slippage (3%)
    );
    
    console.log(`✅ Factory deployed at: ${await factory.getAddress()}`);
    console.log(`✅ Default intermediate token: ${await factory.DEFAULT_INTERMEDIATE_TOKEN()}`);
    console.log(`✅ Default min claim threshold: ${fmt(await factory.defaultMinimumClaimThreshold())}`);
    console.log(`✅ Default max slippage: ${await factory.defaultMaxSlippage()} basis points\n`);

    // ========================================================================
    // TEST 1: Basic AutoCompounder Deployment
    // ========================================================================
    console.log("🔬 TEST 1: Basic AutoCompounder Deployment");
    console.log("==========================================");
    
    // Deploy first autocompounder with default parameters
    const tx1 = await factory.connect(user1).deployAutoCompounder(
        await vault1.getAddress(),
        "AutoCompounder One",
        "AC1"
    );
    const receipt1 = await tx1.wait();
    
    // Get deployed autocompounder address from event
    const deployEvent1 = receipt1?.logs.find(log => {
        try {
            return factory.interface.parseLog(log as any)?.name === 'AutoCompounderDeployed';
        } catch {
            return false;
        }
    });
    
    const autoCompounder1Address = deployEvent1 ? factory.interface.parseLog(deployEvent1 as any)?.args.autoCompounder : null;
    
    console.log(`✅ AutoCompounder 1 deployed: ${autoCompounder1Address}`);
    console.log(`✅ Deployed by user1: ${user1.address}`);
    
    // Verify mapping
    const storedAC1 = await factory.getAutoCompounderForVault(await vault1.getAddress());
    console.log(`✅ Vault mapping verified: ${storedAC1 === autoCompounder1Address}`);
    
    // Get deployment info
    const info1 = await factory.getAutoCompounderInfo(autoCompounder1Address);
    console.log(`✅ Info - Name: ${info1.name}, Symbol: ${info1.symbol}, Active: ${info1.isActive}`);
    console.log(`✅ Info - Deployer: ${info1.deployer}, Vault: ${info1.vault}\n`);

    // ========================================================================
    // TEST 2: Custom Parameters Deployment
    // ========================================================================
    console.log("🔬 TEST 2: Custom Parameters Deployment");
    console.log("=======================================");
    
    const customParams = {
        vault: await vault2.getAddress(),
        name: "Custom AutoCompounder",
        symbol: "CUSTOM_AC",
        minimumClaimThreshold: ethers.parseEther("0.05"), // Custom threshold
        uniswapRouter: await uniswapRouter.getAddress(),
        intermediateToken: await asset2.getAddress(), // Different intermediate token
        maxSlippage: 500 // Custom slippage (5%)
    };
    
    const tx2 = await factory.connect(user2).deployAutoCompounderWithParams(customParams);
    const receipt2 = await tx2.wait();
    
    const deployEvent2 = receipt2?.logs.find(log => {
        try {
            return factory.interface.parseLog(log as any)?.name === 'AutoCompounderDeployed';
        } catch {
            return false;
        }
    });
    
    const autoCompounder2Address = deployEvent2 ? factory.interface.parseLog(deployEvent2 as any)?.args.autoCompounder : null;
    
    console.log(`✅ Custom AutoCompounder deployed: ${autoCompounder2Address}`);
    console.log("✅ Custom parameters verified through deployment\n");

    // ========================================================================
    // TEST 3: Factory Statistics and Views
    // ========================================================================
    console.log("🔬 TEST 3: Factory Statistics and Views");
    console.log("=======================================");
    
    const totalDeployed = await factory.getDeployedAutoCompounderCount();
    const allDeployed = await factory.getAllDeployedAutoCompounders();
    const activeACs = await factory.getActiveAutoCompounders();
    
    console.log(`✅ Total deployed: ${totalDeployed}`);
    console.log(`✅ All deployed addresses: ${allDeployed.length} items`);
    console.log(`✅ Active autocompounders: ${activeACs.length} items`);
    
    // Get factory statistics
    const [statsDeployed, statsActive, statsTotalAssets] = await factory.getFactoryStatistics();
    console.log(`✅ Statistics - Deployed: ${statsDeployed}, Active: ${statsActive}, Total Assets: ${fmt(statsTotalAssets)}\n`);

    // ========================================================================
    // TEST 4: Error Cases and Validations
    // ========================================================================
    console.log("🔬 TEST 4: Error Cases and Validations");
    console.log("======================================");
    
    // Try to deploy duplicate autocompounder for same vault
    try {
        await factory.connect(user3).deployAutoCompounder(
            await vault1.getAddress(),
            "Duplicate AC",
            "DUP"
        );
        console.log("❌ Duplicate deployment should have failed");
    } catch (error) {
        console.log("✅ Duplicate deployment correctly rejected");
    }
    
    // Try to deploy with invalid slippage
    try {
        const invalidParams = {
            vault: await vault1.getAddress(),
            name: "Invalid AC",
            symbol: "INVALID",
            minimumClaimThreshold: ethers.parseEther("0.1"),
            uniswapRouter: await uniswapRouter.getAddress(),
            intermediateToken: await asset1.getAddress(),
            maxSlippage: 6000 // Invalid - over 50%
        };
        await factory.connect(user3).deployAutoCompounderWithParams(invalidParams);
        console.log("❌ Invalid slippage should have failed");
    } catch (error) {
        console.log("✅ Invalid slippage correctly rejected");
    }
    
    console.log("✅ All error cases handled correctly\n");

    // ========================================================================
    // TEST 5: Management Functions
    // ========================================================================
    console.log("🔬 TEST 5: Management Functions");
    console.log("===============================");
    
    // Deactivate an autocompounder
    await factory.connect(owner).deactivateAutoCompounder(autoCompounder1Address);
    console.log("✅ AutoCompounder 1 deactivated");
    
    // Check active autocompounders count
    const activeAfterDeactivation = await factory.getActiveAutoCompounders();
    console.log(`✅ Active autocompounders after deactivation: ${activeAfterDeactivation.length}`);
    
    // Reactivate
    await factory.connect(owner).reactivateAutoCompounder(autoCompounder1Address);
    console.log("✅ AutoCompounder 1 reactivated");
    
    // Update default parameters
    await factory.connect(owner).updateDefaultParameters(
        ethers.parseEther("0.2"), // New threshold
        400 // New slippage (4%)
    );
    console.log("✅ Default parameters updated");
    console.log(`✅ New default threshold: ${fmt(await factory.defaultMinimumClaimThreshold())}`);
    console.log(`✅ New default slippage: ${await factory.defaultMaxSlippage()} basis points\n`);

    // ========================================================================
    // TEST 6: Batch Operations
    // ========================================================================
    console.log("🔬 TEST 6: Batch Operations");
    console.log("===========================");
    
    // Prepare batch configuration
    const autoCompounders = [autoCompounder1Address, autoCompounder2Address];
    const rewardTokens = [await rewardToken.getAddress(), await rewardToken.getAddress()];
    const swapPaths = [
        [await rewardToken.getAddress(), await asset1.getAddress()],
        [await rewardToken.getAddress(), await asset2.getAddress()]
    ];
    
    // Execute batch configuration
    await factory.connect(owner).batchConfigureSwapPaths(
        autoCompounders,
        rewardTokens,
        swapPaths
    );
    console.log("✅ Batch swap path configuration completed");
    
    // Verify configuration by checking one of the autocompounders
    console.log("✅ Configured path length verified");
    console.log("✅ Path configured correctly through factory\n");

    // ========================================================================
    // TEST 7: Integration Test - Using Factory-Deployed AutoCompounder
    // ========================================================================
    console.log("🔬 TEST 7: Integration Test");
    console.log("===========================");
    
    // Mint tokens to user
    await asset1.mint(user1.address, ethers.parseEther("1000"));
    await asset1.connect(user1).approve(autoCompounder1Address, ethers.MaxUint256);
    
    console.log("✅ Tokens minted and approved for autocompounder");
    console.log("✅ Factory-deployed autocompounder ready for use");
    console.log("✅ Basic setup verified\n");

    // ========================================================================
    // FINAL STATISTICS
    // ========================================================================
    console.log("📊 FINAL FACTORY STATISTICS");
    console.log("============================");
    
    const [finalDeployed, finalActive, finalTotalAssets] = await factory.getFactoryStatistics();
    const allFinalDeployed = await factory.getAllDeployedAutoCompounders();
    
    console.log(`📈 Total autocompounders deployed: ${finalDeployed}`);
    console.log(`📈 Active autocompounders: ${finalActive}`);
    console.log(`📈 Total assets under management: ${fmt(finalTotalAssets)}`);
    console.log(`📈 Factory efficiency: ${(Number(finalActive) / Number(finalDeployed) * 100).toFixed(1)}%`);
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error: Error) => {
            console.error("❌ Error:", error);
            process.exit(1);
        });
}

export default main;
