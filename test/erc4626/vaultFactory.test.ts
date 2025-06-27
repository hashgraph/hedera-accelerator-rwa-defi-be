import { anyValue, ethers, expect } from "../setup";
import { PrivateKey, Client, AccountId } from "@hashgraph/sdk";
import { ZeroAddress } from "ethers";
import { VaultFactory, VaultToken } from "../../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// constants
const salt = "testSalt";
const cliff = 100;
const unlockDuration = 500;

// Tests
describe("VaultFactory", function () {
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

        const identityImplementation = await ethers.deployContract('Identity', [owner.address, true], owner);
        const identityImplementationAuthority = await ethers.deployContract('ImplementationAuthority', [await identityImplementation.getAddress()], owner);
        const identityFactory = await ethers.deployContract('IdFactory', [await identityImplementationAuthority.getAddress()], owner);
        const identityGateway = await ethers.deployContract('IdentityGateway', [await identityFactory.getAddress(), []], owner);
        const identityGatewayAddress = await identityGateway.getAddress();

        // Staking Token
        const VaultToken = await ethers.getContractFactory("VaultToken");
        const stakingToken = await VaultToken.deploy(
            18
        ) as VaultToken;
        await stakingToken.waitForDeployment();

        const VaultFactory = await ethers.getContractFactory("VaultFactory");
        const vaultFactory = await VaultFactory.deploy(identityGatewayAddress) as VaultFactory;
        await vaultFactory.waitForDeployment();

        return {
            vaultFactory,
            stakingToken,
            client,
            owner,
        };
    }

    describe("deployVault", function () {
        it("Should deploy Vault", async function () {
            const { vaultFactory, stakingToken, owner } = await loadFixture(deployFixture);
            const vaultDetails = {
                stakingToken: stakingToken.target,
                shareTokenName: "TST",
                shareTokenSymbol: "TST",
                vaultRewardController: owner.address,
                feeConfigController: owner.address,
                cliff: cliff,
                unlockDuration: unlockDuration
            }

            const feeConfig = {
                receiver: ZeroAddress,
                token: ZeroAddress,
                feePercentage: 0
            }

            const tx = await vaultFactory.deployVault(
                salt,
                vaultDetails,
                feeConfig
            );
            await tx.wait();

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(vaultFactory, "VaultDeployed")
                .withArgs(anyValue, stakingToken.target, "TST", "TST");
        });
    });
});
