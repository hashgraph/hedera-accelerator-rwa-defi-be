import { anyValue, ethers, expect } from "../setup";
import { TokenTransfer, createFungibleToken, TokenBalance, createAccount, addToken, mintToken } from "../../scripts/utils";
import { PrivateKey, Client, AccountId, TokenAssociateTransaction, AccountBalanceQuery } from "@hashgraph/sdk";
import { BigNumberish, Wallet, ZeroAddress } from "ethers";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { VaultToken, AsyncVault } from "../../typechain-types";

import hre from "hardhat";

async function requestDeposit(vault: AsyncVault, address: string, amount: BigNumberish, staker: Wallet | HardhatEthersSigner) {
    const token = await ethers.getContractAt(
        "VaultToken",
        address
    );

    await token.connect(staker).approve(vault.target, amount);

    return vault.connect(staker).requestDeposit(amount, staker.address, staker.address);
}

// constants
const testAccountAddress = "0x934b9afc8be0f78f698753a8f67131fa58cd9884";
const operatorPrKeyTest = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY_TEST || '');
const operatorAccountIdTest = AccountId.fromString(process.env.ACCOUNT_ID_TEST || '');

const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

const testAccount = new hre.ethers.Wallet(process.env.PRIVATE_KEY_TEST!, ethers.provider);

