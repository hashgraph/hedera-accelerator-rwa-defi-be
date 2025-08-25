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
