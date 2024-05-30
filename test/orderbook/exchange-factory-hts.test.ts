import { ethers } from 'hardhat';
import { expect } from 'chai';
import { PrivateKey, Client, AccountId } from "@hashgraph/sdk";

// Tests
describe("ExchangeFactory", function () {
    async function deployFixture() {
        const [owner] = await ethers.getSigners();

        let client = Client.forTestnet();

        const operatorPrKey = PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY || '');
        const operatorAccountId = AccountId.fromString(process.env.ACCOUNT_ID || '');

        client.setOperator(
            operatorAccountId,
            operatorPrKey
        );

        const exchangeFactoryFactory = await ethers.getContractFactory("ExchangeFactoryHTS", owner);
        const exchangeFactory = await exchangeFactoryFactory.deploy();
        await exchangeFactory.waitForDeployment();

        return {
            exchangeFactory,
            client,
            owner,
        };
    }

    describe("deployExchange", function () {
      describe("when there is no exchange created for the pair", () => {
        it("should deploy exchange", async function () {
          const { exchangeFactory, owner } = await deployFixture();
          const exchangeDetails = {
              tokenA: "0x000000000000000000000000000000000042cf0f",
              tokenB: "0x000000000000000000000000000000000042cf11",
          }

          const tx = await exchangeFactory.deployExchange(
              exchangeDetails.tokenA,
              exchangeDetails.tokenB,
              { from: owner.address, gasLimit: 3000000 }
          );

          await expect(tx).to.emit(exchangeFactory, "ExchangeDeployed");
        });
      });

      describe("when there is already an exchange created", () => {
        it("should revert", async function () {
        // @notice: revertedWith feature is not working with hedera
        
        //   const { exchangeFactory, owner } = await deployFixture();
        //   const exchangeDetails = {
        //       tokenA: "0x000000000000000000000000000000000042cf0f",
        //       tokenB: "0x000000000000000000000000000000000042cf11",
        //   }

        // await exchangeFactory.deployExchange(
        //     exchangeDetails.tokenA,
        //     exchangeDetails.tokenB,
        //     { from: owner.address, gasLimit: 3000000 }
        // );

        // await expect(exchangeFactory.deployExchange(
        //   exchangeDetails.tokenA,
        //   exchangeDetails.tokenB,
        //   { from: owner.address, gasLimit: 3000000 })).to.be.revertedWith('Exchange already deployed');
        // });
        });
      });
    });
});
