import { ethers } from "hardhat";

async function main() {
    console.log("🚀 Testing getUserReward functions...\n");

    const [owner, alice, bob, charlie] = await ethers.getSigners();

    // Deploy tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    const asset = await MockERC20Factory.deploy("Test Asset", "ASSET", 18);
    const rewardToken1 = await MockERC20Factory.deploy("Reward Token 1", "RWT1", 18);
    const rewardToken2 = await MockERC20Factory.deploy("Reward Token 2", "RWT2", 18);

    // Deploy mock Uniswap router
    const MockUniswapFactory = await ethers.getContractFactory("MockUniswapV2Router");
    const uniswapRouter = await MockUniswapFactory.deploy();

    // Deploy vault
    const VaultFactory = await ethers.getContractFactory("RewardsVault4626");
    const vault = await VaultFactory.deploy(
        await asset.getAddress(),
        "Test Vault",
        "TVAULT",
        18,
        0, // No lock period
        owner.address
    );

    // Deploy autocompounder
    const AutoCompounderFactory = await ethers.getContractFactory("RewardsVaultAutoCompounder");
    const autoCompounder = await AutoCompounderFactory.deploy(
        await vault.getAddress(),
        "Auto Compounder",
        "AC-VAULT",
        ethers.parseEther("0.1"),
        await uniswapRouter.getAddress(),
        await asset.getAddress(),
        300 // 3% slippage
    );

    // Mint tokens
    await asset.mint(alice.address, ethers.parseEther("1000"));
    await asset.mint(bob.address, ethers.parseEther("1000"));
    await asset.mint(charlie.address, ethers.parseEther("1000"));
    await rewardToken1.mint(owner.address, ethers.parseEther("1000"));
    await rewardToken2.mint(owner.address, ethers.parseEther("1000"));

    console.log("📦 Contracts deployed and tokens minted\n");

    // ===========================================
    // Test 1: RewardsVault4626 getUserReward
    // ===========================================
    console.log("🔵 === Testing RewardsVault4626 getUserReward ===");
    
    // Users deposit different amounts
    await asset.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
    await asset.connect(bob).approve(await vault.getAddress(), ethers.parseEther("200"));
    await asset.connect(charlie).approve(await vault.getAddress(), ethers.parseEther("300"));

    await vault.connect(alice).deposit(ethers.parseEther("100"), alice.address);
    await vault.connect(bob).deposit(ethers.parseEther("200"), bob.address);
    await vault.connect(charlie).deposit(ethers.parseEther("300"), charlie.address);

    console.log("💰 Vault Deposits:");
    console.log(`   Alice: 100 ASSET (16.67% of 600)`);
    console.log(`   Bob:   200 ASSET (33.33% of 600)`);
    console.log(`   Charlie: 300 ASSET (50% of 600)\n`);

    // Add rewards to vault
    await rewardToken1.approve(await vault.getAddress(), ethers.parseEther("120"));
    await rewardToken2.approve(await vault.getAddress(), ethers.parseEther("240"));
    await vault.addReward(await rewardToken1.getAddress(), ethers.parseEther("120"));
    await vault.addReward(await rewardToken2.getAddress(), ethers.parseEther("240"));

    console.log("🎁 Added rewards to vault:");
    console.log(`   Reward Token 1: 120 tokens`);
    console.log(`   Reward Token 2: 240 tokens\n`);

    // Check getUserReward for each user
    console.log("📊 Vault getUserReward results:");
    
    const [aliceVaultTokens, aliceVaultAmounts] = await vault.getUserReward(alice.address);
    console.log(`👩 Alice's rewards:`);
    for (let i = 0; i < aliceVaultTokens.length; i++) {
        const tokenSymbol = aliceVaultTokens[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(aliceVaultAmounts[i])} tokens`);
    }

    const [bobVaultTokens, bobVaultAmounts] = await vault.getUserReward(bob.address);
    console.log(`👨 Bob's rewards:`);
    for (let i = 0; i < bobVaultTokens.length; i++) {
        const tokenSymbol = bobVaultTokens[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(bobVaultAmounts[i])} tokens`);
    }

    const [charlieVaultTokens, charlieVaultAmounts] = await vault.getUserReward(charlie.address);
    console.log(`🧑 Charlie's rewards:`);
    for (let i = 0; i < charlieVaultTokens.length; i++) {
        const tokenSymbol = charlieVaultTokens[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(charlieVaultAmounts[i])} tokens`);
    }

    console.log("\n");

    // ===========================================
    // Test 2: RewardsVaultAutoCompounder getUserReward
    // ===========================================
    console.log("🟠 === Testing RewardsVaultAutoCompounder getUserReward ===");
    
    // Users deposit into autocompounder
    await asset.connect(alice).approve(await autoCompounder.getAddress(), ethers.parseEther("150"));
    await asset.connect(bob).approve(await autoCompounder.getAddress(), ethers.parseEther("300"));
    await asset.connect(charlie).approve(await autoCompounder.getAddress(), ethers.parseEther("450"));

    await autoCompounder.connect(alice).deposit(ethers.parseEther("150"), alice.address);
    await autoCompounder.connect(bob).deposit(ethers.parseEther("300"), bob.address);
    await autoCompounder.connect(charlie).deposit(ethers.parseEther("450"), charlie.address);

    console.log("💰 AutoCompounder Deposits:");
    console.log(`   Alice: 150 ASSET (16.67% of 900)`);
    console.log(`   Bob:   300 ASSET (33.33% of 900)`);
    console.log(`   Charlie: 450 ASSET (50% of 900)\n`);

    // Add more rewards to vault (this will benefit both direct vault users and autocompounder)
    await rewardToken1.mint(owner.address, ethers.parseEther("1000"));
    await rewardToken2.mint(owner.address, ethers.parseEther("1000"));
    await rewardToken1.approve(await vault.getAddress(), ethers.parseEther("180"));
    await rewardToken2.approve(await vault.getAddress(), ethers.parseEther("360"));
    await vault.addReward(await rewardToken1.getAddress(), ethers.parseEther("180"));
    await vault.addReward(await rewardToken2.getAddress(), ethers.parseEther("360"));

    console.log("🎁 Added more rewards to vault:");
    console.log(`   Reward Token 1: +180 tokens (total rewards distributed)`);
    console.log(`   Reward Token 2: +360 tokens (total rewards distributed)\n`);

    // Check getUserReward for autocompounder users
    console.log("📊 AutoCompounder getUserReward results:");
    
    const [aliceACTokens, aliceACAmounts] = await autoCompounder.getUserReward(alice.address);
    console.log(`👩 Alice's proportional rewards from AutoCompounder:`);
    for (let i = 0; i < aliceACTokens.length; i++) {
        const tokenSymbol = aliceACTokens[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(aliceACAmounts[i])} tokens`);
    }

    const [bobACTokens, bobACAmounts] = await autoCompounder.getUserReward(bob.address);
    console.log(`👨 Bob's proportional rewards from AutoCompounder:`);
    for (let i = 0; i < bobACTokens.length; i++) {
        const tokenSymbol = bobACTokens[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(bobACAmounts[i])} tokens`);
    }

    const [charlieACTokens, charlieACAmounts] = await autoCompounder.getUserReward(charlie.address);
    console.log(`🧑 Charlie's proportional rewards from AutoCompounder:`);
    for (let i = 0; i < charlieACTokens.length; i++) {
        const tokenSymbol = charlieACTokens[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(charlieACAmounts[i])} tokens`);
    }

    console.log("\n");

    // ===========================================
    // Test 3: After claiming rewards
    // ===========================================
    console.log("🟢 === Testing after claiming rewards ===");
    
    // Alice claims her vault rewards
    await vault.connect(alice).claimAllRewards();
    console.log("Alice claimed all rewards from vault\n");

    console.log("📊 After Alice claimed - Vault getUserReward results:");
    const [aliceVaultTokensAfter, aliceVaultAmountsAfter] = await vault.getUserReward(alice.address);
    console.log(`👩 Alice's remaining rewards:`);
    for (let i = 0; i < aliceVaultTokensAfter.length; i++) {
        const tokenSymbol = aliceVaultTokensAfter[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(aliceVaultAmountsAfter[i])} tokens`);
    }

    const [bobVaultTokensAfter, bobVaultAmountsAfter] = await vault.getUserReward(bob.address);
    console.log(`👨 Bob's remaining rewards (unchanged):`);
    for (let i = 0; i < bobVaultTokensAfter.length; i++) {
        const tokenSymbol = bobVaultTokensAfter[i] === await rewardToken1.getAddress() ? "RWT1" : "RWT2";
        console.log(`   ${tokenSymbol}: ${ethers.formatEther(bobVaultAmountsAfter[i])} tokens`);
    }

    console.log("\n");

    // ===========================================
    // Test 4: Empty scenarios
    // ===========================================
    console.log("⚪ === Testing empty scenarios ===");
    
    // Test user with no deposits
    const [emptyTokens, emptyAmounts] = await vault.getUserReward("0x0000000000000000000000000000000000000001");
    console.log(`🚫 User with no deposits - getUserReward results:`);
    console.log(`   Number of tokens: ${emptyTokens.length}`);
    console.log(`   Number of amounts: ${emptyAmounts.length}`);

    // Test autocompounder user with no deposits
    const [emptyACTokens, emptyACAmounts] = await autoCompounder.getUserReward("0x0000000000000000000000000000000000000001");
    console.log(`🚫 AutoCompounder user with no deposits - getUserReward results:`);
    console.log(`   Number of tokens: ${emptyACTokens.length}`);
    console.log(`   Number of amounts: ${emptyACAmounts.length}`);

    console.log("\n✅ getUserReward function testing completed!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });