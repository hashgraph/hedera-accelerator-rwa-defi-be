// Advanced interaction script for RewardsVault4626 - Multi-user scenarios
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

async function main(): Promise<void> {
    console.log("🚀 Testing RewardsVault4626 Advanced Multi-User Features");
    console.log("=======================================================\n");

    // Get signers
    const [owner, alice, bob, charlie]: HardhatEthersSigner[] = await ethers.getSigners();
    console.log("👥 Actors:");
    console.log("Owner (Reward distributor):", owner.address);
    console.log("Alice (User 1):", alice.address);
    console.log("Bob (User 2):", bob.address);
    console.log("Charlie (User 3):", charlie.address);
    console.log();

    // Deploy contracts
    console.log("📦 Deploying contracts...");
    
    // Deploy SimpleToken as asset
    const SimpleToken = await ethers.getContractFactory("SimpleToken");
    const asset = await SimpleToken.deploy("Demo Asset Token", "DAT", 18);
    await asset.waitForDeployment();
    console.log("✅ Asset token deployed:", await asset.getAddress());

    // Deploy SimpleToken as reward tokens
    const rewardToken1 = await SimpleToken.deploy("Demo Reward Token 1", "DRT1", 18);
    await rewardToken1.waitForDeployment();
    console.log("✅ Reward token 1 deployed:", await rewardToken1.getAddress());

    const rewardToken2 = await SimpleToken.deploy("Demo Reward Token 2", "DRT2", 18);
    await rewardToken2.waitForDeployment();
    console.log("✅ Reward token 2 deployed:", await rewardToken2.getAddress());

    // Deploy vault
    const RewardsVault4626 = await ethers.getContractFactory("RewardsVault4626");
    const vault = await RewardsVault4626.deploy(
        await asset.getAddress(),
        "Demo Vault Token",
        "DVT",
        18,
        7 * 24 * 60 * 60, // 7 days lock period
        owner.address
    );
    await vault.waitForDeployment();
    console.log("✅ Vault deployed:", await vault.getAddress());
    console.log();

    // Mint tokens to all users
    console.log("💰 Minting tokens...");
    await asset.mint(alice.address, ethers.parseEther("1000"));
    await asset.mint(bob.address, ethers.parseEther("1000"));
    await asset.mint(charlie.address, ethers.parseEther("1000"));
    await rewardToken1.mint(owner.address, ethers.parseEther("1000"));
    await rewardToken2.mint(owner.address, ethers.parseEther("1000"));
    console.log("✅ Tokens minted to all users and owner");
    console.log();

    console.log("🧪 Starting Multi-User Test Scenarios");
    console.log("=====================================\n");

    // Test Scenario 1: Two people, two types of rewards, one withdraw, add reward, all claim
    console.log("🔬 Scenario 1: Alice & Bob stake → Add rewards → Claim");
    console.log("--------------------------------------------------------");
    
    // Alice and Bob stake 100 tokens each
    await asset.connect(alice).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(alice).deposit(ethers.parseEther("100"), alice.address);
    
    await asset.connect(bob).approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.connect(bob).deposit(ethers.parseEther("100"), bob.address);
    
    console.log("✅ Alice and Bob each staked 100 tokens");
    
    // Owner adds rewards
    await rewardToken1.approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.addReward(await rewardToken1.getAddress(), ethers.parseEther("100"));
    
    await rewardToken2.approve(await vault.getAddress(), ethers.parseEther("100"));
    await vault.addReward(await rewardToken2.getAddress(), ethers.parseEther("100"));
    
    console.log("✅ Added rewards: 100 Token1 + 100 Token2");
    
    // Check claimable amounts
    const aliceToken1Claimable = await vault.getClaimableReward(alice.address, await rewardToken1.getAddress());
    const bobToken1Claimable = await vault.getClaimableReward(bob.address, await rewardToken1.getAddress());
    
    console.log("Alice claimable Token1:", ethers.formatEther(aliceToken1Claimable));
    console.log("Bob claimable Token1:", ethers.formatEther(bobToken1Claimable));
    
    // Claim rewards
    await vault.connect(alice).claimAllRewards();
    await vault.connect(bob).claimAllRewards();
    
    console.log("✅ Scenario 1 completed\n");

    // Test Scenario 2: Three people, varied staking timing
    console.log("🔬 Scenario 2: Varied timing - Sequential staking");
    console.log("--------------------------------------------------");
    
    // Reset vault state by creating new vault for clean test
    const vault2 = await RewardsVault4626.deploy(
        await asset.getAddress(),
        "Test Vault 2",
        "TV2",
        18,
        7 * 24 * 60 * 60,
        owner.address
    );
    await vault2.waitForDeployment();
    
    // Alice stakes first (gets 100% of first reward)
    await asset.connect(alice).approve(await vault2.getAddress(), ethers.parseEther("100"));
    await vault2.connect(alice).deposit(ethers.parseEther("100"), alice.address);
    console.log("Alice staked 100 tokens first");
    
    // Add reward when only Alice is staked
    await rewardToken1.approve(await vault2.getAddress(), ethers.parseEther("90"));
    await vault2.addReward(await rewardToken1.getAddress(), ethers.parseEther("90"));
    console.log("Added 90 reward tokens (Alice gets all)");
    
    // Bob stakes (now rewards will be split)
    await asset.connect(bob).approve(await vault2.getAddress(), ethers.parseEther("100"));
    await vault2.connect(bob).deposit(ethers.parseEther("100"), bob.address);
    console.log("Bob staked 100 tokens");
    
    // Add more rewards (split between Alice and Bob)
    await rewardToken1.approve(await vault2.getAddress(), ethers.parseEther("80"));
    await vault2.addReward(await rewardToken1.getAddress(), ethers.parseEther("80"));
    console.log("Added 80 more reward tokens (split 50/50)");
    
    // Charlie stakes (now 3-way split)
    await asset.connect(charlie).approve(await vault2.getAddress(), ethers.parseEther("100"));
    await vault2.connect(charlie).deposit(ethers.parseEther("100"), charlie.address);
    console.log("Charlie staked 100 tokens");
    
    // Final reward distribution
    await rewardToken1.approve(await vault2.getAddress(), ethers.parseEther("60"));
    await vault2.addReward(await rewardToken1.getAddress(), ethers.parseEther("60"));
    console.log("Added 60 final reward tokens (split 3 ways)");
    
    // Display claimable amounts
    const aliceClaimable = await vault2.getClaimableReward(alice.address, await rewardToken1.getAddress());
    const bobClaimable = await vault2.getClaimableReward(bob.address, await rewardToken1.getAddress());
    const charlieClaimable = await vault2.getClaimableReward(charlie.address, await rewardToken1.getAddress());
    
    console.log("\n💰 Expected rewards distribution:");
    console.log("Alice (early staker):", ethers.formatEther(aliceClaimable));
    console.log("Bob (mid staker):", ethers.formatEther(bobClaimable));
    console.log("Charlie (late staker):", ethers.formatEther(charlieClaimable));
    
    // Claim all rewards
    await vault2.connect(alice).claimAllRewards();
    await vault2.connect(bob).claimAllRewards();
    await vault2.connect(charlie).claimAllRewards();
    
    console.log("✅ Scenario 2 completed\n");

    // Test Scenario 3: Complex withdraw and re-stake scenario
    console.log("🔬 Scenario 3: Re-stake scenario with proportion changes");
    console.log("--------------------------------------------------------");
    
    const vault3 = await RewardsVault4626.deploy(
        await asset.getAddress(),
        "Test Vault 3",
        "TV3",
        18,
        7 * 24 * 60 * 60,
        owner.address
    );
    await vault3.waitForDeployment();
    
    // Initial setup: Alice and Bob stake equally
    await asset.connect(alice).approve(await vault3.getAddress(), ethers.parseEther("200"));
    await vault3.connect(alice).deposit(ethers.parseEther("100"), alice.address);
    
    await asset.connect(bob).approve(await vault3.getAddress(), ethers.parseEther("200"));
    await vault3.connect(bob).deposit(ethers.parseEther("100"), bob.address);
    
    console.log("Alice & Bob each staked 100 tokens (50/50 split)");
    
    // Add rewards
    await rewardToken1.approve(await vault3.getAddress(), ethers.parseEther("100"));
    await vault3.addReward(await rewardToken1.getAddress(), ethers.parseEther("100"));
    console.log("Added 100 reward tokens (50/50 split)");
    
    // Alice stakes more (changing her share proportion)
    await vault3.connect(alice).deposit(ethers.parseEther("100"), alice.address);
    console.log("Alice staked additional 100 tokens (now has 200 vs Bob's 100)");
    
    // Add more rewards with new proportions
    await rewardToken1.approve(await vault3.getAddress(), ethers.parseEther("90"));
    await vault3.addReward(await rewardToken1.getAddress(), ethers.parseEther("90"));
    console.log("Added 90 more reward tokens (2/3 Alice, 1/3 Bob)");
    
    // Check rewards before claiming
    const aliceRewardsBefore = await vault3.getClaimableReward(alice.address, await rewardToken1.getAddress());
    const bobRewardsBefore = await vault3.getClaimableReward(bob.address, await rewardToken1.getAddress());
    
    console.log("\n💰 Claimable rewards:");
    console.log("Alice (66% share):", ethers.formatEther(aliceRewardsBefore));
    console.log("Bob (33% share):", ethers.formatEther(bobRewardsBefore));
    
    await vault3.connect(alice).claimAllRewards();
    await vault3.connect(bob).claimAllRewards();
    
    console.log("✅ Scenario 3 completed\n");

    // Test Scenario 4: Multiple reward tokens with different users
    console.log("🔬 Scenario 4: Multiple reward tokens");
    console.log("--------------------------------------");
    
    const vault4 = await RewardsVault4626.deploy(
        await asset.getAddress(),
        "Test Vault 4",
        "TV4",
        18,
        7 * 24 * 60 * 60,
        owner.address
    );
    await vault4.waitForDeployment();
    
    // Only Alice stakes initially
    await asset.connect(alice).approve(await vault4.getAddress(), ethers.parseEther("100"));
    await vault4.connect(alice).deposit(ethers.parseEther("100"), alice.address);
    console.log("Alice staked 100 tokens alone");
    
    // Add first reward token
    await rewardToken1.approve(await vault4.getAddress(), ethers.parseEther("50"));
    await vault4.addReward(await rewardToken1.getAddress(), ethers.parseEther("50"));
    console.log("Added 50 of reward token 1 (Alice gets all)");
    
    // Bob joins
    await asset.connect(bob).approve(await vault4.getAddress(), ethers.parseEther("100"));
    await vault4.connect(bob).deposit(ethers.parseEther("100"), bob.address);
    console.log("Bob staked 100 tokens");
    
    // Add both reward tokens
    await rewardToken1.approve(await vault4.getAddress(), ethers.parseEther("40"));
    await vault4.addReward(await rewardToken1.getAddress(), ethers.parseEther("40"));
    
    await rewardToken2.approve(await vault4.getAddress(), ethers.parseEther("60"));
    await vault4.addReward(await rewardToken2.getAddress(), ethers.parseEther("60"));
    console.log("Added 40 of token1 and 60 of token2 (split 50/50)");
    
    // Charlie joins last
    await asset.connect(charlie).approve(await vault4.getAddress(), ethers.parseEther("200"));
    await vault4.connect(charlie).deposit(ethers.parseEther("200"), charlie.address);
    console.log("Charlie staked 200 tokens (now 1:1:2 ratio)");
    
    // Final reward drop
    await rewardToken1.approve(await vault4.getAddress(), ethers.parseEther("80"));
    await vault4.addReward(await rewardToken1.getAddress(), ethers.parseEther("80"));
    
    await rewardToken2.approve(await vault4.getAddress(), ethers.parseEther("120"));
    await vault4.addReward(await rewardToken2.getAddress(), ethers.parseEther("120"));
    console.log("Added final rewards (split by 1:1:2 ratio)");
    
    // Display final claimable amounts for both tokens
    console.log("\n💰 Final claimable amounts:");
    
    const aliceToken1 = await vault4.getClaimableReward(alice.address, await rewardToken1.getAddress());
    const aliceToken2 = await vault4.getClaimableReward(alice.address, await rewardToken2.getAddress());
    const bobToken1 = await vault4.getClaimableReward(bob.address, await rewardToken1.getAddress());
    const bobToken2 = await vault4.getClaimableReward(bob.address, await rewardToken2.getAddress());
    const charlieToken1 = await vault4.getClaimableReward(charlie.address, await rewardToken1.getAddress());
    const charlieToken2 = await vault4.getClaimableReward(charlie.address, await rewardToken2.getAddress());
    
    console.log("Alice - Token1:", ethers.formatEther(aliceToken1), "| Token2:", ethers.formatEther(aliceToken2));
    console.log("Bob - Token1:", ethers.formatEther(bobToken1), "| Token2:", ethers.formatEther(bobToken2));
    console.log("Charlie - Token1:", ethers.formatEther(charlieToken1), "| Token2:", ethers.formatEther(charlieToken2));
    
    // Claim all rewards
    await vault4.connect(alice).claimAllRewards();
    await vault4.connect(bob).claimAllRewards();
    await vault4.connect(charlie).claimAllRewards();
    
    console.log("✅ Scenario 4 completed\n");

    // Test Scenario 5: Withdraw scenarios with short lock period
    console.log("🔬 Scenario 5: Withdraw testing (short lock period)");
    console.log("---------------------------------------------------");
    
    // Create vault with short lock period for withdraw testing
    const vaultWithdraw = await RewardsVault4626.deploy(
        await asset.getAddress(),
        "Withdraw Test Vault",
        "WTV",
        18,
        2, // 2 seconds lock period for testing
        owner.address
    );
    await vaultWithdraw.waitForDeployment();
    console.log("✅ Vault with 2-second lock period deployed");
    
    // Alice and Bob deposit
    await asset.connect(alice).approve(await vaultWithdraw.getAddress(), ethers.parseEther("200"));
    await vaultWithdraw.connect(alice).deposit(ethers.parseEther("200"), alice.address);
    
    await asset.connect(bob).approve(await vaultWithdraw.getAddress(), ethers.parseEther("200"));
    await vaultWithdraw.connect(bob).deposit(ethers.parseEther("200"), bob.address);
    
    console.log("Alice & Bob each deposited 200 tokens");
    
    // Add rewards before withdrawals
    await rewardToken1.approve(await vaultWithdraw.getAddress(), ethers.parseEther("100"));
    await vaultWithdraw.addReward(await rewardToken1.getAddress(), ethers.parseEther("100"));
    console.log("Added 100 reward tokens");
    
    const aliceRewardsBeforeWithdraw = await vaultWithdraw.getClaimableReward(alice.address, await rewardToken1.getAddress());
    const bobRewardsBeforeWithdraw = await vaultWithdraw.getClaimableReward(bob.address, await rewardToken1.getAddress());
    
    console.log("Alice claimable rewards:", ethers.formatEther(aliceRewardsBeforeWithdraw));
    console.log("Bob claimable rewards:", ethers.formatEther(bobRewardsBeforeWithdraw));
    
    // Wait for unlock period
    console.log("\n⏳ Waiting for unlock period (3 seconds)...");
    await new Promise<void>(resolve => setTimeout(() => resolve(), 3000));
    
    // Check unlock status
    const aliceUnlocked = await vaultWithdraw.isUnlocked(alice.address);
    const bobUnlocked = await vaultWithdraw.isUnlocked(bob.address);
    console.log("Alice unlocked:", aliceUnlocked);
    console.log("Bob unlocked:", bobUnlocked);
    
    if (aliceUnlocked) {
        // Alice claims rewards and withdraws some tokens
        console.log("\n📤 Alice claims rewards and withdraws 50 tokens:");
        const aliceAssetsBefore = await asset.balanceOf(alice.address);
        const aliceRewardsBefore = await rewardToken1.balanceOf(alice.address);
        
        // Claim rewards first
        await vaultWithdraw.connect(alice).claimAllRewards();
        const aliceRewardsAfterClaim = await rewardToken1.balanceOf(alice.address);
        console.log("Rewards claimed:", ethers.formatEther(aliceRewardsAfterClaim - aliceRewardsBefore));
        
        // Then withdraw assets
        await vaultWithdraw.connect(alice).withdraw(ethers.parseEther("50"), alice.address, alice.address);
        
        const aliceAssetsAfter = await asset.balanceOf(alice.address);
        const aliceSharesAfter = await vaultWithdraw.balanceOf(alice.address);
        
        console.log("Assets gained:", ethers.formatEther(aliceAssetsAfter - aliceAssetsBefore));
        console.log("Shares remaining:", ethers.formatEther(aliceSharesAfter));
    }
    
    // Add more rewards after Alice's withdrawal
    await rewardToken1.approve(await vaultWithdraw.getAddress(), ethers.parseEther("100"));
    await vaultWithdraw.addReward(await rewardToken1.getAddress(), ethers.parseEther("100"));
    console.log("\n🎁 Added 100 more reward tokens after Alice's withdrawal");
    
    // Check new reward distribution
    // Alice has ~150 shares, Bob has 200 shares (depending on withdrawal)
    // New rewards should be distributed proportionally
    const aliceRewardsAfterWithdraw = await vaultWithdraw.getClaimableReward(alice.address, await rewardToken1.getAddress());
    const bobRewardsAfterWithdraw = await vaultWithdraw.getClaimableReward(bob.address, await rewardToken1.getAddress());
    
    console.log("Alice claimable rewards after withdrawal:", ethers.formatEther(aliceRewardsAfterWithdraw));
    console.log("Bob claimable rewards after withdrawal:", ethers.formatEther(bobRewardsAfterWithdraw));
    
    if (bobUnlocked) {
        // Bob claims rewards and withdraws all
        console.log("\n📤 Bob claims all rewards and withdraws everything:");
        const bobAssetsBefore = await asset.balanceOf(bob.address);
        const bobRewardsBefore = await rewardToken1.balanceOf(bob.address);
        const bobSharesBefore = await vaultWithdraw.balanceOf(bob.address);
        
        await vaultWithdraw.connect(bob).redeem(bobSharesBefore, bob.address, bob.address);
        
        const bobAssetsAfter = await asset.balanceOf(bob.address);
        const bobRewardsAfter = await rewardToken1.balanceOf(bob.address);
        const bobSharesAfter = await vaultWithdraw.balanceOf(bob.address);
        
        console.log("Assets gained:", ethers.formatEther(bobAssetsAfter - bobAssetsBefore));
        console.log("Rewards claimed:", ethers.formatEther(bobRewardsAfter - bobRewardsBefore));
        console.log("Shares remaining:", ethers.formatEther(bobSharesAfter));
    }
    
    // Test vault state after withdrawals
    const finalTotalAssets = await vaultWithdraw.totalAssets();
    const finalTotalSupply = await vaultWithdraw.totalSupply();
    
    console.log("\n📊 Final vault state:");
    console.log("Total assets:", ethers.formatEther(finalTotalAssets));
    console.log("Total shares:", ethers.formatEther(finalTotalSupply));

}

// Execute if called directly
if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch((error: Error) => {
            console.error("❌ Error:", error);
            process.exit(1);
        });
}

export default main;
