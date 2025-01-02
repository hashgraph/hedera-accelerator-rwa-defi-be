import { ethers, expect } from "../setup";
import { PrivateKey, Client, AccountId } from "@hashgraph/sdk";
import { ZeroAddress } from "ethers";
import hre from "hardhat";

// constants
const rewardTokenAddress = "0x0000000000000000000000000000000000423252";
const deployedFactory = "0xabAF69016bE44d738680fe2298941e278dC8C55a";

const salt = "testSalt";
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

        const erc20 = await hre.artifacts.readArtifact("contracts/erc4626/ERC20.sol:ERC20");

        const vaultFactory = await ethers.getContractAt(
            "VaultFactory",
            deployedFactory
        );

        return {
            vaultFactory,
            client,
            owner,
        };
    }

    describe("deployVault", function () {
        it("Should deploy Vault", async function () {
            const { vaultFactory, owner } = await deployFixture();
            const vaultDetails = {
                stakingToken: "0x0000000000000000000000000000000000423251",
                shareTokenName: "TST",
                shareTokenSymbol: "TST",
                vaultRewardController: owner.address,
                feeConfigController: owner.address
            }

            const feeConfig = {
                receiver: ZeroAddress,
                token: ZeroAddress,
                feePercentage: 0
            }

            const tx = await vaultFactory.deployVault(
                salt,
                vaultDetails,
                feeConfig,
                { from: owner.address, gasLimit: 3000000, value: ethers.parseUnits("23", 18) }
            );

            console.log(tx.hash);

            await expect(
                tx
            ).to.emit(vaultFactory, "VaultDeployed");
        });
    });
});