// Tests
describe("AsyncVault", function () {
    async function deployFixture() {
        const [
            owner,
        ] = await ethers.getSigners();

        let client = Client.forTestnet();

        const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
        const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

        client.setOperator(
            operatorAccountId,
            operatorPrKey
        );

        const VaultToken = await ethers.getContractFactory("VaultToken");
        const stakingToken = await VaultToken.deploy(
        ) as VaultToken;
        await stakingToken.waitForDeployment();

        await stakingToken.mint(testAccount.address, ethers.parseUnits("500000000", 18));

        const RewardToken = await ethers.getContractFactory("VaultToken");
        const rewardToken = await RewardToken.deploy(
        ) as VaultToken;
        await rewardToken.waitForDeployment();

        // Zero fee
        const feeConfig = {
            receiver: ZeroAddress,
            token: ZeroAddress,
            feePercentage: 0,
        };

        const AsyncVault = await ethers.getContractFactory("contracts/erc7540/AsyncVault.sol:AsyncVault");
        const asyncVault = await AsyncVault.deploy(
            stakingToken.target,
            "TST",
            "TST",
            feeConfig,
            owner.address,
            owner.address
        ) as AsyncVault;
        await asyncVault.waitForDeployment();

        return {
            asyncVault,
            rewardToken,
            stakingToken,
            client,
            owner,
            testAccount,
        };
    }

    describe("requestDeposit", function () {
        it("Should stake the staking token and claim deposit", async function () {
            const { asyncVault, owner, stakingToken, rewardToken } = await deployFixture();
            const amountToStake = ethers.parseUnits("1", 8);
            const rewardAmount = ethers.parseUnits("5000000", 18);

            const tx = await requestDeposit(
                asyncVault,
                await stakingToken.getAddress(),
                amountToStake,
                owner
            );

            await expect(
                tx
            ).to.emit(asyncVault, "DepositRequested")
                .withArgs(owner.address, owner.address, owner.address, amountToStake);

            await expect(
                tx
            ).to.changeTokenBalance(
                stakingToken,
                owner.address,
                -amountToStake
            );

            // Add reward
            await rewardToken.approve(asyncVault.target, rewardAmount);

            const addRewardTx = await asyncVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            await expect(
                asyncVault.claimDeposit(ZeroAddress)
            ).to.be.revertedWith("AsyncVault: Invalid receiver address");

            const claimDepositTx = await asyncVault.claimDeposit(owner.address);

            await expect(
                claimDepositTx
            ).to.emit(asyncVault, "ClaimDeposit")
                .withArgs(owner.address, owner.address, amountToStake, anyValue);

            await expect(
                claimDepositTx
            ).to.changeTokenBalance(
                asyncVault,
                owner.address,
                amountToStake
            );
        });

        it("Should claim rewards after claim deposit", async function () {
            const { asyncVault, owner, stakingToken, rewardToken } = await deployFixture();
            const amountToDeposit = 112412;
            const rewardAmount = ethers.parseUnits("5000000", 18);

            const tx = await requestDeposit(
                asyncVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(asyncVault, "DepositRequested")
                .withArgs(owner.address, owner.address, owner.address, amountToDeposit);

            // Check revert if no rewards
            await expect(
                asyncVault.claimAllReward(0)
            ).to.be.revertedWith("AsyncVault: No reward tokens exist");

            // Add reward
            await rewardToken.approve(asyncVault.target, rewardAmount);

            const addRewardTx = await asyncVault.addReward(rewardToken.target, rewardAmount);
            console.log(addRewardTx.hash);

            await stakingToken.approve(asyncVault.target, amountToDeposit);

            const secondDepositTx = await asyncVault.requestDeposit(
                amountToDeposit,
                owner.address,
                owner.address
            );

            await expect(
                secondDepositTx
            ).to.emit(asyncVault, "ClaimDeposit")
                .withArgs(owner.address, owner.address, amountToDeposit, amountToDeposit);

            // Check reward was transferred to user
            await expect(
                secondDepositTx
            ).to.changeTokenBalance(
                rewardToken,
                owner.address,
                395676986577401
            );

            const rewards = await asyncVault.getAllRewards(owner.address);
            console.log("Available Reward: ", rewards);

            // Check rewards greater than 0
            expect(
                rewards[0]
            ).to.eq(0);
        });

        it("Should revert if zero shares", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToDeposit = 0;

            await expect(
                asyncVault.requestDeposit(amountToDeposit, owner.address, owner.address)
            ).to.be.revertedWith("AsyncVault: Invalid asset amount");
        });

        it("Should revert if invalid receiver", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToDeposit = 10;

            await expect(
                asyncVault.requestDeposit(amountToDeposit, owner.address, ZeroAddress)
            ).to.be.revertedWith("AsyncVault: Invalid owner address");
        });
    });

    describe("decreaseDepositRequest", function () {
        it("Should decrease deposit request", async function () {
            const { asyncVault, owner, stakingToken, rewardToken } = await deployFixture();
            const amountToStake = ethers.parseUnits("100", 8);
            const amountToDecrease = ethers.parseUnits("1", 8);

            const tx = await requestDeposit(
                asyncVault,
                await stakingToken.getAddress(),
                amountToStake,
                owner
            );

            await expect(
                tx
            ).to.emit(asyncVault, "DepositRequested")
                .withArgs(owner.address, owner.address, owner.address, amountToStake);

            await expect(
                tx
            ).to.changeTokenBalance(
                stakingToken,
                owner.address,
                -amountToStake
            );

            // Check can't decrease if amount to decrease more than deposited
            await expect(
                asyncVault.decreaseDepositRequest(amountToStake + amountToStake)
            ).to.be.revertedWith("AsyncVault: Invalid amount to decrease requested amount");

            // Zero check
            await expect(
                asyncVault.decreaseDepositRequest(0)
            ).to.be.revertedWith("AsyncVault: Invalid amount to decrease requested amount");

            const decreaseDepositRequestTx = await asyncVault.decreaseDepositRequest(amountToDecrease);

            await expect(
                decreaseDepositRequestTx
            ).to.emit(asyncVault, "DecreaseDepositRequest")
                .withArgs(owner.address, amountToStake, amountToStake - amountToDecrease);

            await expect(
                decreaseDepositRequestTx
            ).to.changeTokenBalance(
                stakingToken,
                owner.address,
                amountToDecrease
            );
        });

        it("Should revert if zero shares", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToDeposit = 0;

            await expect(
                asyncVault.requestDeposit(amountToDeposit, owner.address, owner.address)
            ).to.be.revertedWith("AsyncVault: Invalid asset amount");
        });

        it("Should revert if invalid receiver", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToDeposit = 10;

            await expect(
                asyncVault.requestDeposit(amountToDeposit, owner.address, ZeroAddress)
            ).to.be.revertedWith("AsyncVault: Invalid owner address");
        });
    });

    describe("requestRedeem", function () {
        it("Should request redeem", async function () {
            const { asyncVault, owner, stakingToken, rewardToken } = await deployFixture();
            const amountToRedeem = 10;
            const amountToStake = ethers.parseUnits("150", 18);
            const rewardAmount = ethers.parseUnits("5000000", 18);

            await requestDeposit(asyncVault, await stakingToken.getAddress(), amountToStake, owner);

            await rewardToken.approve(asyncVault.target, rewardAmount);
            await asyncVault.addReward(rewardToken.target, rewardAmount);

            console.log("Preview claim deposit: ", await asyncVault.previewClaimDeposit(owner.address));

            const claimDepositTx = await asyncVault.claimDeposit(owner.address);

            await expect(
                claimDepositTx
            ).to.emit(asyncVault, "ClaimDeposit")
                .withArgs(owner.address, owner.address, amountToStake, amountToStake);

            await asyncVault.approve(asyncVault.target, amountToRedeem);

            const tx = await asyncVault.requestRedeem(
                amountToRedeem,
                owner.address,
                owner.address,
                { gasLimit: 3000000 }
            );

            await expect(
                tx
            ).to.emit(asyncVault, "RedeemRequested")
                .withArgs(owner.address, owner.address, owner.address, amountToRedeem);

            // Check share was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                asyncVault,
                owner,
                -amountToRedeem
            );

            const prClaimRedeem = await asyncVault.previewClaimRedeem(
                owner.address
            );

            console.log(
                "Preview claim redeem: ",
                prClaimRedeem
            );

            await asyncVault.approve(asyncVault.target, amountToRedeem);

            const claimRedeemTx = await asyncVault.requestRedeem(
                amountToRedeem,
                owner.address,
                owner.address,
                { gasLimit: 3000000 }
            );

            await expect(
                claimRedeemTx
            ).to.emit(asyncVault, "ClaimRedeem")
                .withArgs(owner.address, owner.address, prClaimRedeem, prClaimRedeem);
        });

        it("Should revert if max redeem request exceeded", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToRedeem = 10;

            await expect(
                asyncVault.requestRedeem(amountToRedeem, owner.address, owner.address)
            ).to.be.revertedWithCustomError(asyncVault, "MaxRedeemRequestExceeded");
        });

        it("Should revert if zero shares", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToRedeem = 0;

            await expect(
                asyncVault.requestRedeem(amountToRedeem, owner.address, owner.address)
            ).to.be.revertedWith("AsyncVault: Invalid share amount");
        });

        it("Should revert if invalid receiver", async function () {
            const { asyncVault, owner } = await deployFixture();
            const amountToDeposit = 10;

            await expect(
                asyncVault.requestRedeem(amountToDeposit, owner.address, ZeroAddress)
            ).to.be.revertedWith("AsyncVault: Invalid owner address");
        });
    });

    describe("addReward", function () {
        it("Should add reward to the Vault", async function () {
            const { asyncVault, owner, stakingToken, rewardToken } = await deployFixture();
            const amountToDeposit = 100;
            const rewardAmount = 100000;

            await requestDeposit(
                asyncVault,
                await stakingToken.getAddress(),
                amountToDeposit,
                owner
            );

            await rewardToken.approve(asyncVault.target, rewardAmount);

            const tx = await asyncVault.addReward(
                rewardToken.target,
                rewardAmount
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(asyncVault, "RewardAdded")
                .withArgs(rewardToken.target, rewardAmount);

            // Check reward token was transferred to contract
            await expect(
                tx
            ).to.changeTokenBalance(
                rewardToken,
                asyncVault.target,
                rewardAmount
            );

            await rewardToken.approve(asyncVault.target, rewardAmount);

            const secondTx = await asyncVault.addReward(
                rewardToken.target,
                rewardAmount
            );

            await expect(
                secondTx
            ).to.emit(asyncVault, "RewardAdded")
                .withArgs(rewardToken.target, rewardAmount);
        });

        it("Should revert if amount is zero", async function () {
            const { asyncVault, rewardToken } = await deployFixture();
            const rewardAmount = 0;

            await expect(
                asyncVault.addReward(
                    rewardToken.target,
                    rewardAmount,

                )
            ).to.be.revertedWith("AsyncVault: Amount can't be zero");
        });

        it("Should revert if reward token is staking token", async function () {
            const { asyncVault, stakingToken } = await deployFixture();
            const rewardAmount = 10;

            await expect(
                asyncVault.addReward(
                    stakingToken.target,
                    rewardAmount,

                )
            ).to.be.revertedWith("AsyncVault: Reward and Staking tokens cannot be same");
        });

        it("Should revert if no token staked yet", async function () {
            const { asyncVault, rewardToken } = await deployFixture();
            const rewardAmount = 10;

            await expect(
                asyncVault.addReward(
                    rewardToken.target,
                    rewardAmount,

                )
            ).to.be.revertedWith("AsyncVault: No token staked yet");
        });

        it("Should revert if invalid reward token", async function () {
            const { asyncVault } = await deployFixture();
            const rewardAmount = 10;

            await expect(
                asyncVault.addReward(
                    ZeroAddress,
                    rewardAmount,

                )
            ).to.be.revertedWith("AsyncVault: Invalid reward token");
        });
    });
});
