import { expect } from "chai";
import { ethers } from "hardhat";

describe("RewardsVaultAutoCompounder - Advanced Tests", function () {
  let autoCompounder: any;
  let vault: any;
  let asset: any;
  let rewardToken: any;
  let uniswapRouter: any;
  let owner: any;
  let user1: any;
  let user2: any;

  const LOCK_PERIOD = 30 * 24 * 3600; // 30 days
  const MIN_CLAIM_THRESHOLD = ethers.parseEther("1");
  const MAX_SLIPPAGE = 300; // 3%

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();

    console.log("📦 Deploying contracts...");

    // Deploy tokens
    const MockERC20Factory = await ethers.getContractFactory("MockERC20");
    asset = await MockERC20Factory.deploy("Test Asset", "ASSET", 18);
    rewardToken = await MockERC20Factory.deploy("Reward Token", "REWARD", 18);

    // Deploy mock Uniswap router
    const MockUniswapFactory = await ethers.getContractFactory("MockUniswapV2Router");
    uniswapRouter = await MockUniswapFactory.deploy();

    // Set up exchange rate: 1 REWARD = 1.5 ASSET
    await uniswapRouter.setExchangeRate(
      await rewardToken.getAddress(),
      await asset.getAddress(),
      ethers.parseEther("1.5")
    );

    // Deploy vault
    const VaultFactory = await ethers.getContractFactory("RewardsVault4626");
    vault = await VaultFactory.deploy(
      await asset.getAddress(),
      "Test Vault",
      "TVAULT",
      18,
      LOCK_PERIOD,
      owner.address
    );

    // Deploy autocompounder
    const AutoCompounderFactory = await ethers.getContractFactory("RewardsVaultAutoCompounder");
    autoCompounder = await AutoCompounderFactory.deploy(
      await vault.getAddress(),
      "Auto Compound Vault",
      "ACV",
      MIN_CLAIM_THRESHOLD,
      await uniswapRouter.getAddress(),
      await asset.getAddress(),
      MAX_SLIPPAGE
    );

    // Mint tokens
    await asset.mint(user1.address, ethers.parseEther("10000"));
    await asset.mint(user2.address, ethers.parseEther("10000"));
    await rewardToken.mint(owner.address, ethers.parseEther("10000"));
    await asset.mint(owner.address, ethers.parseEther("10000"));

    // Provide liquidity to mock router for swaps
    await rewardToken.mint(await uniswapRouter.getAddress(), ethers.parseEther("5000"));
    await asset.mint(await uniswapRouter.getAddress(), ethers.parseEther("5000"));

    // Set up approvals
    await asset.connect(user1).approve(await autoCompounder.getAddress(), ethers.MaxUint256);
    await asset.connect(user2).approve(await autoCompounder.getAddress(), ethers.MaxUint256);
    await rewardToken.connect(owner).approve(await vault.getAddress(), ethers.MaxUint256);
    await asset.connect(owner).approve(await vault.getAddress(), ethers.MaxUint256);

    console.log("✅ All contracts deployed and configured");
  });

  describe("Full Auto-Compounding Flow", function () {
    it("Should perform complete auto-compounding with reward swaps", async function () {
      console.log("\n🚀 Testing full auto-compounding flow...");

      // Step 1: Users deposit into autocompounder
      const deposit1 = ethers.parseEther("1000");
      const deposit2 = ethers.parseEther("500");

      await autoCompounder.connect(user1).deposit(deposit1, user1.address);
      await autoCompounder.connect(user2).deposit(deposit2, user2.address);

      console.log(`📥 User1 deposited: ${ethers.formatEther(deposit1)} ASSET`);
      console.log(`📥 User2 deposited: ${ethers.formatEther(deposit2)} ASSET`);

      const totalAssetsBefore = await autoCompounder.totalAssets();
      console.log(`💰 Total assets before rewards: ${ethers.formatEther(totalAssetsBefore)}`);

      // Step 2: Add rewards to the vault
      const rewardAmount = ethers.parseEther("100");
      await vault.connect(owner).addReward(await rewardToken.getAddress(), rewardAmount);
      await rewardToken.connect(owner).transfer(await vault.getAddress(), rewardAmount);

      console.log(`🎁 Added ${ethers.formatEther(rewardAmount)} REWARD tokens as rewards`);

      // Step 3: Configure swap path for the reward token
      const swapPath = [await rewardToken.getAddress(), await asset.getAddress()];
      await autoCompounder.connect(owner).setSwapPath(await rewardToken.getAddress(), swapPath);

      console.log("🔄 Configured swap path for reward token");

      // Step 4: Perform auto-compound
      const tx = await autoCompounder.autoCompound();
      const receipt = await tx.wait();

      console.log("⚡ Auto-compound executed");

      // Step 5: Check results
      const totalAssetsAfter = await autoCompounder.totalAssets();
      const assetsIncrease = totalAssetsAfter - totalAssetsBefore;

      console.log(`💰 Total assets after auto-compound: ${ethers.formatEther(totalAssetsAfter)}`);
      console.log(`📈 Assets increase: ${ethers.formatEther(assetsIncrease)}`);

      // Assets should have increased due to reward swapping and reinvestment
      expect(totalAssetsAfter).to.be.gt(totalAssetsBefore);
      expect(assetsIncrease).to.be.gt(0);

      // Check exchange rate has improved
      const exchangeRate = await autoCompounder.exchangeRate();
      console.log(`📊 New exchange rate: ${ethers.formatEther(exchangeRate)}`);
      expect(exchangeRate).to.be.gt(ethers.parseEther("1"));

      // Verify events were emitted
      const autoCompoundEvent = receipt?.logs.find((log: any) => {
        try {
          const parsed = autoCompounder.interface.parseLog(log);
          return parsed?.name === "AutoCompound";
        } catch {
          return false;
        }
      });

      expect(autoCompoundEvent).to.not.be.undefined;
      console.log("✅ AutoCompound event emitted correctly");

      console.log("🎉 Full auto-compounding flow completed successfully!");
    });

    it("Should handle multiple reward tokens", async function () {
      console.log("\n🔄 Testing multiple reward tokens...");

      // Deploy second reward token
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const rewardToken2 = await MockERC20Factory.deploy("Reward Token 2", "REWARD2", 18);
      
      await rewardToken2.mint(owner.address, ethers.parseEther("10000"));
      await rewardToken2.mint(await uniswapRouter.getAddress(), ethers.parseEther("5000"));
      await rewardToken2.connect(owner).approve(await vault.getAddress(), ethers.MaxUint256);

      // Set exchange rate for second token
      await uniswapRouter.setExchangeRate(
        await rewardToken2.getAddress(),
        await asset.getAddress(),
        ethers.parseEther("0.8") // 1 REWARD2 = 0.8 ASSET
      );

      // User deposits
      await autoCompounder.connect(user1).deposit(ethers.parseEther("1000"), user1.address);

      // Add both reward tokens
      await vault.connect(owner).addReward(await rewardToken.getAddress(), ethers.parseEther("50"));
      await vault.connect(owner).addReward(await rewardToken2.getAddress(), ethers.parseEther("100"));

      await rewardToken.connect(owner).transfer(await vault.getAddress(), ethers.parseEther("50"));
      await rewardToken2.connect(owner).transfer(await vault.getAddress(), ethers.parseEther("100"));

      // Configure swap paths
      await autoCompounder.connect(owner).setSwapPath(
        await rewardToken.getAddress(),
        [await rewardToken.getAddress(), await asset.getAddress()]
      );
      await autoCompounder.connect(owner).setSwapPath(
        await rewardToken2.getAddress(),
        [await rewardToken2.getAddress(), await asset.getAddress()]
      );

      const assetsBefore = await autoCompounder.totalAssets();
      
      // Perform auto-compound
      await autoCompounder.autoCompound();
      
      const assetsAfter = await autoCompounder.totalAssets();
      
      console.log(`💰 Assets before: ${ethers.formatEther(assetsBefore)}`);
      console.log(`💰 Assets after: ${ethers.formatEther(assetsAfter)}`);
      
      expect(assetsAfter).to.be.gt(assetsBefore);
      console.log("✅ Multiple reward tokens handled correctly");
    });

    it("Should handle swap failures gracefully", async function () {
      console.log("\n⚠️  Testing swap failure handling...");

      await autoCompounder.connect(user1).deposit(ethers.parseEther("1000"), user1.address);

      // Add rewards
      await vault.connect(owner).addReward(await rewardToken.getAddress(), ethers.parseEther("50"));
      await rewardToken.connect(owner).transfer(await vault.getAddress(), ethers.parseEther("50"));

      // Configure router to fail swaps
      await uniswapRouter.setShouldFail(true);

      const assetsBefore = await autoCompounder.totalAssets();

      // Auto-compound should not revert even if swaps fail
      await expect(autoCompounder.autoCompound()).to.not.be.reverted;

      const assetsAfter = await autoCompounder.totalAssets();
      
      // Assets might not increase due to failed swaps, but function should not revert
      console.log(`💰 Assets before: ${ethers.formatEther(assetsBefore)}`);
      console.log(`💰 Assets after: ${ethers.formatEther(assetsAfter)}`);
      
      console.log("✅ Swap failures handled gracefully");
    });
  });

  describe("User Withdrawals After Auto-Compounding", function () {
    it("Should allow withdrawal with increased value after auto-compound", async function () {
      console.log("\n💸 Testing withdrawals after auto-compounding...");

      // Deposit
      const depositAmount = ethers.parseEther("1000");
      await autoCompounder.connect(user1).deposit(depositAmount, user1.address);

      // Add rewards using reward token (not the underlying asset)
      await vault.connect(owner).addReward(await rewardToken.getAddress(), ethers.parseEther("100"));
      await rewardToken.connect(owner).transfer(await vault.getAddress(), ethers.parseEther("100"));

      // Configure swap path
      await autoCompounder.connect(owner).setSwapPath(
        await rewardToken.getAddress(),
        [await rewardToken.getAddress(), await asset.getAddress()]
      );

      const sharesBefore = await autoCompounder.balanceOf(user1.address);
      console.log(`📊 User shares before auto-compound: ${ethers.formatEther(sharesBefore)}`);

      await autoCompounder.autoCompound();

      const sharesAfter = await autoCompounder.balanceOf(user1.address);
      const assetsValue = await autoCompounder.assetsOf(user1.address);
      
      console.log(`📊 User shares after auto-compound: ${ethers.formatEther(sharesAfter)}`);
      console.log(`💰 User assets value: ${ethers.formatEther(assetsValue)}`);

      // Shares remain the same, but their value in assets increases
      expect(sharesAfter).to.equal(sharesBefore);
      expect(assetsValue).to.be.gt(depositAmount);

      // Fast forward past lock period
      await ethers.provider.send("evm_increaseTime", [LOCK_PERIOD + 1]);
      await ethers.provider.send("evm_mine", []);

      const userAssetsBefore = await asset.balanceOf(user1.address);
      
      // Withdraw all shares
      await autoCompounder.connect(user1).withdraw(sharesAfter, user1.address);
      
      const userAssetsAfter = await asset.balanceOf(user1.address);
      const assetsReceived = userAssetsAfter - userAssetsBefore;

      console.log(`💰 Assets received: ${ethers.formatEther(assetsReceived)}`);
      
      // Should receive more than originally deposited due to auto-compounding
      expect(assetsReceived).to.be.gt(depositAmount);
      
      console.log("✅ Withdrawal with increased value successful");
    });
  });

  describe("Swap Path Management", function () {
    it("Should use default swap paths when none configured", async function () {
      console.log("\n🔄 Testing default swap paths...");

      const defaultPath = await autoCompounder.getSwapPath(await rewardToken.getAddress());
      
      console.log(`Default path length: ${defaultPath.length}`);
      console.log(`Path start: ${defaultPath[0]}`);
      console.log(`Path end: ${defaultPath[defaultPath.length - 1]}`);

      expect(defaultPath[0]).to.equal(await rewardToken.getAddress());
      expect(defaultPath[defaultPath.length - 1]).to.equal(await asset.getAddress());
      
      console.log("✅ Default swap paths working correctly");
    });

    it("Should test swap estimation", async function () {
      console.log("\n🧮 Testing swap estimation...");

      const testAmount = ethers.parseEther("100");
      const estimatedOutput = await autoCompounder.testSwap(await rewardToken.getAddress(), testAmount);

      console.log(`Input: ${ethers.formatEther(testAmount)} REWARD`);
      console.log(`Estimated output: ${ethers.formatEther(estimatedOutput)} ASSET`);

      expect(estimatedOutput).to.be.gt(0);
      
      // With 1.5x exchange rate, should get approximately 150 ASSET for 100 REWARD
      expect(estimatedOutput).to.be.closeTo(ethers.parseEther("150"), ethers.parseEther("1"));
      
      console.log("✅ Swap estimation working correctly");
    });
  });
});
