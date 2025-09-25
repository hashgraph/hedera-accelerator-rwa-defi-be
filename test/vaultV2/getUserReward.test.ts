import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("getUserReward Functions - Integration Tests", function () {
    let vault: any;
    let autoCompounder: any;
    let asset: any;
    let rewardToken: any;
    let secondRewardToken: any;
    let uniswapRouter: any;
    let owner: HardhatEthersSigner;
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;
    let charlie: HardhatEthersSigner;

    const LOCK_PERIOD = 0; // No lock for testing
    const MIN_CLAIM_THRESHOLD = ethers.parseEther("0.1");
    const MAX_SLIPPAGE = 300; // 3%

    beforeEach(async function () {
        [owner, alice, bob, charlie] = await ethers.getSigners();

        // Deploy tokens
        const MockERC20Factory = await ethers.getContractFactory("MockERC20");
        asset = await MockERC20Factory.deploy("Test Asset", "ASSET", 18);
        rewardToken = await MockERC20Factory.deploy("Reward Token", "REWARD", 18);
        secondRewardToken = await MockERC20Factory.deploy("Second Reward", "REWARD2", 18);

        // Deploy mock Uniswap router
        const MockUniswapFactory = await ethers.getContractFactory("MockUniswapV2Router");
        uniswapRouter = await MockUniswapFactory.deploy();

        // Set up exchange rates
        await uniswapRouter.setExchangeRate(
            await rewardToken.getAddress(),
            await asset.getAddress(),
            ethers.parseEther("1.5")
        );
        await uniswapRouter.setExchangeRate(
            await secondRewardToken.getAddress(),
            await asset.getAddress(),
            ethers.parseEther("2.0")
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
            "Auto Compounder",
            "AC-VAULT",
            MIN_CLAIM_THRESHOLD,
            await uniswapRouter.getAddress(),
            await asset.getAddress(), // Use asset as intermediate token
            MAX_SLIPPAGE
        );

        // Mint tokens to users
        await asset.mint(alice.address, ethers.parseEther("10000"));
        await asset.mint(bob.address, ethers.parseEther("10000"));
        await asset.mint(charlie.address, ethers.parseEther("10000"));
        
        // Mint reward tokens to owner
        await rewardToken.mint(owner.address, ethers.parseEther("10000"));
        await secondRewardToken.mint(owner.address, ethers.parseEther("10000"));
    });

    describe("RewardsVault4626 getUserReward Function", function () {
        beforeEach(async function () {
            // Setup initial deposits in vault
            const depositAmount = ethers.parseEther("100");
            
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await asset.connect(bob).approve(await vault.getAddress(), depositAmount);
            
            await vault.connect(alice).deposit(depositAmount, alice.address);
            await vault.connect(bob).deposit(depositAmount, bob.address);
        });

        it("Should return empty arrays for user with no balance", async function () {
            const [tokens, amounts] = await vault.getUserReward(charlie.address);
            
            expect(tokens.length).to.equal(0);
            expect(amounts.length).to.equal(0);
        });

        it("Should return correct rewards for single token", async function () {
            // Add rewards
            const rewardAmount = ethers.parseEther("100");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Check Alice's rewards
            const [tokens, amounts] = await vault.getUserReward(alice.address);
            
            expect(tokens.length).to.equal(1);
            expect(amounts.length).to.equal(1);
            expect(tokens[0]).to.equal(await rewardToken.getAddress());
            expect(amounts[0]).to.equal(ethers.parseEther("50")); // 50% of 100
        });

        it("Should return correct rewards for multiple tokens", async function () {
            // Add first reward token
            const rewardAmount1 = ethers.parseEther("100");
            await rewardToken.approve(await vault.getAddress(), rewardAmount1);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount1);
            
            // Add second reward token
            const rewardAmount2 = ethers.parseEther("200");
            await secondRewardToken.approve(await vault.getAddress(), rewardAmount2);
            await vault.addReward(await secondRewardToken.getAddress(), rewardAmount2);
            
            // Check Alice's rewards
            const [tokens, amounts] = await vault.getUserReward(alice.address);
            
            expect(tokens.length).to.equal(2);
            expect(amounts.length).to.equal(2);
            
            // Verify tokens are returned
            expect(tokens).to.include(await rewardToken.getAddress());
            expect(tokens).to.include(await secondRewardToken.getAddress());
            
            // Verify amounts (Alice has 50% of total supply)
            const rewardTokenAddress = await rewardToken.getAddress();
            const secondRewardTokenAddress = await secondRewardToken.getAddress();
            const rewardIndex = tokens.findIndex((t: string) => t === rewardTokenAddress);
            const secondRewardIndex = tokens.findIndex((t: string) => t === secondRewardTokenAddress);
            
            expect(amounts[rewardIndex]).to.equal(ethers.parseEther("50")); // 50% of 100
            expect(amounts[secondRewardIndex]).to.equal(ethers.parseEther("100")); // 50% of 200
        });

        it("Should return proportional rewards based on balance", async function () {
            // Add a third user with different balance
            const charlieDeposit = ethers.parseEther("200"); // Double the others
            await asset.connect(charlie).approve(await vault.getAddress(), charlieDeposit);
            await vault.connect(charlie).deposit(charlieDeposit, charlie.address);
            
            // Add rewards
            const rewardAmount = ethers.parseEther("120");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Check rewards for all users
            const [, aliceAmounts] = await vault.getUserReward(alice.address);
            const [, bobAmounts] = await vault.getUserReward(bob.address);
            const [, charlieAmounts] = await vault.getUserReward(charlie.address);
            
            // Verify proportional distribution (1:1:2 ratio of 120)
            expect(aliceAmounts[0]).to.equal(ethers.parseEther("30"));   // 100/400 * 120 = 30
            expect(bobAmounts[0]).to.equal(ethers.parseEther("30"));     // 100/400 * 120 = 30
            expect(charlieAmounts[0]).to.equal(ethers.parseEther("60")); // 200/400 * 120 = 60
        });

        it("Should return zero rewards after claiming", async function () {
            // Add rewards
            const rewardAmount = ethers.parseEther("100");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Alice claims rewards
            await vault.connect(alice).claimAllRewards();
            
            // Check Alice's remaining rewards
            const [tokens, amounts] = await vault.getUserReward(alice.address);
            
            expect(tokens.length).to.equal(1);
            expect(amounts[0]).to.equal(0);
            
            // Bob should still have rewards
            const [, bobAmounts] = await vault.getUserReward(bob.address);
            expect(bobAmounts[0]).to.equal(ethers.parseEther("50"));
        });
    });

    describe("RewardsVaultAutoCompounder getUserReward Function", function () {
        beforeEach(async function () {
            // Setup initial deposits in autocompounder
            const depositAmount = ethers.parseEther("100");
            
            await asset.connect(alice).approve(await autoCompounder.getAddress(), depositAmount);
            await asset.connect(bob).approve(await autoCompounder.getAddress(), depositAmount);
            
            await autoCompounder.connect(alice).deposit(depositAmount, alice.address);
            await autoCompounder.connect(bob).deposit(depositAmount, bob.address);
        });

        it("Should return empty arrays for user with no balance", async function () {
            const [tokens, amounts] = await autoCompounder.getUserReward(charlie.address);
            
            expect(tokens.length).to.equal(0);
            expect(amounts.length).to.equal(0);
        });

        it("Should return proportional rewards for autocompounder users", async function () {
            // Add rewards to the underlying vault
            const rewardAmount = ethers.parseEther("100");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Check Alice's proportional rewards in autocompounder
            const [tokens, amounts] = await autoCompounder.getUserReward(alice.address);
            
            expect(tokens.length).to.equal(1);
            expect(amounts.length).to.equal(1);
            expect(tokens[0]).to.equal(await rewardToken.getAddress());
            expect(amounts[0]).to.equal(ethers.parseEther("50")); // Alice has 50% of autocompounder tokens
        });

        it("Should handle different proportions in autocompounder", async function () {
            // Add a third user with different balance
            const charlieDeposit = ethers.parseEther("200"); // Double the others
            await asset.connect(charlie).approve(await autoCompounder.getAddress(), charlieDeposit);
            await autoCompounder.connect(charlie).deposit(charlieDeposit, charlie.address);
            
            // Add rewards to underlying vault
            const rewardAmount = ethers.parseEther("120");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Check rewards for all autocompounder users
            const [, aliceAmounts] = await autoCompounder.getUserReward(alice.address);
            const [, bobAmounts] = await autoCompounder.getUserReward(bob.address);
            const [, charlieAmounts] = await autoCompounder.getUserReward(charlie.address);
            
            // Verify proportional distribution based on autocompounder shares (1:1:2 ratio)
            // Total autocompounder tokens: 100 + 100 + 200 = 400
            expect(aliceAmounts[0]).to.equal(ethers.parseEther("30"));   // 100/400 * 120 = 30
            expect(bobAmounts[0]).to.equal(ethers.parseEther("30"));     // 100/400 * 120 = 30
            expect(charlieAmounts[0]).to.equal(ethers.parseEther("60")); // 200/400 * 120 = 60
        });

        it("Should handle multiple reward tokens in autocompounder", async function () {
            // Add multiple reward tokens to vault
            const rewardAmount1 = ethers.parseEther("100");
            const rewardAmount2 = ethers.parseEther("200");
            
            await rewardToken.approve(await vault.getAddress(), rewardAmount1);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount1);
            
            await secondRewardToken.approve(await vault.getAddress(), rewardAmount2);
            await vault.addReward(await secondRewardToken.getAddress(), rewardAmount2);
            
            // Check Alice's rewards
            const [tokens, amounts] = await autoCompounder.getUserReward(alice.address);
            
            expect(tokens.length).to.equal(2);
            expect(amounts.length).to.equal(2);
            
            // Verify tokens are included
            expect(tokens).to.include(await rewardToken.getAddress());
            expect(tokens).to.include(await secondRewardToken.getAddress());
            
            // Verify proportional amounts (Alice has 50% of autocompounder)
            const rewardTokenAddress = await rewardToken.getAddress();
            const secondRewardTokenAddress = await secondRewardToken.getAddress();
            const rewardIndex = tokens.findIndex((t: string) => t === rewardTokenAddress);
            const secondRewardIndex = tokens.findIndex((t: string) => t === secondRewardTokenAddress);
            
            expect(amounts[rewardIndex]).to.equal(ethers.parseEther("50"));   // 50% of 100
            expect(amounts[secondRewardIndex]).to.equal(ethers.parseEther("100")); // 50% of 200
        });

        it("Should return zero when no rewards are available", async function () {
            // Don't add any rewards to vault
            const [tokens, amounts] = await autoCompounder.getUserReward(alice.address);
            
            // Should return empty arrays if no reward tokens exist
            expect(tokens.length).to.equal(0);
            expect(amounts.length).to.equal(0);
        });

        it("Should handle case when autocompounder has no balance in vault", async function () {
            // Create a new autocompounder without any deposits to vault
            const newAutoCompounder = await (await ethers.getContractFactory("RewardsVaultAutoCompounder")).deploy(
                await vault.getAddress(),
                "Empty Auto Compounder",
                "EMPTY-AC",
                MIN_CLAIM_THRESHOLD,
                await uniswapRouter.getAddress(),
                await asset.getAddress(),
                MAX_SLIPPAGE
            );
            
            // Add rewards to vault (but only our original autocompounder has deposits)
            const rewardAmount = ethers.parseEther("100");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Deposit into the new autocompounder (but it won't have proportional rewards)
            const depositAmount = ethers.parseEther("100");
            await asset.connect(alice).approve(await newAutoCompounder.getAddress(), depositAmount);
            await newAutoCompounder.connect(alice).deposit(depositAmount, alice.address);
            
            // Check rewards - should get no rewards because the new autocompounder has no vault balance when rewards were added
            const [tokens, amounts] = await (newAutoCompounder as any).getUserReward(alice.address);
            
            expect(tokens.length).to.equal(1);
            expect(amounts[0]).to.equal(0); // No rewards because the autocompounder wasn't deposited when rewards were distributed
        });
    });

    describe("Integration Tests - Vault and AutoCompounder", function () {
        it("Should maintain reward consistency between vault and autocompounder", async function () {
            // Setup: Direct vault user and autocompounder user with same amounts
            const depositAmount = ethers.parseEther("100");
            
            // Direct vault deposit by Alice
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await vault.connect(alice).deposit(depositAmount, alice.address);
            
            // AutoCompounder deposit by Bob (which deposits into same vault)
            await asset.connect(bob).approve(await autoCompounder.getAddress(), depositAmount);
            await autoCompounder.connect(bob).deposit(depositAmount, bob.address);
            
            // Add rewards to vault
            const rewardAmount = ethers.parseEther("200");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Check Alice's direct vault rewards
            const [aliceVaultTokens, aliceVaultAmounts] = await vault.getUserReward(alice.address);
            
            // Check Bob's autocompounder rewards
            const [bobACTokens, bobACAmounts] = await autoCompounder.getUserReward(bob.address);
            
            // Both should get equal rewards (50% each)
            expect(aliceVaultAmounts[0]).to.equal(ethers.parseEther("100"));
            expect(bobACAmounts[0]).to.equal(ethers.parseEther("100"));
            expect(aliceVaultTokens[0]).to.equal(bobACTokens[0]);
        });
    });
});