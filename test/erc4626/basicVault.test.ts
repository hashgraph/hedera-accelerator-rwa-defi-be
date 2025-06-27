import { anyValue, ethers, expect, time } from "../setup";
import { PrivateKey, Client, AccountId } from "@hashgraph/sdk";
import { BigNumberish, Wallet, ZeroAddress } from "ethers";
import { VaultToken, BasicVault } from "../../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

async function deposit(vault: BasicVault, address: string, amount: BigNumberish, staker: Wallet | HardhatEthersSigner) {
    const token = await ethers.getContractAt(
        "VaultToken",
        address
    );

    await token.connect(staker).approve(vault.target, amount);

    return vault.connect(staker).deposit(amount, staker.address);
}

// constants
const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

// Zero fee
const feeConfig = {
    receiver: ZeroAddress,
    token: ZeroAddress,
    feePercentage: 0,
};

const cliff = 100;
const unlockDuration = 500;

// Tests
describe("BasicVault", function () {
    async function deployFixture() {
        const [
            owner,
            staker
        ] = await ethers.getSigners();

        let client = Client.forTestnet();

        client.setOperator(
            operatorAccountId,
            operatorPrKey
        );

        const VaultToken = await ethers.getContractFactory("VaultToken");
        const stakingToken = await VaultToken.deploy(
            18
        ) as VaultToken;
        await stakingToken.waitForDeployment();

        await stakingToken.mint(staker.address, ethers.parseUnits("500000000", 18));

        const RewardToken = await ethers.getContractFactory("VaultToken");
        const rewardToken = await RewardToken.deploy(
            6
        ) as VaultToken;
        await rewardToken.waitForDeployment();

        const BasicVault = await ethers.getContractFactory("BasicVault");
        const hederaVault = await BasicVault.deploy(
            stakingToken.target,
            "TST",
            "TST",
            feeConfig,
            owner.address,
            owner.address,
            cliff,
            unlockDuration
        ) as BasicVault;
        await hederaVault.waitForDeployment();

        return {
            hederaVault,
            rewardToken,
            stakingToken,
            client,
            owner,
            staker,
        };
    }

    describe("deposit", function () {
        it("Should deposit tokens and return shares", async function () {
            const { hederaVault, owner, stakingToken } = await loadFixture(deployFixture);
            const amountToDeposit = 170;

            console.log("Preview deposit ", await hederaVault.previewDeposit(amountToDeposit));

            await stakingToken.approve(hederaVault.target, amountToDeposit);

            const tx = await hederaVault.connect(owner).deposit(
                amountToDeposit,
                owner.address,
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(hederaVault, "Deposit")
                .withArgs(owner.address, owner.address, amountToDeposit, anyValue);

            // Check staking token was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                stakingToken,
                owner.address,
                -amountToDeposit
            );
            // Check user received share
            await expect(
                tx
            ).to.changeTokenBalance(
                hederaVault,
                owner.address,
                amountToDeposit
            );
        });

        it("Should claim rewards after deposit", async function () {
            const { hederaVault, owner, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToDeposit = 170;
            const rewardAmount = 50000;

            console.log("Preview deposit ", await hederaVault.previewDeposit(amountToDeposit));

            await stakingToken.approve(hederaVault.target, amountToDeposit);

            const tx = await hederaVault.connect(owner).deposit(
                amountToDeposit,
                owner.address,
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(hederaVault, "Deposit")
                .withArgs(owner.address, owner.address, amountToDeposit, anyValue);

            // Check revert if no rewards
            await expect(
                hederaVault.claimAllReward(0, owner.address)
            ).to.be.revertedWith("HederaVault: No reward tokens exist");

            await rewardToken.approve(hederaVault.target, rewardAmount);

            // Add reward
            const addRewardTx = await hederaVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            const rewards = await hederaVault.getAllRewards(owner);
            console.log("Available Reward: ", rewards);

            // Check rewards greater than 0
            expect(
                rewards[0]
            ).to.be.gt(0);

            const claimRewardTx = await hederaVault.claimAllReward(
                0,
                owner.address
            );

            console.log(claimRewardTx.hash);

            // Check reward was transferred to user
            await expect(
                claimRewardTx
            ).to.changeTokenBalance(
                rewardToken,
                owner.address,
                rewards[0]
            );
        });

        it("Should revert if zero receiver", async function () {
            const { hederaVault } = await loadFixture(deployFixture);
            const amountToDeposit = 170;

            await expect(
                hederaVault.deposit(amountToDeposit, ZeroAddress)
            ).to.be.revertedWith("HederaVault: Invalid receiver address");
        });

        it("Should revert if zero assets", async function () {
            const { hederaVault, owner } = await loadFixture(deployFixture);
            const amountToDeposit = 0;

            await expect(
                hederaVault.deposit(amountToDeposit, owner.address)
            ).to.be.revertedWith("HederaVault: Zero shares");
        });
    });

    describe("withdraw", function () {
        it("Should withdraw tokens", async function () {
            const { hederaVault, owner, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToDeposit = 170;
            const amountToWithdraw = 10;
            const rewardAmount = 50000;

            await deposit(
                hederaVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            await rewardToken.approve(hederaVault.target, rewardAmount);

            // Add reward
            const addRewardTx = await hederaVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            const previewWithdraw = await hederaVault.previewWithdraw(amountToWithdraw);
            console.log("Preview Withdraw ", previewWithdraw);

            const currentReward = await hederaVault.getUserReward(owner.address, rewardToken.target);
            console.log("Current reward: ", currentReward);

            await hederaVault.approve(hederaVault.target, amountToWithdraw);

            // Check revert if shares aren't unlocked
            await expect(
                hederaVault.withdraw(
                    amountToWithdraw,
                    owner.address,
                    owner.address
                )
            ).to.be.revertedWithCustomError(hederaVault, "ERC4626ExceededMaxWithdraw");

            // Warp time to unlock shares
            await time.increase(1000);

            const tx = await hederaVault.withdraw(
                amountToWithdraw,
                owner.address,
                owner.address
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(hederaVault, "Withdraw")
                .withArgs(owner.address, owner.address, owner.address, amountToWithdraw, previewWithdraw);

            // Check share was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                hederaVault,
                owner,
                -amountToWithdraw
            );
            // Check user received staking token
            await expect(
                tx
            ).to.changeTokenBalance(
                stakingToken,
                owner,
                amountToWithdraw
            );

            // Claim reward
            const claimRewardTx = await hederaVault.claimAllReward(
                0,
                owner.address
            );

            // Check user received reward token
            await expect(
                claimRewardTx
            ).to.changeTokenBalance(
                rewardToken,
                owner,
                currentReward
            );
        });

        it("Should revert if invalid receiver", async function () {
            const { hederaVault, owner } = await loadFixture(deployFixture);
            const amountToWithdraw = 10;

            await expect(
                hederaVault.withdraw(amountToWithdraw, ZeroAddress, owner.address)
            ).to.be.revertedWith("HederaVault: Invalid receiver address");
        });

        it("Should revert if zero assets", async function () {
            const { hederaVault, owner, rewardToken, stakingToken } = await loadFixture(deployFixture);
            const amountToDeposit = 170;
            const amountToWithdraw = 0;
            const rewardAmount = 50000;

            await deposit(
                hederaVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            await rewardToken.approve(hederaVault.target, rewardAmount);

            // Add reward
            const addRewardTx = await hederaVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            const previewWithdraw = await hederaVault.previewWithdraw(amountToWithdraw);
            console.log("Preview Withdraw ", previewWithdraw);

            await hederaVault.approve(hederaVault.target, amountToWithdraw);

            await expect(
                hederaVault.withdraw(amountToWithdraw, owner.address, owner.address)
            ).to.be.revertedWith("HederaVault: Zero shares");
        });
    });

    describe("mint", function () {
        it("Should mint tokens", async function () {
            const { hederaVault, owner, stakingToken } = await loadFixture(deployFixture);
            const amountOfShares = 1;

            const amount = await hederaVault.previewMint(amountOfShares);
            console.log("Preview Mint ", amount);

            await stakingToken.approve(hederaVault.target, amount);

            const tx = await hederaVault.connect(owner).mint(
                amountOfShares,
                owner.address
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(hederaVault, "Deposit")
                .withArgs(owner.address, owner.address, amountOfShares, amountOfShares);

            // Check share token was transferred to user
            await expect(
                tx
            ).to.changeTokenBalance(
                hederaVault,
                owner,
                amountOfShares
            );
        });

        it("Should revert if zero receiver", async function () {
            const { hederaVault } = await loadFixture(deployFixture);
            const amountToMint = 10;

            await expect(
                hederaVault.mint(amountToMint, ZeroAddress)
            ).to.be.revertedWith("HederaVault: Invalid receiver address");
        });

        it("Should revert if zero shares", async function () {
            const { hederaVault, owner } = await loadFixture(deployFixture);
            const amountToMint = 0;

            await expect(
                hederaVault.mint(amountToMint, owner.address)
            ).to.be.revertedWith("HederaVault: Zero shares");
        });
    });

    describe("redeem", function () {
        it("Should redeem tokens", async function () {
            const { hederaVault, owner, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToRedeem = 10;
            const amountToDeposit = 170;
            const rewardAmount = 50000;

            await deposit(
                hederaVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            await rewardToken.approve(hederaVault.target, rewardAmount);

            // Add reward
            const addRewardTx = await hederaVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            const currentReward = await hederaVault.getUserReward(owner.address, rewardToken.target);
            console.log("Current reward: ", currentReward);

            const tokensAmount = await hederaVault.previewRedeem(amountToRedeem);
            console.log("Preview redeem ", tokensAmount);

            await hederaVault.approve(hederaVault.target, amountToRedeem);

            // Check revert if shares aren't unlocked
            await expect(
                hederaVault.redeem(
                    amountToRedeem,
                    owner.address,
                    owner.address
                )
            ).to.be.revertedWithCustomError(hederaVault, "ERC4626ExceededMaxRedeem");

            // Warp time to unlock shares
            await time.increase(1000);

            const tx = await hederaVault.redeem(
                amountToRedeem,
                owner.address,
                owner.address
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(hederaVault, "Withdraw")
                .withArgs(owner.address, owner.address, owner.address, amountToRedeem, anyValue);

            // Check share was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                hederaVault,
                owner,
                -amountToRedeem
            );
            // Check user received staking token
            await expect(
                tx
            ).to.changeTokenBalance(
                stakingToken,
                owner,
                amountToRedeem
            );

            // Claim reward
            const claimRewardTx = await hederaVault.claimExactReward(
                rewardToken.target,
                owner.address,
                currentReward
            );

            // Check user received reward token
            await expect(
                claimRewardTx
            ).to.changeTokenBalance(
                rewardToken,
                owner,
                currentReward
            );
        });

        it("Should revert if zero assets", async function () {
            const { hederaVault, owner, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToReedem = 0;
            const amountToDeposit = 170;
            const rewardAmount = 50000;

            await deposit(
                hederaVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            await rewardToken.approve(hederaVault.target, rewardAmount);

            // Add reward
            const addRewardTx = await hederaVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            await expect(
                hederaVault.redeem(amountToReedem, owner.address, owner.address,)
            ).to.be.revertedWith("HederaVault: Zero assets");
        });

        it("Should revert if invalid receiver", async function () {
            const { hederaVault, owner } = await loadFixture(deployFixture);
            const amountToReedem = 10;

            await expect(
                hederaVault.redeem(amountToReedem, ZeroAddress, owner.address,)
            ).to.be.revertedWith("HederaVault: Invalid receiver address");
        });
    });

    describe("addReward", function () {
        it("Should add reward to the Vault two times", async function () {
            const { hederaVault, owner, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToDeposit = 100;
            const rewardAmount = 100000;

            await deposit(
                hederaVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            await rewardToken.approve(hederaVault.target, rewardAmount);

            const tx = await hederaVault.addReward(
                rewardToken.target,
                rewardAmount
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(hederaVault, "RewardAdded")
                .withArgs(rewardToken.target, rewardAmount);

            // Check reward token was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                rewardToken,
                hederaVault.target,
                rewardAmount
            );

            await rewardToken.approve(hederaVault.target, rewardAmount);

            const secondTx = await hederaVault.addReward(
                rewardToken.target,
                rewardAmount
            );

            await expect(
                secondTx
            ).to.emit(hederaVault, "RewardAdded")
                .withArgs(rewardToken.target, rewardAmount);
        });

        it("Should revert if amount is zero", async function () {
            const { hederaVault, rewardToken } = await loadFixture(deployFixture);
            const rewardAmount = 0;

            await expect(
                hederaVault.addReward(
                    rewardToken.target,
                    rewardAmount
                )
            ).to.be.revertedWith("HederaVault: Amount can't be zero");
        });

        it("Should revert if reward token is staking token", async function () {
            const { hederaVault, stakingToken } = await loadFixture(deployFixture);
            const rewardAmount = 10;

            await expect(
                hederaVault.addReward(
                    stakingToken.target,
                    rewardAmount
                )
            ).to.be.revertedWith("HederaVault: Reward and Staking tokens cannot be same");
        });

        it("Should revert if no token staked yet", async function () {
            const { hederaVault, rewardToken } = await loadFixture(deployFixture);
            const rewardAmount = 10;

            await expect(
                hederaVault.addReward(
                    rewardToken.target,
                    rewardAmount
                )
            ).to.be.revertedWith("HederaVault: No token staked yet");
        });

        it("Should revert if invalid reward token", async function () {
            const { hederaVault } = await loadFixture(deployFixture);
            const rewardAmount = 10;

            await expect(
                hederaVault.addReward(
                    ZeroAddress,
                    rewardAmount
                )
            ).to.be.revertedWith("HederaVault: Invalid reward token");
        });
    });

    describe("flow tests", function () {
        it("two people, two withdraw, add reward, all claim", async function () {
            const { hederaVault, owner, staker, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToWithdraw = 100;
            const amountToStake = 112412;
            const rewardToAdd = ethers.parseUnits("5000000", 18);

            // Stake
            const ownerDeposit = await deposit(hederaVault, await stakingToken.getAddress(), amountToStake, owner);
            const stakerDeposit = await deposit(hederaVault, await stakingToken.getAddress(), amountToStake, staker);
            console.log("Owner deposit: ", ownerDeposit.hash);
            console.log("Staker deposit: ", stakerDeposit.hash);

            // Add reward
            await rewardToken.approve(hederaVault.target, rewardToAdd);
            await hederaVault.connect(owner).addReward(rewardToken.target, rewardToAdd);

            const currentRewardOwner = await hederaVault.getAllRewards(owner.address);
            const currentRewardStaker = await hederaVault.getAllRewards(staker.address);
            console.log("Current reward owner after deposit: ", currentRewardOwner);
            console.log("Current reward staker after deposit: ", currentRewardStaker);

            // Withdraw
            await hederaVault.approve(hederaVault.target, amountToWithdraw);

            // Warp time to unlock rewards
            await time.increase(1000);

            const ownerWithdrawTx = await hederaVault.withdraw(
                amountToWithdraw,
                owner.address,
                owner.address,
                { gasLimit: 3000000 }
            );

            await hederaVault.connect(staker).approve(hederaVault.target, amountToWithdraw);

            const stakerWithdrawTx = await hederaVault.connect(staker).withdraw(
                amountToWithdraw,
                staker.address,
                staker.address,
                { gasLimit: 3000000 }
            );

            const currentRewardOwner1 = await hederaVault.getAllRewards(owner.address);
            const currentRewardStaker1 = await hederaVault.getAllRewards(staker.address);
            console.log("Current reward owner after withdraw: ", currentRewardOwner1);
            console.log("Current reward staker after withdraw: ", currentRewardStaker1);

            // Check reward gt 0 as long as withdrawn amount lt staked amount
            expect(
                currentRewardOwner1[0]
            ).to.be.gt(0);
            expect(
                currentRewardStaker1[0]
            ).to.be.gt(0);

            // Check share was transferred to contract
            await expect(
                ownerWithdrawTx
            ).to.changeTokenBalance(
                hederaVault,
                owner,
                -amountToWithdraw
            );
            // Check user received staking token
            await expect(
                ownerWithdrawTx
            ).to.changeTokenBalance(
                stakingToken,
                owner,
                amountToWithdraw
            );

            const claimOwnerRewardTx = await hederaVault.claimAllReward(
                0,
                owner.address
            );

            // Check owner received reward token
            await expect(
                claimOwnerRewardTx
            ).to.changeTokenBalance(
                rewardToken,
                owner,
                2499999999999999999999999n
            );

            await expect(
                stakerWithdrawTx
            ).to.changeTokenBalance(
                hederaVault,
                staker,
                -amountToWithdraw
            );
            await expect(
                stakerWithdrawTx
            ).to.changeTokenBalance(
                stakingToken,
                staker,
                amountToWithdraw
            );

            const claimStakerRewardTx = await hederaVault.connect(staker).claimExactReward(
                rewardToken.target,
                staker.address,
                2499999999999999999999999n
            );

            await expect(
                claimStakerRewardTx
            ).to.changeTokenBalance(
                rewardToken,
                staker,
                2499999999999999999999999n
            );

            const currentRewardOwnerAfterClaim = await hederaVault.getAllRewards(owner.address);
            const currentRewardStakerAfterClaim = await hederaVault.getAllRewards(staker.address);
            console.log("Current reward owner after claim: ", currentRewardOwnerAfterClaim);
            console.log("Current reward staker after claim: ", currentRewardStakerAfterClaim);

            // Add reward
            await rewardToken.approve(hederaVault.target, rewardToAdd);
            await hederaVault.connect(owner).addReward(rewardToken.target, rewardToAdd);

            const currentRewardOwner2 = await hederaVault.getAllRewards(owner.address);
            const currentRewardStaker2 = await hederaVault.getAllRewards(staker.address);
            console.log("Current reward owner after adding reward: ", currentRewardOwner2);
            console.log("Current reward staker after adding reward: ", currentRewardStaker2);

            console.log("Reward Owner balance after claim", await rewardToken.balanceOf(owner.address));
            console.log("Reward Staker balance after claim", await rewardToken.balanceOf(staker.address));
        });

        it("two people, two type of reward, one withdraw, add two reward, all claim", async function () {
            const { hederaVault, owner, staker, stakingToken, rewardToken } = await loadFixture(deployFixture);
            const amountToWithdraw = 10;
            const amountToStake = 112412;
            const rewardToAdd = ethers.parseUnits("5000000", 18);

            // Deposit
            const ownerDeposit = await deposit(hederaVault, await stakingToken.getAddress(), amountToStake, owner);
            const stakerDeposit = await deposit(hederaVault, await stakingToken.getAddress(), amountToStake, staker);
            console.log(ownerDeposit.hash);
            console.log(stakerDeposit.hash);

            await rewardToken.approve(hederaVault.target, rewardToAdd);

            await hederaVault.connect(owner).addReward(rewardToken.target, rewardToAdd);

            const currentRewardOwner = await hederaVault.getAllRewards(owner.address);
            const currentRewardStaker = await hederaVault.getAllRewards(staker);
            console.log("Current reward owner: ", currentRewardOwner);
            console.log("Current reward staker: ", currentRewardStaker);

            await hederaVault.approve(hederaVault.target, amountToWithdraw);

            // Warp time to unlock shares
            await time.increase(1000);

            const tx = await hederaVault.withdraw(
                amountToWithdraw,
                owner.address,
                owner.address,
                { gasLimit: 3000000 }
            );

            const currentRewardOwner1 = await hederaVault.getAllRewards(owner.address);
            const currentRewardStaker2 = await hederaVault.getAllRewards(staker.address);
            console.log("Current reward owner: ", currentRewardOwner1);
            console.log("Current reward staker: ", currentRewardStaker2);

            await expect(
                tx
            ).to.emit(hederaVault, "Withdraw")
                .withArgs(owner.address, owner.address, owner.address, amountToWithdraw, anyValue);

            // Check share was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                hederaVault,
                owner,
                -amountToWithdraw
            );
            // Check user received staking token
            await expect(
                tx
            ).to.changeTokenBalance(
                stakingToken,
                owner,
                amountToWithdraw
            );

            // Claim
            const txClaim = await hederaVault.connect(staker).claimAllReward(0, staker.address);

            const currentRewardStaker3 = await hederaVault.getAllRewards(staker);
            console.log("Current reward staker: ", currentRewardStaker3);

            // Check user claimed reward
            await expect(
                txClaim
            ).to.changeTokenBalance(
                rewardToken,
                staker.address,
                2499999999999999999999999n
            );
        });
    });
});
