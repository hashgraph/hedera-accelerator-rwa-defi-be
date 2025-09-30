// Ultimate AutoCompounder Test Suite - Consolidated Maximum Coverage
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

// Helper functions
async function approveTokensForVault(vault: any, rewardTokens: any[], owner: any): Promise<void> {
    for (const token of rewardTokens) {
        await token.connect(owner).approve(await vault.getAddress(), ethers.MaxUint256);
    }
}

async function setupUsers(users: any[], asset: any, autoCompounder: any): Promise<void> {
    for (const user of users) {
        await asset.connect(user).approve(await autoCompounder.getAddress(), ethers.MaxUint256);
    }
}

async function configureSwapPaths(autoCompounder: any, rewardTokens: any[], asset: any, owner: any): Promise<void> {
    for (const token of rewardTokens) {
        await autoCompounder.connect(owner).setSwapPath(
            await token.getAddress(),
            [await token.getAddress(), await asset.getAddress()]
        );
    }
}

function fmt(value: bigint): string {
    return ethers.formatEther(value);
}

async function waitForUnlock(seconds: number): Promise<void> {
    console.log(`⏳ Waiting ${seconds} seconds for unlock...`);
    await new Promise<void>(resolve => setTimeout(() => resolve(), (seconds + 1) * 1000));
}

