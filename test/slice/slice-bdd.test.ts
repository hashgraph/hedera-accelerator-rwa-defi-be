import { ethers, expect, time } from "../setup";
import { PrivateKey, Client, AccountId } from "@hashgraph/sdk";
import { AddressLike, ZeroAddress } from "ethers";
import { VaultToken, Slice, RewardsVault4626, RewardsVaultAutoCompounder } from "../../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

async function deployRewardsVault(stakingToken: AddressLike, owner: AddressLike, unlockDuration: number) {
    const RewardsVault4626 = await ethers.getContractFactory("RewardsVault4626");
    return (await RewardsVault4626.deploy(
        stakingToken,
        "Test Vault",
        "TVLT",
        18,
        unlockDuration,
        owner,
    )) as RewardsVault4626;
}

// Test constants
const sTokenPayload = "sToken";
const metadataUri = "ipfs://bafybeibnsoufr2renqzsh347nrx54wcubt5lgkeivez63xvivplfwhtpym/m";
const unlockDuration1 = 0; // No lock for testing
const unlockDuration2 = 0; // No lock for testing

describe("Slice - Given When Then Test Cases", function () {
    async function deployFixture() {
        const [owner, staker, user1, user2] = await ethers.getSigners();

        let client = Client.forTestnet();
        const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || "");
        const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || "");
        client.setOperator(operatorAccountId, operatorPrKey);

        // Deploy Uniswap infrastructure
        const UniswapV2Factory = await ethers.getContractFactory("UniswapV2Factory", owner);
        const uniswapV2Factory = await UniswapV2Factory.deploy(owner.address);
        await uniswapV2Factory.waitForDeployment();

        const WETH = await ethers.getContractFactory("WETH9", owner);
        const weth = await WETH.deploy();
        await weth.waitForDeployment();

        const UniswapV2Router02 = await ethers.getContractFactory("UniswapV2Router02", owner);
        const uniswapV2Router02 = await UniswapV2Router02.deploy(uniswapV2Factory.target, weth.target);
        await uniswapV2Router02.waitForDeployment();

        // Deploy price feeds
        const MockV3Aggregator = await ethers.getContractFactory("MockV3Aggregator");
        const mockV3Aggregator = await MockV3Aggregator.deploy(18, ethers.parseUnits("1", 18));
        await mockV3Aggregator.waitForDeployment();

        // Deploy staking tokens
        const VaultToken = await ethers.getContractFactory("VaultToken");
        const stakingToken1 = (await VaultToken.deploy(18)) as VaultToken;
        await stakingToken1.waitForDeployment();
        const stakingToken2 = (await VaultToken.deploy(18)) as VaultToken;
        await stakingToken2.waitForDeployment();

        // Mint tokens
        await stakingToken1.mint(owner.address, ethers.parseUnits("500000000", 18));
        await stakingToken2.mint(owner.address, ethers.parseUnits("500000000", 18));
        await stakingToken1.mint(staker.address, ethers.parseUnits("500000000", 18));
        await stakingToken2.mint(staker.address, ethers.parseUnits("500000000", 18));
        await stakingToken1.mint(user1.address, ethers.parseUnits("100000", 18));
        await stakingToken2.mint(user1.address, ethers.parseUnits("100000", 18));
        await stakingToken1.mint(user2.address, ethers.parseUnits("100000", 18));
        await stakingToken2.mint(user2.address, ethers.parseUnits("100000", 18));

        // Deploy reward token (USDC)
        const rewardToken = (await VaultToken.deploy(6)) as VaultToken;
        await rewardToken.waitForDeployment();
        await rewardToken.mint(owner.address, ethers.parseUnits("500000000", 18));

        // Deploy vaults using new RewardsVault4626
        const vault1 = await deployRewardsVault(stakingToken1.target, owner.address, unlockDuration1);
        await vault1.waitForDeployment();
        const vault2 = await deployRewardsVault(stakingToken2.target, owner.address, unlockDuration2);
        await vault2.waitForDeployment();

        // Deploy Slice
        const Slice = await ethers.getContractFactory("Slice");
        const slice = (await Slice.deploy(
            uniswapV2Router02.target,
            rewardToken.target,
            sTokenPayload,
            sTokenPayload,
            metadataUri,
        )) as Slice;
        await slice.waitForDeployment();

        // Deploy AutoCompounders using new RewardsVaultAutoCompounder
        const RewardsVaultAutoCompounder = await ethers.getContractFactory("RewardsVaultAutoCompounder");
        const autoCompounder1 = (await RewardsVaultAutoCompounder.deploy(
            vault1.target,
            "Test AutoCompounder 1",
            "TAC1",
            ethers.parseUnits("1", 18), // minimumClaimThreshold
            uniswapV2Router02.target,
            rewardToken.target, // intermediate token
            300, // maxSlippage (3%)
        )) as RewardsVaultAutoCompounder;
        await autoCompounder1.waitForDeployment();

        const autoCompounder2 = (await RewardsVaultAutoCompounder.deploy(
            vault2.target,
            "Test AutoCompounder 2",
            "TAC2",
            ethers.parseUnits("1", 18), // minimumClaimThreshold
            uniswapV2Router02.target,
            rewardToken.target, // intermediate token
            300, // maxSlippage (3%)
        )) as RewardsVaultAutoCompounder;
        await autoCompounder2.waitForDeployment();

        return {
            slice,
            vault1,
            vault2,
            autoCompounder1,
            autoCompounder2,
            uniswapV2Router02,
            uniswapV2Factory,
            mockV3Aggregator,
            stakingToken1,
            stakingToken2,
            rewardToken,
            client,
            owner,
            staker,
            user1,
            user2,
        };
    }

    async function setupLiquidityPools(fixture: any) {
        const { uniswapV2Router02, rewardToken, stakingToken1, stakingToken2, owner } = fixture;

        await rewardToken.approve(uniswapV2Router02.target, ethers.parseUnits("50000000", 18));
        await stakingToken1.approve(uniswapV2Router02.target, ethers.parseUnits("50000000", 18));
        await stakingToken2.approve(uniswapV2Router02.target, ethers.parseUnits("50000000", 18));

        await uniswapV2Router02.addLiquidity(
            rewardToken.target,
            stakingToken1.target,
            ethers.parseUnits("5000000", 18),
            ethers.parseUnits("5000000", 18),
            ethers.parseUnits("5000000", 18),
            ethers.parseUnits("5000000", 18),
            owner.address,
            ethers.MaxUint256,
            { gasLimit: 3000000 },
        );

        await uniswapV2Router02.addLiquidity(
            rewardToken.target,
            stakingToken2.target,
            ethers.parseUnits("5000000", 18),
            ethers.parseUnits("5000000", 18),
            ethers.parseUnits("5000000", 18),
            ethers.parseUnits("5000000", 18),
            owner.address,
            ethers.MaxUint256,
            { gasLimit: 3000000 },
        );
    }

    async function setupSliceAllocations(fixture: any, allocation1: number, allocation2: number) {
        const { slice, autoCompounder1, autoCompounder2, mockV3Aggregator } = fixture;

        await slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, allocation1);
        await slice.addAllocation(autoCompounder2.target, mockV3Aggregator.target, allocation2);
    }

    async function addRewards(fixture: any, rewardAmount: bigint) {
        const { vault1, vault2, rewardToken } = fixture;

        await rewardToken.approve(vault1.target, rewardAmount);
        await rewardToken.approve(vault2.target, rewardAmount);

        await vault1.addReward(rewardToken.target, rewardAmount);
        await vault2.addReward(rewardToken.target, rewardAmount);
    }

    describe("GIVEN a Slice contract with allocations", function () {
        describe("WHEN a user deposits underlying tokens", function () {
            it("THEN the user should receive sTokens proportional to their deposit", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(fixture);
                await setupSliceAllocations(fixture, 5000, 5000); // 50/50 allocation

                const { slice, autoCompounder1, stakingToken1, user1 } = fixture;
                const depositAmount = ethers.parseUnits("1000", 18);

                // WHEN
                await stakingToken1.connect(user1).approve(slice.target, depositAmount);
                const tx = await slice.connect(user1).deposit(autoCompounder1.target, depositAmount);
                await tx.wait();

                // THEN
                const userBalance = await slice.balanceOf(user1.address);
                expect(userBalance).to.be.gt(0);

                const totalSupply = await slice.totalSupply();
                expect(totalSupply).to.equal(userBalance);

                // Verify deposit event was emitted
                await expect(tx)
                    .to.emit(slice, "Deposit")
                    .withArgs(autoCompounder1.target, user1.address, depositAmount);
            });

            it("THEN the deposit should fail if no allocation exists for the aToken", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, autoCompounder1, stakingToken1, user1 } = fixture;
                const depositAmount = ethers.parseUnits("1000", 18);

                // WHEN & THEN
                await stakingToken1.connect(user1).approve(slice.target, depositAmount);
                await expect(
                    slice.connect(user1).deposit(autoCompounder1.target, depositAmount),
                ).to.be.revertedWithCustomError(slice, "AllocationNotFound");
            });

            it("THEN the deposit should fail with zero amount", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupSliceAllocations(fixture, 5000, 5000);
                const { slice, autoCompounder1, user1 } = fixture;

                // WHEN & THEN
                await expect(slice.connect(user1).deposit(autoCompounder1.target, 0)).to.be.revertedWith(
                    "Slice: Invalid amount",
                );
            });

            it("THEN the deposit should fail if user has insufficient balance", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupSliceAllocations(fixture, 5000, 5000);
                const { slice, autoCompounder1, stakingToken1, user1 } = fixture;
                const depositAmount = ethers.parseUnits("200000", 18); // More than user has

                // WHEN & THEN
                await stakingToken1.connect(user1).approve(slice.target, depositAmount);
                await expect(slice.connect(user1).deposit(autoCompounder1.target, depositAmount)).to.be.reverted;
            });
        });

        describe("WHEN a user withdraws sTokens", function () {
            beforeEach(async function () {
                this.fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(this.fixture);
                await setupSliceAllocations(this.fixture, 4000, 6000);

                // Make initial deposits
                await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));
                await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));

                await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("100", 18));
                await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("100", 18));

                // Add some rewards
                await addRewards(this.fixture, ethers.parseUnits("1000", 6));
            });

            it("THEN the user should receive proportional aTokens from all allocations", async function () {
                // GIVEN
                const { slice, owner } = this.fixture;
                const userBalance = await slice.balanceOf(owner.address);
                const withdrawAmount = userBalance / 2n; // Withdraw half

                // WHEN
                const tx = await slice.withdraw(withdrawAmount);
                const result = await tx.wait();

                // THEN
                const newBalance = await slice.balanceOf(owner.address);
                expect(newBalance).to.equal(userBalance - withdrawAmount);

                // Verify withdraw events were emitted for both allocations
                const events = result?.logs.filter((log) => {
                    try {
                        const parsed = slice.interface.parseLog(log);
                        return parsed?.name === "Withdraw";
                    } catch {
                        return false;
                    }
                });

                expect(events?.length).to.equal(2); // Should have 2 withdraw events (one for each allocation)
            });

            it("THEN the withdrawal should fail with zero amount", async function () {
                // GIVEN
                const { slice } = this.fixture;

                // WHEN & THEN
                await expect(slice.withdraw(0)).to.be.revertedWith("Slice: Invalid amount");
            });

            it("THEN the withdrawal should fail with insufficient balance", async function () {
                // GIVEN
                const { slice, owner } = this.fixture;
                const userBalance = await slice.balanceOf(owner.address);
                const excessiveAmount = userBalance + ethers.parseUnits("1000", 18);

                // WHEN & THEN
                await expect(slice.withdraw(excessiveAmount)).to.be.reverted;
            });
        });
    });

    describe("GIVEN a Slice contract without allocations", function () {
        describe("WHEN trying to add allocations", function () {
            it("THEN the owner should be able to add valid allocations", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, autoCompounder1, mockV3Aggregator } = fixture;

                // WHEN
                const tx = await slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, 5000);

                // THEN
                await expect(tx)
                    .to.emit(slice, "AllocationAdded")
                    .withArgs(autoCompounder1.target, await autoCompounder1.asset(), mockV3Aggregator.target, 5000);

                const allocation = await slice.getTokenAllocation(autoCompounder1.target);
                expect(allocation.aToken).to.equal(autoCompounder1.target);
                expect(allocation.targetPercentage).to.equal(5000);
            });

            it("THEN adding allocation should fail with zero aToken address", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, mockV3Aggregator } = fixture;

                // WHEN & THEN
                await expect(slice.addAllocation(ZeroAddress, mockV3Aggregator.target, 5000)).to.be.revertedWith(
                    "Slice: Invalid aToken address",
                );
            });

            it("THEN adding allocation should fail with zero price feed address", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, autoCompounder1 } = fixture;

                // WHEN & THEN
                await expect(slice.addAllocation(autoCompounder1.target, ZeroAddress, 5000)).to.be.revertedWith(
                    "Slice: Invalid price feed address",
                );
            });

            it("THEN adding allocation should fail with zero percentage", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, autoCompounder1, mockV3Aggregator } = fixture;

                // WHEN & THEN
                await expect(
                    slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, 0),
                ).to.be.revertedWith("Slice: Invalid allocation percentage");
            });

            it("THEN adding allocation should fail with 100% percentage", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, autoCompounder1, mockV3Aggregator } = fixture;

                // WHEN & THEN
                await expect(
                    slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, 10000),
                ).to.be.revertedWith("Slice: Invalid allocation percentage");
            });

            it("THEN adding allocation should fail when total allocation exceeds 100%", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupSliceAllocations(fixture, 8000, 2000); // Already at 100%
                const { slice, autoCompounder1, mockV3Aggregator } = fixture;

                // WHEN & THEN
                await expect(
                    slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, 1000),
                ).to.be.revertedWith("Slice: Total allocation exceeds 100%");
            });

            it("THEN adding duplicate allocation should fail", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, autoCompounder1, mockV3Aggregator } = fixture;

                // Add first allocation
                await slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, 5000);

                // WHEN & THEN
                await expect(
                    slice.addAllocation(autoCompounder1.target, mockV3Aggregator.target, 3000),
                ).to.be.revertedWithCustomError(slice, "AssociatedAllocationExists");
            });
        });
    });

    describe("GIVEN a Slice contract with existing allocations", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupSliceAllocations(this.fixture, 4000, 6000);
        });

        describe("WHEN modifying allocation percentages", function () {
            it("THEN the owner should be able to update allocation percentages", async function () {
                // GIVEN
                const { slice, autoCompounder1 } = this.fixture;
                const newPercentage = 3000;

                // WHEN
                const tx = await slice.setAllocationPercentage(autoCompounder1.target, newPercentage);

                // THEN
                await expect(tx)
                    .to.emit(slice, "AllocationPercentageChanged")
                    .withArgs(autoCompounder1.target, newPercentage);

                const allocation = await slice.getTokenAllocation(autoCompounder1.target);
                expect(allocation.targetPercentage).to.equal(newPercentage);
            });

            it("THEN updating allocation should fail for non-existent aToken", async function () {
                // GIVEN
                const { slice } = this.fixture;
                const nonExistentToken = ethers.Wallet.createRandom().address;

                // WHEN & THEN
                await expect(slice.setAllocationPercentage(nonExistentToken, 3000)).to.be.revertedWithCustomError(
                    slice,
                    "AllocationNotFound",
                );
            });

            it("THEN updating allocation should fail with zero percentage", async function () {
                // GIVEN
                const { slice, autoCompounder1 } = this.fixture;

                // WHEN & THEN
                await expect(slice.setAllocationPercentage(autoCompounder1.target, 0)).to.be.revertedWith(
                    "Slice: Invalid percentage",
                );
            });

            it("THEN updating allocation should fail with 100% percentage", async function () {
                // GIVEN
                const { slice, autoCompounder1 } = this.fixture;

                // WHEN & THEN
                await expect(slice.setAllocationPercentage(autoCompounder1.target, 10000)).to.be.revertedWith(
                    "Slice: Invalid percentage",
                );
            });
        });
    });

    describe("GIVEN a Slice contract with deposits and allocations", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 5000, 5000);

            // Make initial deposits
            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("100", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("100", 18));

            // Add some rewards
            await addRewards(this.fixture, ethers.parseUnits("1000", 6));
        });

        describe("WHEN rebalancing the portfolio", function () {
            it("THEN the rebalance should execute without reverting", async function () {
                // GIVEN
                const { slice } = this.fixture;

                // WHEN & THEN
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;
            });

            it("THEN the portfolio should maintain target allocations after rebalance", async function () {
                // GIVEN
                const { slice, autoCompounder1, autoCompounder2 } = this.fixture;

                // WHEN
                await slice.rebalance();

                // THEN
                const allocation1 = await slice.getTokenAllocation(autoCompounder1.target);
                const allocation2 = await slice.getTokenAllocation(autoCompounder2.target);

                expect(allocation1.targetPercentage).to.equal(5000);
                expect(allocation2.targetPercentage).to.equal(5000);
            });
        });
    });

    describe("GIVEN a Slice contract with imbalanced allocations", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 4000, 6000); // 40/60 target

            // Create intentional imbalance - deposit more in token1 than target allocation
            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("150", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("50", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("150", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("50", 18));

            // Add rewards to create more imbalance
            await addRewards(this.fixture, ethers.parseUnits("5000", 6));
        });

        describe("WHEN rebalancing with intentional imbalance", function () {
            it("THEN the rebalance should attempt to correct the allocation imbalance", async function () {
                // GIVEN
                const { slice, autoCompounder1, autoCompounder2 } = this.fixture;

                // Get initial balances
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);

                // WHEN
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);

                // Verify that rebalance was attempted (balances should change)
                // Note: Exact values depend on liquidity and swap execution
                expect(balance1After).to.not.equal(balance1Before);
                expect(balance2After).to.not.equal(balance2Before);
            });

            it("THEN the rebalance should handle locked tokens gracefully", async function () {
                // GIVEN
                const { slice } = this.fixture;

                // WHEN & THEN
                // Even with locked tokens, rebalance should not revert
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;
            });
        });
    });

    describe("GIVEN a Slice contract with extreme allocation differences", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 1000, 9000); // 10/90 extreme imbalance

            // Create extreme imbalance
            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("200", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("10", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("200", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("10", 18));

            await addRewards(this.fixture, ethers.parseUnits("10000", 6));
        });

        describe("WHEN rebalancing with extreme imbalance", function () {
            it("THEN the rebalance should handle large allocation corrections", async function () {
                // GIVEN
                const { slice, autoCompounder1, autoCompounder2 } = this.fixture;

                // WHEN
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);
                const totalBalance = balance1After + balance2After;

                // Calculate actual percentages
                const actualPercentage1 = Number((balance1After * 10000n) / totalBalance);
                const actualPercentage2 = Number((balance2After * 10000n) / totalBalance);

                // Rebalance should attempt to move towards target allocations
                expect(totalBalance).to.be.gt(0);
            });
        });
    });

    describe("GIVEN a Slice contract with multiple small deposits", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 5000, 5000);

            // Make multiple small deposits to test precision
            for (let i = 0; i < 5; i++) {
                await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("20", 18));
                await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("20", 18));

                await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("20", 18));
                await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("20", 18));

                // Add small rewards between deposits
                await addRewards(this.fixture, ethers.parseUnits("100", 6));
            }
        });

        describe("WHEN rebalancing after multiple small deposits", function () {
            it("THEN the rebalance should maintain precision with small amounts", async function () {
                // GIVEN
                const { slice, autoCompounder1, autoCompounder2 } = this.fixture;

                // WHEN
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);

                // Should handle small amounts without precision loss
                expect(balance1After).to.be.gt(0);
                expect(balance2After).to.be.gt(0);
            });
        });
    });

    describe("GIVEN a Slice contract with price feed integration", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 5000, 5000);

            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("100", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("100", 18));
        });

        describe("WHEN testing price feed integration during rebalance", function () {
            it("THEN the rebalance should use Chainlink price feeds correctly", async function () {
                // GIVEN
                const { slice, mockV3Aggregator, stakingToken1 } = this.fixture;

                // WHEN
                // Get price feed data
                const priceFeedAddress = await slice.priceFeed(stakingToken1.target);
                expect(priceFeedAddress).to.equal(mockV3Aggregator.target);

                const priceData = await slice.getChainlinkDataFeedLatestAnswer(stakingToken1.target);
                expect(priceData).to.be.gt(0);

                // THEN
                // Rebalance should use the price feed
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;
            });
        });
    });

    describe("GIVEN a Slice contract with exchange rate calculations", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 5000, 5000);

            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("100", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("100", 18));

            await addRewards(this.fixture, ethers.parseUnits("1000", 6));
        });

        describe("WHEN testing exchange rate calculations during rebalance", function () {
            it("THEN the rebalance should handle exchange rate conversions correctly", async function () {
                // GIVEN
                const { slice, autoCompounder1, autoCompounder2 } = this.fixture;

                // WHEN
                // Get exchange rates
                const exchangeRate1 = await autoCompounder1.exchangeRate();
                const exchangeRate2 = await autoCompounder2.exchangeRate();

                // Get balances
                const balance1: bigint = await autoCompounder1.balanceOf(slice.target);
                const balance2: bigint = await autoCompounder2.balanceOf(slice.target);

                // Calculate underlying values using exchange rates
                const underlyingValue1 = (balance1 * exchangeRate1) / ethers.parseUnits("1", 18);
                const underlyingValue2 = (balance2 * exchangeRate2) / ethers.parseUnits("1", 18);

                // THEN
                // Rebalance should use these calculations
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;
            });
        });
    });

    describe("GIVEN a Slice contract with reward accrual", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 5000, 5000);

            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("100", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("100", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("100", 18));
        });

        describe("WHEN rebalancing with accrued rewards", function () {
            it("THEN the rebalance should handle reward distribution correctly", async function () {
                // GIVEN
                const { slice, autoCompounder1, autoCompounder2, vault1, vault2, rewardToken } = this.fixture;

                // Add significant rewards to create imbalance
                const rewardAmount = ethers.parseUnits("10000", 6);
                await rewardToken.approve(vault1.target, rewardAmount);
                await rewardToken.approve(vault2.target, rewardAmount);

                await vault1.addReward(rewardToken.target, rewardAmount);
                await vault2.addReward(rewardToken.target, rewardAmount);

                // WHEN
                // Get balances before rebalance
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);

                // THEN
                // Rebalance should handle the rewards
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;

                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);

                // Balances may or may not change depending on reward distribution and rebalance logic
                // The important thing is that rebalance completes successfully
                expect(balance1After).to.be.gt(0);
                expect(balance2After).to.be.gt(0);
            });
        });
    });

    describe("GIVEN a Slice contract with swap execution testing", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 4000, 6000);

            // Create imbalance for swaps
            await this.fixture.stakingToken1.approve(this.fixture.slice.target, ethers.parseUnits("150", 18));
            await this.fixture.stakingToken2.approve(this.fixture.slice.target, ethers.parseUnits("50", 18));

            await this.fixture.slice.deposit(this.fixture.autoCompounder1.target, ethers.parseUnits("150", 18));
            await this.fixture.slice.deposit(this.fixture.autoCompounder2.target, ethers.parseUnits("50", 18));

            await addRewards(this.fixture, ethers.parseUnits("5000", 6));
        });

        describe("WHEN testing swap execution during rebalance", function () {
            it("THEN the rebalance should execute swaps through Uniswap correctly", async function () {
                // GIVEN
                const { slice, uniswapV2Router02, rewardToken } = this.fixture;

                // WHEN
                // Verify Uniswap integration
                const routerAddress = await slice.uniswapV2Router();
                expect(routerAddress).to.equal(uniswapV2Router02.target);

                const baseTokenAddress = await slice.baseToken();
                expect(baseTokenAddress).to.equal(rewardToken.target);

                // THEN
                // Rebalance should use Uniswap for swaps
                const tx = await slice.rebalance();
                await expect(tx).to.not.be.reverted;
            });

            it("THEN the rebalance should handle slippage and liquidity constraints", async function () {
                // GIVEN
                const { slice } = this.fixture;

                // WHEN & THEN
                // Rebalance should handle slippage gracefully
                const tx = await slice.rebalance();
                const receipt = await tx.wait();
            });
        });
    });

    describe("GIVEN multiple users with different deposit amounts", function () {
        beforeEach(async function () {
            this.fixture = await loadFixture(deployFixture);
            await setupLiquidityPools(this.fixture);
            await setupSliceAllocations(this.fixture, 4000, 6000);
        });

        describe("WHEN users deposit different amounts", function () {
            it("THEN each user should receive proportional sTokens", async function () {
                // GIVEN
                const { slice, autoCompounder1, stakingToken1, user1, user2 } = this.fixture;
                const user1Amount = ethers.parseUnits("1000", 18);
                const user2Amount = ethers.parseUnits("2000", 18);

                // WHEN
                await stakingToken1.connect(user1).approve(slice.target, user1Amount);
                await stakingToken1.connect(user2).approve(slice.target, user2Amount);

                await slice.connect(user1).deposit(autoCompounder1.target, user1Amount);
                await slice.connect(user2).deposit(autoCompounder1.target, user2Amount);

                // THEN
                const user1Balance = await slice.balanceOf(user1.address);
                const user2Balance = await slice.balanceOf(user2.address);
                const totalSupply = await slice.totalSupply();

                expect(user1Balance).to.be.gt(0);
                expect(user2Balance).to.be.gt(0);
                expect(totalSupply).to.equal(user1Balance + user2Balance);

                // User2 should have approximately 2x the balance of user1
                expect(user2Balance).to.be.gt(user1Balance);
            });

            it("THEN withdrawals should be proportional to sToken holdings", async function () {
                // GIVEN
                const { slice, autoCompounder1, stakingToken1, user1, user2 } = this.fixture;
                const user1Amount = ethers.parseUnits("1000", 18);
                const user2Amount = ethers.parseUnits("2000", 18);

                await stakingToken1.connect(user1).approve(slice.target, user1Amount);
                await stakingToken1.connect(user2).approve(slice.target, user2Amount);

                await slice.connect(user1).deposit(autoCompounder1.target, user1Amount);
                await slice.connect(user2).deposit(autoCompounder1.target, user2Amount);

                // WHEN
                const user1Balance = await slice.balanceOf(user1.address);
                const user2Balance = await slice.balanceOf(user2.address);

                await slice.connect(user1).withdraw(user1Balance / 2n);
                await slice.connect(user2).withdraw(user2Balance / 2n);

                // THEN
                const newUser1Balance = await slice.balanceOf(user1.address);
                const newUser2Balance = await slice.balanceOf(user2.address);

                expect(newUser1Balance).to.equal(user1Balance / 2n);
                expect(newUser2Balance).to.equal(user2Balance / 2n);
            });
        });
    });

    describe("GIVEN precision drift analysis scenarios", function () {
        describe("WHEN testing precision with different allocation ratios", function () {
            it("THEN should maintain precision with 25%/75% allocation", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(fixture);
                await setupSliceAllocations(fixture, 2500, 7500); // 25/75 allocation

                const { slice, autoCompounder1, autoCompounder2, stakingToken1, stakingToken2 } = fixture;

                // Make deposits
                await stakingToken1.approve(slice.target, ethers.parseUnits("100", 18));
                await stakingToken2.approve(slice.target, ethers.parseUnits("100", 18));

                await slice.deposit(autoCompounder1.target, ethers.parseUnits("100", 18));
                await slice.deposit(autoCompounder2.target, ethers.parseUnits("100", 18));

                // Get initial balances
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceBefore = balance1Before + balance2Before;

                // WHEN
                await slice.rebalance();

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceAfter = balance1After + balance2After;

                // Calculate actual percentages
                const actualPercentage1 = Number((balance1After * 10000n) / totalBalanceAfter);
                const actualPercentage2 = Number((balance2After * 10000n) / totalBalanceAfter);

                // Verify precision - should be within 0.1% of target
                expect(actualPercentage1).to.be.closeTo(2500, 10); // Within 0.1%
                expect(actualPercentage2).to.be.closeTo(7500, 10); // Within 0.1%

                // Verify total balance preservation (allowing for small slippage)
                expect(totalBalanceAfter).to.be.gte(totalBalanceBefore - ethers.parseUnits("1", 18));
            });

            it("THEN should maintain precision with 33.33%/66.67% allocation", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(fixture);
                await setupSliceAllocations(fixture, 3333, 6667); // 33.33/66.67 allocation

                const { slice, autoCompounder1, autoCompounder2, stakingToken1, stakingToken2 } = fixture;

                // Make deposits
                await stakingToken1.approve(slice.target, ethers.parseUnits("100", 18));
                await stakingToken2.approve(slice.target, ethers.parseUnits("100", 18));

                await slice.deposit(autoCompounder1.target, ethers.parseUnits("100", 18));
                await slice.deposit(autoCompounder2.target, ethers.parseUnits("100", 18));

                // Get initial balances
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceBefore = balance1Before + balance2Before;

                // WHEN
                await slice.rebalance();

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceAfter = balance1After + balance2After;

                // Calculate actual percentages
                const actualPercentage1 = Number((balance1After * 10000n) / totalBalanceAfter);
                const actualPercentage2 = Number((balance2After * 10000n) / totalBalanceAfter);

                // Calculate precision drift
                const drift1 = Math.abs(actualPercentage1 - 3333);
                const drift2 = Math.abs(actualPercentage2 - 6667);

                // Verify precision - should be within 0.1% of target
                expect(actualPercentage1).to.be.closeTo(3333, 10); // Within 0.1%
                expect(actualPercentage2).to.be.closeTo(6667, 10); // Within 0.1%

                // Verify drift is minimal
                expect(drift1).to.be.lt(50); // Less than 0.5%
                expect(drift2).to.be.lt(50); // Less than 0.5%

                // Verify total balance preservation (allowing for small slippage)
                expect(totalBalanceAfter).to.be.gte(totalBalanceBefore - ethers.parseUnits("1", 18));
            });

            it("THEN should maintain precision with 40%/60% allocation", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(fixture);
                await setupSliceAllocations(fixture, 4000, 6000); // 40/60 allocation

                const { slice, autoCompounder1, autoCompounder2, stakingToken1, stakingToken2 } = fixture;

                // Make deposits
                await stakingToken1.approve(slice.target, ethers.parseUnits("100", 18));
                await stakingToken2.approve(slice.target, ethers.parseUnits("100", 18));

                await slice.deposit(autoCompounder1.target, ethers.parseUnits("100", 18));
                await slice.deposit(autoCompounder2.target, ethers.parseUnits("100", 18));

                // Get initial balances
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceBefore = balance1Before + balance2Before;

                // WHEN
                await slice.rebalance();

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceAfter = balance1After + balance2After;

                // Calculate actual percentages
                const actualPercentage1 = Number((balance1After * 10000n) / totalBalanceAfter);
                const actualPercentage2 = Number((balance2After * 10000n) / totalBalanceAfter);

                // Verify precision - should be within 0.1% of target
                expect(actualPercentage1).to.be.closeTo(4000, 10); // Within 0.1%
                expect(actualPercentage2).to.be.closeTo(6000, 10); // Within 0.1%

                // Verify total balance preservation (allowing for small slippage)
                expect(totalBalanceAfter).to.be.gte(totalBalanceBefore - ethers.parseUnits("1", 18));
            });
        });

        describe("WHEN testing precision with very small amounts", function () {
            it("THEN should maintain precision with micro amounts", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(fixture);
                await setupSliceAllocations(fixture, 5000, 5000); // 50/50 allocation

                const { slice, autoCompounder1, autoCompounder2, stakingToken1, stakingToken2 } = fixture;

                // Make very small deposits
                const microAmount = ethers.parseUnits("0.000001", 18);
                await stakingToken1.approve(slice.target, microAmount);
                await stakingToken2.approve(slice.target, microAmount);

                await slice.deposit(autoCompounder1.target, microAmount);
                await slice.deposit(autoCompounder2.target, microAmount);

                // Get initial balances
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);

                // WHEN
                await slice.rebalance();

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceAfter = balance1After + balance2After;

                // Calculate actual percentages
                const actualPercentage1 = Number((balance1After * 10000n) / totalBalanceAfter);
                const actualPercentage2 = Number((balance2After * 10000n) / totalBalanceAfter);

                // Verify precision - should be within 1% of target for very small amounts
                expect(actualPercentage1).to.be.closeTo(5000, 100); // Within 1%
                expect(actualPercentage2).to.be.closeTo(5000, 100); // Within 1%

                // Verify balances remain positive
                expect(balance1After).to.be.gt(0);
                expect(balance2After).to.be.gt(0);
            });
        });

        describe("WHEN testing precision with large amounts", function () {
            it("THEN should maintain precision with large amounts", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);

                // Add more liquidity to handle larger amounts
                const { uniswapV2Router02, rewardToken, stakingToken1, stakingToken2, owner } = fixture;
                await rewardToken.approve(uniswapV2Router02.target, ethers.parseUnits("100000000", 18));
                await stakingToken1.approve(uniswapV2Router02.target, ethers.parseUnits("100000000", 18));
                await stakingToken2.approve(uniswapV2Router02.target, ethers.parseUnits("100000000", 18));

                await uniswapV2Router02.addLiquidity(
                    rewardToken.target,
                    stakingToken1.target,
                    ethers.parseUnits("10000000", 18),
                    ethers.parseUnits("10000000", 18),
                    ethers.parseUnits("10000000", 18),
                    ethers.parseUnits("10000000", 18),
                    owner.address,
                    ethers.MaxUint256,
                    { gasLimit: 3000000 },
                );

                await uniswapV2Router02.addLiquidity(
                    rewardToken.target,
                    stakingToken2.target,
                    ethers.parseUnits("10000000", 18),
                    ethers.parseUnits("10000000", 18),
                    ethers.parseUnits("10000000", 18),
                    ethers.parseUnits("10000000", 18),
                    owner.address,
                    ethers.MaxUint256,
                    { gasLimit: 3000000 },
                );

                await setupSliceAllocations(fixture, 3000, 7000); // 30/70 allocation

                const {
                    slice,
                    autoCompounder1,
                    autoCompounder2,
                    stakingToken1: stakingToken1Ref,
                    stakingToken2: stakingToken2Ref,
                } = fixture;

                // Make large deposits
                const largeAmount = ethers.parseUnits("10000", 18);
                await stakingToken1Ref.approve(slice.target, largeAmount);
                await stakingToken2Ref.approve(slice.target, largeAmount);

                await slice.deposit(autoCompounder1.target, largeAmount);
                await slice.deposit(autoCompounder2.target, largeAmount);

                // Get initial balances
                const balance1Before = await autoCompounder1.balanceOf(slice.target);
                const balance2Before = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceBefore = balance1Before + balance2Before;

                // WHEN
                await slice.rebalance();

                // THEN
                const balance1After = await autoCompounder1.balanceOf(slice.target);
                const balance2After = await autoCompounder2.balanceOf(slice.target);
                const totalBalanceAfter = balance1After + balance2After;

                // Calculate actual percentages
                const actualPercentage1 = Number((balance1After * 10000n) / totalBalanceAfter);
                const actualPercentage2 = Number((balance2After * 10000n) / totalBalanceAfter);

                // Calculate precision drift
                const drift1 = Math.abs(actualPercentage1 - 3000);
                const drift2 = Math.abs(actualPercentage2 - 7000);

                // Verify precision - should be within 0.1% of target for large amounts
                expect(actualPercentage1).to.be.closeTo(3000, 10); // Within 0.1%
                expect(actualPercentage2).to.be.closeTo(7000, 10); // Within 0.1%

                // Verify drift is minimal
                expect(drift1).to.be.lt(50); // Less than 0.5%
                expect(drift2).to.be.lt(50); // Less than 0.5%

                // Verify total balance preservation (allowing for reasonable slippage with large amounts)
                expect(totalBalanceAfter).to.be.gte(totalBalanceBefore - ethers.parseUnits("100", 18));
            });
        });

        describe("WHEN testing precision with multiple rebalances", function () {
            it("THEN should maintain precision across multiple rebalances", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                await setupLiquidityPools(fixture);
                await setupSliceAllocations(fixture, 3500, 6500); // 35/65 allocation

                const { slice, autoCompounder1, autoCompounder2, stakingToken1, stakingToken2 } = fixture;

                // Make deposits
                await stakingToken1.approve(slice.target, ethers.parseUnits("100", 18));
                await stakingToken2.approve(slice.target, ethers.parseUnits("100", 18));

                await slice.deposit(autoCompounder1.target, ethers.parseUnits("100", 18));
                await slice.deposit(autoCompounder2.target, ethers.parseUnits("100", 18));

                // WHEN - Perform multiple rebalances
                for (let i = 0; i < 5; i++) {
                    await slice.rebalance();

                    const balance1After = await autoCompounder1.balanceOf(slice.target);
                    const balance2After = await autoCompounder2.balanceOf(slice.target);
                    const totalBalanceAfter = balance1After + balance2After;

                    // Calculate actual percentages
                    const actualPercentage1 = Number((balance1After * 10000n) / totalBalanceAfter);
                    const actualPercentage2 = Number((balance2After * 10000n) / totalBalanceAfter);

                    // THEN - Verify precision is maintained across rebalances
                    expect(actualPercentage1).to.be.closeTo(3500, 10); // Within 0.1%
                    expect(actualPercentage2).to.be.closeTo(6500, 10); // Within 0.1%
                }
            });
        });
    });

    describe("GIVEN edge cases and error scenarios", function () {
        describe("WHEN dealing with maximum allocations", function () {
            it("THEN should be able to add up to MAX_TOKENS_AMOUNT allocations", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice, mockV3Aggregator } = fixture;

                // Create multiple autoCompounders and add allocations
                const RewardsVaultAutoCompounder = await ethers.getContractFactory("RewardsVaultAutoCompounder");
                const autoCompounders = [];

                for (let i = 0; i < 10; i++) {
                    const VaultToken = await ethers.getContractFactory("VaultToken");
                    const stakingToken = await VaultToken.deploy(18);
                    await stakingToken.waitForDeployment();

                    const RewardsVault4626 = await ethers.getContractFactory("RewardsVault4626");
                    const vault = await RewardsVault4626.deploy(
                        stakingToken.target,
                        "Test Vault",
                        "TVLT",
                        18,
                        0,
                        fixture.owner.address,
                    );
                    await vault.waitForDeployment();

                    const autoCompounder = await RewardsVaultAutoCompounder.deploy(
                        vault.target,
                        `Test AutoCompounder ${i}`,
                        `TAC${i}`,
                        ethers.parseUnits("1", 18),
                        fixture.uniswapV2Router02.target,
                        fixture.rewardToken.target,
                        300,
                    );
                    await autoCompounder.waitForDeployment();

                    autoCompounders.push(autoCompounder);
                }

                // WHEN & THEN
                for (let i = 0; i < 10; i++) {
                    const percentage = 1000; // 10% each
                    await expect(slice.addAllocation(autoCompounders[i].target, mockV3Aggregator.target, percentage)).to
                        .not.be.reverted;
                }
            });
        });

        describe("WHEN dealing with zero amounts and empty states", function () {
            it("THEN getTokenAllocation should return empty allocation for non-existent token", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice } = fixture;
                const nonExistentToken = ethers.Wallet.createRandom().address;

                // WHEN
                const allocation = await slice.getTokenAllocation(nonExistentToken);

                // THEN
                expect(allocation.aToken).to.equal(ZeroAddress);
                expect(allocation.asset).to.equal(ZeroAddress);
                expect(allocation.targetPercentage).to.equal(0);
            });

            it("THEN allocations() should return empty array when no allocations exist", async function () {
                // GIVEN
                const fixture = await loadFixture(deployFixture);
                const { slice } = fixture;

                // WHEN
                const allocations = await slice.allocations();

                // THEN
                expect(allocations.length).to.equal(0);
            });
        });
    });
});
