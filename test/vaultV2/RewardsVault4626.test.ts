import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { RewardsVault4626, SimpleToken } from "../../typechain-types";

describe("RewardsVault4626", function () {
    let vault: RewardsVault4626;
    let asset: SimpleToken;
    let rewardToken: SimpleToken;
    let owner: HardhatEthersSigner;
    let alice: HardhatEthersSigner;
    let bob: HardhatEthersSigner;

    beforeEach(async function () {
        [owner, alice, bob] = await ethers.getSigners();

        // Deploy SimpleToken as asset
        const SimpleToken = await ethers.getContractFactory("SimpleToken");
        asset = await SimpleToken.deploy("Test Asset", "TST", 18);
        await asset.waitForDeployment();

        // Deploy reward token
        rewardToken = await SimpleToken.deploy("Reward Token", "RWT", 18);
        await rewardToken.waitForDeployment();

        // Deploy vault
        const RewardsVault4626 = await ethers.getContractFactory("RewardsVault4626");
        vault = await RewardsVault4626.deploy(
            await asset.getAddress(),
            "Test Vault",
            "TVLT",
            18,
            0, // No lock period for testing
            owner.address // Add owner parameter
        );
        await vault.waitForDeployment();

        // Mint tokens
        await asset.mint(alice.address, ethers.parseEther("1000"));
        await asset.mint(bob.address, ethers.parseEther("1000"));
        await rewardToken.mint(owner.address, ethers.parseEther("1000"));
    });

    describe("Deployment", function () {
        it("Should deploy with correct parameters", async function () {
            expect(await vault.asset()).to.equal(await asset.getAddress());
            expect(await vault.name()).to.equal("Test Vault");
            expect(await vault.symbol()).to.equal("TVLT");
            expect(await vault.decimals()).to.equal(18);
        });
    });

    describe("Deposits", function () {
        it("Should allow users to deposit assets", async function () {
            const depositAmount = ethers.parseEther("100");
            
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await vault.connect(alice).deposit(depositAmount, alice.address);
            
            expect(await vault.balanceOf(alice.address)).to.equal(depositAmount);
            expect(await vault.totalAssets()).to.equal(depositAmount);
        });

        it("Should handle multiple deposits correctly", async function () {
            const aliceDeposit = ethers.parseEther("100");
            const bobDeposit = ethers.parseEther("200");
            
            await asset.connect(alice).approve(await vault.getAddress(), aliceDeposit);
            await vault.connect(alice).deposit(aliceDeposit, alice.address);
            
            await asset.connect(bob).approve(await vault.getAddress(), bobDeposit);
            await vault.connect(bob).deposit(bobDeposit, bob.address);
            
            expect(await vault.balanceOf(alice.address)).to.equal(aliceDeposit);
            expect(await vault.balanceOf(bob.address)).to.equal(bobDeposit);
            expect(await vault.totalAssets()).to.equal(aliceDeposit + bobDeposit);
        });
    });

    describe("Rewards", function () {
        beforeEach(async function () {
            // Setup: Alice and Bob deposit
            const depositAmount = ethers.parseEther("100");
            
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await vault.connect(alice).deposit(depositAmount, alice.address);
            
            await asset.connect(bob).approve(await vault.getAddress(), depositAmount);
            await vault.connect(bob).deposit(depositAmount, bob.address);
        });

        it("Should add rewards correctly", async function () {
            const rewardAmount = ethers.parseEther("50");
            
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Each user should have 25 tokens claimable (50/2)
            const aliceClaimable = await vault.getClaimableReward(alice.address, await rewardToken.getAddress());
            const bobClaimable = await vault.getClaimableReward(bob.address, await rewardToken.getAddress());
            
            expect(aliceClaimable).to.equal(ethers.parseEther("25"));
            expect(bobClaimable).to.equal(ethers.parseEther("25"));
        });

        it("Should distribute rewards proportionally", async function () {
            // Charlie deposits more after initial deposits
            const charlie = (await ethers.getSigners())[3];
            await asset.mint(charlie.address, ethers.parseEther("1000"));
            
            const charlieDeposit = ethers.parseEther("200"); // Double the others
            await asset.connect(charlie).approve(await vault.getAddress(), charlieDeposit);
            await vault.connect(charlie).deposit(charlieDeposit, charlie.address);
            
            // Now total is 400 (100+100+200), so ratios are 1:1:2
            const rewardAmount = ethers.parseEther("120");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            const aliceClaimable = await vault.getClaimableReward(alice.address, await rewardToken.getAddress());
            const bobClaimable = await vault.getClaimableReward(bob.address, await rewardToken.getAddress());
            const charlieClaimable = await vault.getClaimableReward(charlie.address, await rewardToken.getAddress());
            
            // Expected: 30, 30, 60 (1:1:2 ratio of 120)
            expect(aliceClaimable).to.equal(ethers.parseEther("30"));
            expect(bobClaimable).to.equal(ethers.parseEther("30"));
            expect(charlieClaimable).to.equal(ethers.parseEther("60"));
        });

        it("Should allow users to claim rewards", async function () {
            const rewardAmount = ethers.parseEther("50");
            
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            await vault.connect(alice).claimAllRewards();
            
            expect(await rewardToken.balanceOf(alice.address)).to.equal(ethers.parseEther("25"));
            expect(await vault.getClaimableReward(alice.address, await rewardToken.getAddress())).to.equal(0);
        });
    });

    describe("getUserReward Function", function () {
        let secondRewardToken: SimpleToken;

        beforeEach(async function () {
            // Deploy second reward token for multiple token testing
            const SimpleToken = await ethers.getContractFactory("SimpleToken");
            secondRewardToken = await SimpleToken.deploy("Second Reward", "SRW", 18);
            await secondRewardToken.waitForDeployment();
            await secondRewardToken.mint(owner.address, ethers.parseEther("1000"));

            // Setup initial deposits
            const depositAmount = ethers.parseEther("100");
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await asset.connect(bob).approve(await vault.getAddress(), depositAmount);
            
            await vault.connect(alice).deposit(depositAmount, alice.address);
            await vault.connect(bob).deposit(depositAmount, bob.address);
        });

        it("Should return empty arrays for user with no balance", async function () {
            const charlie = (await ethers.getSigners())[3];
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
            
            // Verify tokens are returned in correct order
            expect(tokens[0]).to.equal(await rewardToken.getAddress());
            expect(tokens[1]).to.equal(await secondRewardToken.getAddress());
            
            // Verify amounts (Alice has 50% of total supply)
            expect(amounts[0]).to.equal(ethers.parseEther("50")); // 50% of 100
            expect(amounts[1]).to.equal(ethers.parseEther("100")); // 50% of 200
        });

        it("Should return proportional rewards based on balance", async function () {
            // Add a third user with different balance
            const charlie = (await ethers.getSigners())[3];
            await asset.mint(charlie.address, ethers.parseEther("1000"));
            
            const charlieDeposit = ethers.parseEther("200"); // Double the others
            await asset.connect(charlie).approve(await vault.getAddress(), charlieDeposit);
            await vault.connect(charlie).deposit(charlieDeposit, charlie.address);
            
            // Add rewards
            const rewardAmount = ethers.parseEther("120");
            await rewardToken.approve(await vault.getAddress(), rewardAmount);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount);
            
            // Check rewards for all users
            const [aliceTokens, aliceAmounts] = await vault.getUserReward(alice.address);
            const [bobTokens, bobAmounts] = await vault.getUserReward(bob.address);
            const [charlieTokens, charlieAmounts] = await vault.getUserReward(charlie.address);
            
            // All should have same token
            expect(aliceTokens[0]).to.equal(await rewardToken.getAddress());
            expect(bobTokens[0]).to.equal(await rewardToken.getAddress());
            expect(charlieTokens[0]).to.equal(await rewardToken.getAddress());
            
            // Verify proportional distribution (1:1:2 ratio)
            expect(aliceAmounts[0]).to.equal(ethers.parseEther("30")); // 100/400 * 120 = 30
            expect(bobAmounts[0]).to.equal(ethers.parseEther("30"));   // 100/400 * 120 = 30
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
            const [bobTokens, bobAmounts] = await vault.getUserReward(bob.address);
            expect(bobAmounts[0]).to.equal(ethers.parseEther("50"));
        });

        it("Should handle multiple deposits and claims correctly", async function () {
            // Initial rewards
            const rewardAmount1 = ethers.parseEther("100");
            await rewardToken.approve(await vault.getAddress(), rewardAmount1);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount1);
            
            // Alice claims first batch
            await vault.connect(alice).claimAllRewards();
            
            // Add more rewards
            const rewardAmount2 = ethers.parseEther("200");
            await rewardToken.approve(await vault.getAddress(), rewardAmount2);
            await vault.addReward(await rewardToken.getAddress(), rewardAmount2);
            
            // Check Alice's new rewards
            const [tokens, amounts] = await vault.getUserReward(alice.address);
            
            expect(tokens.length).to.equal(1);
            expect(amounts[0]).to.equal(ethers.parseEther("100")); // 50% of new 200
        });
    });

    describe("ERC4626 Compliance", function () {
        it("Should implement totalAssets correctly", async function () {
            expect(await vault.totalAssets()).to.equal(0);
            
            const depositAmount = ethers.parseEther("100");
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await vault.connect(alice).deposit(depositAmount, alice.address);
            
            expect(await vault.totalAssets()).to.equal(depositAmount);
        });

        it("Should have correct totalSupply after deposits", async function () {
            const depositAmount = ethers.parseEther("100");
            await asset.connect(alice).approve(await vault.getAddress(), depositAmount);
            await vault.connect(alice).deposit(depositAmount, alice.address);
            
            expect(await vault.totalSupply()).to.equal(depositAmount);
        });
    });
});