async function main(): Promise<void> {
    console.log("🚀 ULTIMATE AUTOCOMPOUNDER TEST SUITE - MAXIMUM COVERAGE");
    console.log("=========================================================\n");

    // Get all signers
    const [owner, alice, bob, charlie, dave, eve, frank, grace, henry, iris]: HardhatEthersSigner[] = await ethers.getSigners();
    
    console.log("👥 Test Participants:");
    const participants = ['Owner', 'Alice', 'Bob', 'Charlie', 'Dave', 'Eve', 'Frank', 'Grace', 'Henry', 'Iris'];
    const signers = [owner, alice, bob, charlie, dave, eve, frank, grace, henry, iris];
    participants.forEach((name, i) => {
        console.log(`${name}: ${signers[i].address}`);
    });
    console.log();

    // ========================================================================
    // INFRASTRUCTURE SETUP - Comprehensive Token Ecosystem
    // ========================================================================
    console.log("🏗️ Deploying Comprehensive Infrastructure...");
    
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const asset = await MockERC20Factory.deploy("Main Asset", "MAIN", 18);
    
    // Create diverse reward token ecosystem
    const rewardTokens = [];
    const tokenConfigs = [
        { name: "DeFi Token", symbol: "DEFI", rate: "1.5" },
        { name: "Gov Token", symbol: "GOV", rate: "2.2" },
        { name: "Utility Token", symbol: "UTIL", rate: "0.8" },
        { name: "Memecoin", symbol: "MEME", rate: "0.001" },
        { name: "Stablecoin", symbol: "STABLE", rate: "1.0" },
        { name: "Exotic Token", symbol: "EXOTIC", rate: "10.0" }
    ];
    
    for (const config of tokenConfigs) {
        const token = await MockERC20Factory.deploy(config.name, config.symbol, 18);
        rewardTokens.push(token);
    }

    const MockUniswapFactory = await ethers.getContractFactory("MockUniswapV2Router");
    const uniswapRouter = await MockUniswapFactory.deploy();

    // Setup exchange rates
    const exchangeRates = tokenConfigs.map(config => ethers.parseEther(config.rate));
    for (let i = 0; i < rewardTokens.length; i++) {
        await uniswapRouter.setExchangeRate(
            await rewardTokens[i].getAddress(),
            await asset.getAddress(),
            exchangeRates[i]
        );
    }

    // Mint tokens to all participants (large amounts to avoid overflow issues)
    const users = [alice, bob, charlie, dave, eve, frank, grace, henry, iris];
    for (const user of users) {
        await asset.mint(user.address, ethers.parseEther("100000"));
    }
    
    for (const token of rewardTokens) {
        await token.mint(owner.address, ethers.parseEther("10000000"));
        await token.mint(await uniswapRouter.getAddress(), ethers.parseEther("10000000"));
    }
    await asset.mint(await uniswapRouter.getAddress(), ethers.parseEther("10000000"));

    console.log("✅ Infrastructure deployed with 6 diverse reward tokens");
    console.log("✅ Tokens minted to all participants\n");

    // ========================================================================
    // SCENARIO 1: Maximum Multi-User Stress Test
    // ========================================================================
    console.log("🔬 SCENARIO 1: Maximum Multi-User Stress Test");
    console.log("==============================================");

    const VaultFactory = await ethers.getContractFactory("RewardsVault4626");
    const vault1 = await VaultFactory.deploy(
        await asset.getAddress(), "Stress Vault", "STRESS", 18, 2, owner.address
    );
    await approveTokensForVault(vault1, rewardTokens, owner);

    const AutoCompounderFactory = await ethers.getContractFactory("RewardsVaultAutoCompounder");
    const autoCompounder1 = await AutoCompounderFactory.deploy(
        await vault1.getAddress(), "Stress AC", "SAC", ethers.parseEther("0.1"),
        await uniswapRouter.getAddress(), await asset.getAddress(), 300
    );

    await configureSwapPaths(autoCompounder1, rewardTokens, asset, owner);
    await setupUsers(users, asset, autoCompounder1);

    // All 9 users deposit different amounts (realistic distribution)
    const deposits = [
        ethers.parseEther("1000"),   // Alice - small retail
        ethers.parseEther("2500"),   // Bob - medium retail  
        ethers.parseEther("500"),    // Charlie - micro investor
        ethers.parseEther("15000"),  // Dave - whale
        ethers.parseEther("750"),    // Eve - small DeFi user
        ethers.parseEther("3000"),   // Frank - yield farmer
        ethers.parseEther("5000"),   // Grace - HODLer
        ethers.parseEther("800"),    // Henry - arbitrageur
        ethers.parseEther("1200")    // Iris - DCA user
    ];

    console.log("\n📈 Mass deposit phase (9 users):");
    for (let i = 0; i < users.length; i++) {
        await autoCompounder1.connect(users[i]).deposit(deposits[i], users[i].address);
        console.log(`${participants[i+1]} deposited: ${fmt(deposits[i])} MAIN`);
    }

    // Massive multi-token reward distribution
    console.log("\n🎁 Massive multi-token reward distribution:");
    const rewardAmounts = [
        ethers.parseEther("500"),    // DEFI
        ethers.parseEther("300"),    // GOV
        ethers.parseEther("800"),    // UTIL
        ethers.parseEther("50000"),  // MEME (high volume, low value)
        ethers.parseEther("400"),    // STABLE
        ethers.parseEther("50")      // EXOTIC (low volume, high value)
    ];

    for (let i = 0; i < rewardTokens.length; i++) {
        await vault1.connect(owner).addReward(await rewardTokens[i].getAddress(), rewardAmounts[i]);
        await rewardTokens[i].connect(owner).transfer(await vault1.getAddress(), rewardAmounts[i]);
        console.log(`Added ${fmt(rewardAmounts[i])} ${tokenConfigs[i].symbol}`);
    }

    const assetsBefore = await autoCompounder1.totalAssets();
    console.log(`\n💰 Assets before compound: ${fmt(assetsBefore)}`);

    await autoCompounder1.autoCompound();
    
    const assetsAfter = await autoCompounder1.totalAssets();
    const stressTestGain = assetsAfter - assetsBefore;
    console.log(`💰 Assets after compound: ${fmt(assetsAfter)}`);
    console.log(`📈 Total gain: ${fmt(stressTestGain)} MAIN`);

    console.log("\n👥 Individual user results:");
    for (let i = 0; i < users.length; i++) {
        const userAssets = await autoCompounder1.assetsOf(users[i].address);
        const userGain = userAssets - deposits[i];
        const userROI = (Number(userGain) / Number(deposits[i])) * 100;
        console.log(`${participants[i+1]}: ${fmt(userAssets)} MAIN (+${fmt(userGain)}, ${userROI.toFixed(2)}% ROI)`);
    }
    console.log("✅ Scenario 1 completed\n");

    // ========================================================================
    // SCENARIO 2: Market Crash and MEV Attack Simulation
    // ========================================================================
    console.log("🔬 SCENARIO 2: Market Crash and MEV Attack Simulation");
    console.log("======================================================");

    const vault2 = await VaultFactory.deploy(await asset.getAddress(), "Crash Test", "CRASH", 18, 2, owner.address);
    await approveTokensForVault(vault2, rewardTokens, owner);

    const autoCompounder2 = await AutoCompounderFactory.deploy(
        await vault2.getAddress(), "Crash AC", "CAC", ethers.parseEther("0.1"),
        await uniswapRouter.getAddress(), await asset.getAddress(), 1000
    );

    await configureSwapPaths(autoCompounder2, rewardTokens, asset, owner);
    await setupUsers([alice, bob, charlie, henry], asset, autoCompounder2);

    // Setup positions before crash
    await autoCompounder2.connect(alice).deposit(ethers.parseEther("2000"), alice.address);
    await autoCompounder2.connect(bob).deposit(ethers.parseEther("2000"), bob.address);
    await autoCompounder2.connect(charlie).deposit(ethers.parseEther("2000"), charlie.address);
    console.log("Alice, Bob & Charlie setup 2000 MAIN positions");

    // Pre-crash compound
    await vault2.connect(owner).addReward(await rewardTokens[0].getAddress(), ethers.parseEther("200"));
    await rewardTokens[0].connect(owner).transfer(await vault2.getAddress(), ethers.parseEther("200"));
    await autoCompounder2.autoCompound();
    console.log("Pre-crash compound completed");

    // EXTREME MARKET CRASH - 90% value loss
    console.log("\n💥 EXTREME MARKET CRASH - 90% value loss!");
    const crashRates = exchangeRates.map(rate => rate / 10n); // 90% crash
    for (let i = 0; i < rewardTokens.length; i++) {
        await uniswapRouter.setExchangeRate(
            await rewardTokens[i].getAddress(),
            await asset.getAddress(),
            crashRates[i]
        );
    }

    // MEV Attack: Henry front-runs during crash
    console.log("\n🤖 MEV Attack: Henry front-runs during crash");
    await autoCompounder2.connect(henry).deposit(ethers.parseEther("5000"), henry.address);
    console.log("Henry front-ran with 5000 MAIN during crash");

    // Add rewards during crash
    await vault2.connect(owner).addReward(await rewardTokens[0].getAddress(), ethers.parseEther("500"));
    await rewardTokens[0].connect(owner).transfer(await vault2.getAddress(), ethers.parseEther("500"));

    const crashBefore = await autoCompounder2.totalAssets();
    await autoCompounder2.autoCompound();
    const crashAfter = await autoCompounder2.totalAssets();
    
    console.log(`Crash compound gain: ${fmt(crashAfter - crashBefore)} MAIN`);

    // Flash crash simulation - router fails
    console.log("\n⚡ Flash crash: Router temporarily fails");
    await uniswapRouter.setShouldFail(true);

    await vault2.connect(owner).addReward(await rewardTokens[1].getAddress(), ethers.parseEther("300"));
    await rewardTokens[1].connect(owner).transfer(await vault2.getAddress(), ethers.parseEther("300"));

    try {
        await autoCompounder2.autoCompound();
        console.log("✅ Router failure handled gracefully");
    } catch (error) {
        console.log("❌ Router failure caused revert");
    }

    await uniswapRouter.setShouldFail(false);
    console.log("Router recovered");

    // Partial recovery
    console.log("\n📈 PARTIAL RECOVERY - 30% of original values");
    const recoveryRates = exchangeRates.map(rate => rate * 3n / 10n); // 30% of original
    for (let i = 0; i < rewardTokens.length; i++) {
        await uniswapRouter.setExchangeRate(
            await rewardTokens[i].getAddress(),
            await asset.getAddress(),
            recoveryRates[i]
        );
    }

    await vault2.connect(owner).addReward(await rewardTokens[2].getAddress(), ethers.parseEther("400"));
    await rewardTokens[2].connect(owner).transfer(await vault2.getAddress(), ethers.parseEther("400"));
    await autoCompounder2.autoCompound();

    // Wait for unlock and analyze MEV impact
    await waitForUnlock(3);
    const henryShares = await autoCompounder2.balanceOf(henry.address);
    const henryAssetsBefore = await asset.balanceOf(henry.address);
    await autoCompounder2.connect(henry).withdraw(henryShares, henry.address);
    const henryAssetsAfter = await asset.balanceOf(henry.address);
    const henryMEVProfit = henryAssetsAfter - henryAssetsBefore - ethers.parseEther("5000");

    console.log(`\n🤖 MEV Analysis:`);
    console.log(`Henry's MEV profit from crash timing: ${fmt(henryMEVProfit)}`);
    console.log("✅ Scenario 2 completed\n");

    // ========================================================================
    // SCENARIO 3: Extreme Yield Farming and Governance Accumulation
    // ========================================================================
    console.log("🔬 SCENARIO 3: Extreme Yield Farming and Governance");
    console.log("===================================================");

    const vault3 = await VaultFactory.deploy(await asset.getAddress(), "Yield Farm", "FARM", 18, 1, owner.address);
    await approveTokensForVault(vault3, rewardTokens, owner);

    const autoCompounder3 = await AutoCompounderFactory.deploy(
        await vault3.getAddress(), "Yield Farm AC", "FAC", ethers.parseEther("0.001"),
        await uniswapRouter.getAddress(), await asset.getAddress(), 200
    );

    await configureSwapPaths(autoCompounder3, rewardTokens, asset, owner);
    await setupUsers([frank, grace, dave], asset, autoCompounder3);

    // Frank implements aggressive yield farming
    console.log("\n🌾 Frank implements aggressive yield farming");
    await autoCompounder3.connect(frank).deposit(ethers.parseEther("8000"), frank.address);

    // Grace does DCA strategy
    console.log("💎 Grace implements DCA strategy");
    await autoCompounder3.connect(grace).deposit(ethers.parseEther("1000"), grace.address);

    // Dave focuses on governance token accumulation
    console.log("🏛️ Dave focuses on governance accumulation");
    await autoCompounder3.connect(dave).deposit(ethers.parseEther("10000"), dave.address);

    // Rapid fire reward distributions (high APY simulation)
    console.log("\n⚡ Rapid fire rewards (15 rounds):");
    for (let i = 0; i < 15; i++) {
        const tokenIdx = i % rewardTokens.length;
        const rewardAmount = ethers.parseEther((50 + i * 10).toString());

        await vault3.connect(owner).addReward(await rewardTokens[tokenIdx].getAddress(), rewardAmount);
        await rewardTokens[tokenIdx].connect(owner).transfer(await vault3.getAddress(), rewardAmount);
        
        await autoCompounder3.autoCompound();
        
        // Grace does DCA during the process
        if (i % 3 === 0 && i > 0) {
            await autoCompounder3.connect(grace).deposit(ethers.parseEther("500"), grace.address);
            console.log(`Round ${i + 1}: Grace added 500 MAIN (DCA)`);
        } else if (i % 5 === 0) {
            console.log(`Round ${i + 1}: Compound completed`);
        }
    }

    const frankFinal = await autoCompounder3.assetsOf(frank.address);
    const graceFinal = await autoCompounder3.assetsOf(grace.address);
    const daveFinal = await autoCompounder3.assetsOf(dave.address);

    console.log(`\n🌾 Results after extreme farming:`);
    console.log(`Frank (aggressive): ${fmt(frankFinal)} MAIN (+${fmt(frankFinal - ethers.parseEther("8000"))})`);
    console.log(`Grace (DCA): ${fmt(graceFinal)} MAIN (+${fmt(graceFinal - ethers.parseEther("3500"))})`);
    console.log(`Dave (governance): ${fmt(daveFinal)} MAIN (+${fmt(daveFinal - ethers.parseEther("10000"))})`);
    console.log("✅ Scenario 3 completed\n");

    // ========================================================================
    // SCENARIO 4: Long-term Compound Interest and Slippage Testing
    // ========================================================================
    console.log("🔬 SCENARIO 4: Long-term Compounding and Slippage");
    console.log("=================================================");

    const vault4 = await VaultFactory.deploy(await asset.getAddress(), "Long Term", "LONG", 18, 1, owner.address);
    await approveTokensForVault(vault4, rewardTokens, owner);

    // Test different slippage tolerances
    const slippageTests = [50, 300, 500, 1000]; // 0.5%, 3%, 5%, 10%
    const autoCompounders = [];

    for (let i = 0; i < slippageTests.length; i++) {
        const ac = await AutoCompounderFactory.deploy(
            await vault4.getAddress(), `Slippage AC ${i}`, `SAC${i}`, ethers.parseEther("0.01"),
            await uniswapRouter.getAddress(), await asset.getAddress(), slippageTests[i]
        );
        await configureSwapPaths(ac, rewardTokens, asset, owner);
        autoCompounders.push(ac);
    }

    await setupUsers([alice, bob, charlie, dave], asset, autoCompounders[0]);
    for (let i = 1; i < autoCompounders.length; i++) {
        await setupUsers([alice, bob, charlie, dave], asset, autoCompounders[i]);
    }

    console.log("✅ Multiple autocompounders with different slippage deployed");

    // Each user tests different slippage tolerance
    const testUsers = [alice, bob, charlie, dave];
    for (let i = 0; i < testUsers.length; i++) {
        await autoCompounders[i].connect(testUsers[i]).deposit(ethers.parseEther("2000"), testUsers[i].address);
        console.log(`${participants[i+1]} testing ${slippageTests[i]/100}% slippage tolerance`);
    }

    // Simulate 26 weeks of compounding (bi-weekly)
    console.log("\n📅 Simulating 26 weeks of bi-weekly compounding:");
    for (let week = 1; week <= 26; week++) {
        const weeklyReward = ethers.parseEther((30 + week).toString()); // Increasing rewards
        const tokenIdx = week % rewardTokens.length;
        
        await vault4.connect(owner).addReward(await rewardTokens[tokenIdx].getAddress(), weeklyReward);
        await rewardTokens[tokenIdx].connect(owner).transfer(await vault4.getAddress(), weeklyReward);

        // Compound on all autocompounders
        for (const ac of autoCompounders) {
            await ac.autoCompound();
        }

        if (week % 4 === 0) { // Report monthly
            console.log(`Week ${week}: Monthly compound completed`);
        }
    }

    console.log("\n📊 Slippage Impact Analysis:");
    for (let i = 0; i < testUsers.length; i++) {
        const finalAssets = await autoCompounders[i].assetsOf(testUsers[i].address);
        const gain = finalAssets - ethers.parseEther("2000");
        const apr = (Number(gain) / 2000) * 2 * 100; // Annualized
        console.log(`${participants[i+1]} (${slippageTests[i]/100}% slippage): ${fmt(finalAssets)} MAIN (${apr.toFixed(2)}% APR)`);
    }
    console.log("✅ Scenario 4 completed\n");

    // ========================================================================
    // SCENARIO 5: Emergency Edge Cases and Withdrawal Verification
    // ========================================================================
    console.log("🔬 SCENARIO 5: Emergency Cases and Withdrawal Test");
    console.log("==================================================");

    const vault5 = await VaultFactory.deploy(await asset.getAddress(), "Emergency Test", "EMRG", 18, 1, owner.address);
    await approveTokensForVault(vault5, rewardTokens, owner);

    const autoCompounder5 = await AutoCompounderFactory.deploy(
        await vault5.getAddress(), "Emergency AC", "EAC", ethers.parseEther("0.1"),
        await uniswapRouter.getAddress(), await asset.getAddress(), 300
    );

    await configureSwapPaths(autoCompounder5, rewardTokens, asset, owner);
    await setupUsers([alice, bob, charlie], asset, autoCompounder5);

    console.log("🚨 Testing emergency scenarios:");

    // Edge case 1: Extreme amounts
    console.log("\n1️⃣ Extreme amount tests:");
    await autoCompounder5.connect(alice).deposit(ethers.parseEther("0.001"), alice.address);
    await autoCompounder5.connect(bob).deposit(ethers.parseEther("50000"), bob.address);
    console.log("Alice: 0.001 MAIN (dust), Bob: 50,000 MAIN (whale)");

    // Edge case 2: Zero value rewards
    console.log("\n2️⃣ Zero value reward test:");
    await uniswapRouter.setExchangeRate(await rewardTokens[3].getAddress(), await asset.getAddress(), 0);
    await vault5.connect(owner).addReward(await rewardTokens[3].getAddress(), ethers.parseEther("1000"));
    await rewardTokens[3].connect(owner).transfer(await vault5.getAddress(), ethers.parseEther("1000"));

    try {
        await autoCompounder5.autoCompound();
        console.log("✅ Zero value rewards handled gracefully");
    } catch (error) {
        console.log("❌ Zero value rewards caused issues");
    }

    // Edge case 3: Massive rewards for withdrawal test
    console.log("\n3️⃣ Massive rewards for withdrawal verification:");
    const massiveRewards = [
        ethers.parseEther("2000"),   // DEFI
        ethers.parseEther("1500"),   // GOV
        ethers.parseEther("1000")    // UTIL
    ];

    for (let i = 0; i < 3; i++) {
        await vault5.connect(owner).addReward(await rewardTokens[i].getAddress(), massiveRewards[i]);
        await rewardTokens[i].connect(owner).transfer(await vault5.getAddress(), massiveRewards[i]);
    }

    // Charlie enters for withdrawal test
    await autoCompounder5.connect(charlie).deposit(ethers.parseEther("5000"), charlie.address);
    console.log("Charlie deposited 5000 MAIN for withdrawal test");

    await waitForUnlock(2);

    const beforeCompound = await autoCompounder5.totalAssets();
    await autoCompounder5.autoCompound();
    const afterCompound = await autoCompounder5.totalAssets();
    const massiveGain = afterCompound - beforeCompound;

    console.log(`Massive compound gain: ${fmt(massiveGain)} MAIN`);

    // Withdrawal verification
    console.log("\n🏦 WITHDRAWAL VERIFICATION:");
    await waitForUnlock(2);

    const participants2 = [alice, bob, charlie];
    const initialDeposits = [ethers.parseEther("0.001"), ethers.parseEther("50000"), ethers.parseEther("5000")];
    const participantNames = ["Alice", "Bob", "Charlie"];

    for (let i = 0; i < participants2.length; i++) {
        const userShares = await autoCompounder5.balanceOf(participants2[i].address);
        const balanceBefore = await asset.balanceOf(participants2[i].address);
        
        await autoCompounder5.connect(participants2[i]).withdraw(userShares, participants2[i].address);
        
        const balanceAfter = await asset.balanceOf(participants2[i].address);
        const withdrawn = balanceAfter - balanceBefore;
        const profit = withdrawn - initialDeposits[i];
        const roi = (Number(profit) / Number(initialDeposits[i])) * 100;
        
        console.log(`${participantNames[i]}: Withdrew ${fmt(withdrawn)} MAIN (+${fmt(profit)}, ${roi.toFixed(2)}% ROI)`);
    }
    console.log("✅ Scenario 5 completed\n");

    // ========================================================================
    // SCENARIO 6: Gas Optimization and Performance Analysis
    // ========================================================================
    console.log("🔬 SCENARIO 6: Gas Optimization Analysis");
    console.log("=========================================");

    const vault6 = await VaultFactory.deploy(await asset.getAddress(), "Gas Test", "GAS", 18, 1, owner.address);
    await approveTokensForVault(vault6, rewardTokens, owner);

    const autoCompounder6 = await AutoCompounderFactory.deploy(
        await vault6.getAddress(), "Gas AC", "GAC", ethers.parseEther("0.01"),
        await uniswapRouter.getAddress(), await asset.getAddress(), 300
    );

    await configureSwapPaths(autoCompounder6, rewardTokens, asset, owner);
    await setupUsers([alice], asset, autoCompounder6);

    await autoCompounder6.connect(alice).deposit(ethers.parseEther("1000"), alice.address);

    console.log("\n⛽ Gas usage analysis:");

    // Test 1: Single reward compound
    await vault6.connect(owner).addReward(await rewardTokens[0].getAddress(), ethers.parseEther("10"));
    await rewardTokens[0].connect(owner).transfer(await vault6.getAddress(), ethers.parseEther("10"));
    
    const singleTx = await autoCompounder6.autoCompound();
    const singleReceipt = await singleTx.wait();
    console.log(`Single reward compound: ${singleReceipt?.gasUsed.toString()} gas`);

    // Test 2: Multiple rewards compound
    for (let i = 0; i < 6; i++) {
        await vault6.connect(owner).addReward(await rewardTokens[i].getAddress(), ethers.parseEther("10"));
        await rewardTokens[i].connect(owner).transfer(await vault6.getAddress(), ethers.parseEther("10"));
    }
    
    const multiTx = await autoCompounder6.autoCompound();
    const multiReceipt = await multiTx.wait();
    console.log(`6-token compound: ${multiReceipt?.gasUsed.toString()} gas`);

    // Test 3: Empty compound
    const emptyTx = await autoCompounder6.autoCompound();
    const emptyReceipt = await emptyTx.wait();
    console.log(`Empty compound: ${emptyReceipt?.gasUsed.toString()} gas`);

    console.log("✅ Scenario 6 completed\n");

    // ========================================================================
    // SCENARIO 7: ERC4626 Mint/Redeem Functions Testing
    // ========================================================================
    console.log("🔬 SCENARIO 7: ERC4626 Mint/Redeem Functions Testing");
    console.log("====================================================");

    const vault7 = await VaultFactory.deploy(await asset.getAddress(), "Mint/Redeem Test", "MINT", 18, 1, owner.address);
    await approveTokensForVault(vault7, rewardTokens, owner);

    const autoCompounder7 = await AutoCompounderFactory.deploy(
        await vault7.getAddress(), "Mint/Redeem AC", "MAC", ethers.parseEther("0.1"),
        await uniswapRouter.getAddress(), await asset.getAddress(), 300
    );

    await configureSwapPaths(autoCompounder7, rewardTokens, asset, owner);
    await setupUsers([alice, bob, charlie, dave], asset, autoCompounder7);

    console.log("\n🔄 Testing mint() function:");
    
    // Test 1: Basic mint functionality
    console.log("\n1️⃣ Basic mint test:");
    const desiredShares1 = ethers.parseEther("1000");
    const aliceBalanceBefore = await asset.balanceOf(alice.address);
    
    const assetsNeeded = await autoCompounder7.connect(alice).mint.staticCall(desiredShares1, alice.address);
    console.log(`Assets needed for ${fmt(desiredShares1)} shares: ${fmt(assetsNeeded)}`);
    
    await autoCompounder7.connect(alice).mint(desiredShares1, alice.address);
    const aliceShares = await autoCompounder7.balanceOf(alice.address);
    const aliceBalanceAfter = await asset.balanceOf(alice.address);
    const actualAssetsUsed = aliceBalanceBefore - aliceBalanceAfter;
    
    console.log(`Alice minted exactly ${fmt(aliceShares)} shares using ${fmt(actualAssetsUsed)} assets`);
    console.log(`Mint precision: ${aliceShares === desiredShares1 ? "✅ Perfect" : "❌ Mismatch"}`);

    // Test 2: Mint with different receivers
    console.log("\n2️⃣ Mint to different receiver test:");
    const desiredShares2 = ethers.parseEther("500");
    await autoCompounder7.connect(bob).mint(desiredShares2, charlie.address);
    const charlieShares = await autoCompounder7.balanceOf(charlie.address);
    console.log(`Bob minted ${fmt(charlieShares)} shares for Charlie`);

    // Test 3: Mint after rewards accumulation
    console.log("\n3️⃣ Mint after rewards test:");
    await vault7.connect(owner).addReward(await rewardTokens[0].getAddress(), ethers.parseEther("100"));
    await rewardTokens[0].connect(owner).transfer(await vault7.getAddress(), ethers.parseEther("100"));
    await autoCompounder7.autoCompound();
    
    const exchangeRateBefore = await autoCompounder7.exchangeRate();
    console.log(`Exchange rate after compound: ${fmt(exchangeRateBefore)}`);
    
    const desiredShares3 = ethers.parseEther("200");
    const assetsNeededAfterCompound = await autoCompounder7.connect(dave).mint.staticCall(desiredShares3, dave.address);
    await autoCompounder7.connect(dave).mint(desiredShares3, dave.address);
    
    console.log(`Dave minted ${fmt(desiredShares3)} shares for ${fmt(assetsNeededAfterCompound)} assets (after compound)`);

    // Test 4: Redeem functionality
    console.log("\n🔄 Testing redeem() function:");
    
    await waitForUnlock(2);
    
    console.log("\n4️⃣ Basic redeem test:");
    const aliceSharesBeforeRedeem = await autoCompounder7.balanceOf(alice.address);
    const sharesToRedeem = aliceSharesBeforeRedeem / 2n; // Redeem half
    
    const expectedAssets = await autoCompounder7.connect(alice).redeem.staticCall(sharesToRedeem, alice.address, alice.address);
    console.log(`Expected assets for ${fmt(sharesToRedeem)} shares: ${fmt(expectedAssets)}`);
    
    const aliceAssetsBefore = await asset.balanceOf(alice.address);
    await autoCompounder7.connect(alice).redeem(sharesToRedeem, alice.address, alice.address);
    const aliceAssetsAfter = await asset.balanceOf(alice.address);
    const actualAssetsReceived = aliceAssetsAfter - aliceAssetsBefore;
    
    console.log(`Alice redeemed ${fmt(sharesToRedeem)} shares for ${fmt(actualAssetsReceived)} assets`);
    console.log(`Redeem precision: ${actualAssetsReceived === expectedAssets ? "✅ Perfect" : "❌ Mismatch"}`);

    // Test 5: Redeem to different receiver
    console.log("\n5️⃣ Redeem to different receiver test:");
    const bobShares = await autoCompounder7.balanceOf(bob.address);
    console.log(`Bob has ${fmt(bobShares)} shares`);
    
    if (bobShares > 0) {
        const bobSharesToRedeem = bobShares / 3n; // Redeem 1/3
        
        const daveAssetsBefore = await asset.balanceOf(dave.address);
        await autoCompounder7.connect(bob).redeem(bobSharesToRedeem, dave.address, bob.address);
        const daveAssetsAfter = await asset.balanceOf(dave.address);
        const assetsToReceiver = daveAssetsAfter - daveAssetsBefore;
        
        console.log(`Bob redeemed ${fmt(bobSharesToRedeem)} shares, Dave received ${fmt(assetsToReceiver)} assets`);
    } else {
        console.log("Bob has no shares to redeem, skipping this test");
    }

    // Test 6: Redeem with allowance
    console.log("\n6️⃣ Redeem with allowance test:");
    const charlieShares2 = await autoCompounder7.balanceOf(charlie.address);
    console.log(`Charlie has ${fmt(charlieShares2)} shares`);
    
    if (charlieShares2 > 0) {
        const allowanceAmount = charlieShares2 / 2n;
        
        // Charlie approves Alice to redeem on her behalf
        await autoCompounder7.connect(charlie).approve(alice.address, allowanceAmount);
        console.log(`Charlie approved Alice to redeem ${fmt(allowanceAmount)} shares`);
        
        const aliceAssetsBefore2 = await asset.balanceOf(alice.address);
        await autoCompounder7.connect(alice).redeem(allowanceAmount, alice.address, charlie.address);
        const aliceAssetsAfter2 = await asset.balanceOf(alice.address);
        const assetsFromAllowance = aliceAssetsAfter2 - aliceAssetsBefore2;
        
        console.log(`Alice redeemed ${fmt(allowanceAmount)} of Charlie's shares for ${fmt(assetsFromAllowance)} assets`);
    } else {
        console.log("Charlie has no shares, skipping allowance test");
    }

    // Test 7: Edge cases testing
    console.log("\n7️⃣ Edge cases testing:");
    
    // Test mint with zero shares
    try {
        await autoCompounder7.connect(alice).mint(0, alice.address);
        console.log("❌ Zero mint should have failed");
    } catch (error) {
        console.log("✅ Zero mint correctly rejected");
    }
    
    // Test redeem with zero shares
    try {
        await autoCompounder7.connect(alice).redeem(0, alice.address, alice.address);
        console.log("❌ Zero redeem should have failed");
    } catch (error) {
        console.log("✅ Zero redeem correctly rejected");
    }
    
    // Test redeem more than balance
    try {
        const userBalance = await autoCompounder7.balanceOf(alice.address);
        await autoCompounder7.connect(alice).redeem(userBalance + 1n, alice.address, alice.address);
        console.log("❌ Over-redeem should have failed");
    } catch (error) {
        console.log("✅ Over-redeem correctly rejected");
    }
    
    // Test redeem without allowance
    try {
        const someShares = ethers.parseEther("10");
        await autoCompounder7.connect(alice).redeem(someShares, alice.address, bob.address);
        console.log("❌ Unauthorized redeem should have failed");
    } catch (error) {
        console.log("✅ Unauthorized redeem correctly rejected");
    }

    // Test 8: Precision and rounding analysis
    console.log("\n8️⃣ Precision and rounding analysis:");
    
    // Make sure Eve has enough assets for the tiny test
    await asset.mint(eve.address, ethers.parseEther("100"));
    await asset.connect(eve).approve(await autoCompounder7.getAddress(), ethers.MaxUint256);
    
    // Small amount precision test
    const tinyShares = ethers.parseEther("0.001");
    const tinyAssetsNeeded = await autoCompounder7.connect(eve).mint.staticCall(tinyShares, eve.address);
    await autoCompounder7.connect(eve).mint(tinyShares, eve.address);
    
    await waitForUnlock(2);
    
    const tinyAssetsRedeemed = await autoCompounder7.connect(eve).redeem.staticCall(tinyShares, eve.address, eve.address);
    await autoCompounder7.connect(eve).redeem(tinyShares, eve.address, eve.address);
    
    console.log(`Tiny amount test: ${fmt(tinyAssetsNeeded)} assets -> ${fmt(tinyShares)} shares -> ${fmt(tinyAssetsRedeemed)} assets`);
    
    const precisionLoss = tinyAssetsNeeded > tinyAssetsRedeemed ? tinyAssetsNeeded - tinyAssetsRedeemed : 0n;
    const precisionLossNumber = Number(precisionLoss);
    const precisionPercent = (precisionLossNumber / Number(tinyAssetsNeeded)) * 100;
    console.log(`Precision loss: ${fmt(precisionLoss)} assets (${precisionPercent}%)`);

    // Test 9: Performance comparison with deposit/withdraw
    console.log("\n9️⃣ Performance comparison with deposit/withdraw:");
    
    const testAmount = ethers.parseEther("1000");
    
    // Make sure Frank and Grace have enough assets
    await asset.mint(frank.address, ethers.parseEther("2000"));
    await asset.mint(grace.address, ethers.parseEther("2000"));
    await asset.connect(frank).approve(await autoCompounder7.getAddress(), ethers.MaxUint256);
    await asset.connect(grace).approve(await autoCompounder7.getAddress(), ethers.MaxUint256);
    
    // Mint vs Deposit
    const mintTx = await autoCompounder7.connect(frank).mint(testAmount, frank.address);
    const mintReceipt = await mintTx.wait();
    
    const depositTx = await autoCompounder7.connect(grace).deposit(testAmount, grace.address);
    const depositReceipt = await depositTx.wait();
    
    console.log(`Mint gas usage: ${mintReceipt?.gasUsed.toString()}`);
    console.log(`Deposit gas usage: ${depositReceipt?.gasUsed.toString()}`);
    
    await waitForUnlock(2);
    
    // Redeem vs Withdraw
    const frankShares = await autoCompounder7.balanceOf(frank.address);
    const graceShares = await autoCompounder7.balanceOf(grace.address);
    
    const redeemTx = await autoCompounder7.connect(frank).redeem(frankShares, frank.address, frank.address);
    const redeemReceipt = await redeemTx.wait();
    
    const withdrawTx = await autoCompounder7.connect(grace).withdraw(graceShares, grace.address);
    const withdrawReceipt = await withdrawTx.wait();
    
    console.log(`Redeem gas usage: ${redeemReceipt?.gasUsed.toString()}`);
    console.log(`Withdraw gas usage: ${withdrawReceipt?.gasUsed.toString()}`);
    
    console.log("✅ Scenario 7 completed\n");
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
