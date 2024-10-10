import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

async function deployMaxTenPercentOwnershipFullSuite() {
  const context = await loadFixture(deploySuiteWithModularCompliancesFixture);
  const complianceModule = await ethers.deployContract('MaxTenPercentOwnershipModule');
  await context.suite.token.connect(context.accounts.tokenAgent).burn(context.accounts.aliceWallet.address, 1000);
  await context.suite.token.connect(context.accounts.tokenAgent).burn(context.accounts.bobWallet.address, 500);
  await context.suite.compliance.bindToken(await context.suite.token.getAddress());
  await context.suite.compliance.addModule(await complianceModule.getAddress());

  return {
    ...context,
    suite: {
      ...context.suite,
      complianceModule,
    },
  };
}

describe('Compliance Module: MaxTenPercentOwnership', () => {
  it('should deploy the MaxTenPercentOwnership contract and bind it to the compliance', async () => {
    const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);

    expect(await context.suite.complianceModule.getAddress()).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(await context.suite.complianceModule.getAddress())).to.be.true;
  });

  describe('.name', () => {
    it('should return the name of the module', async () => {
      const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);

      expect(await context.suite.complianceModule.name()).to.be.equal('MaxTenPercentOwnershipModule');
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return false', async () => {
      const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.false;
    });
  });

  describe('.canComplianceBind', () => {
    describe('when token totalSupply is greater than zero', () => {
      describe('when compliance preset status is false', () => {
        it('should return false', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          await context.suite.token.connect(context.accounts.tokenAgent).mint(context.accounts.aliceWallet.address, 1000);
          expect(await context.suite.complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.false;
        });
      });

      describe('when compliance preset status is true', () => {
        it('should return true', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          const complianceModule = await ethers.deployContract('MaxTenPercentOwnershipModule');

          await complianceModule
            .connect(context.accounts.deployer)
            .preSetModuleState(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100);

          expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
        });
      });
    });

    describe('when token totalSupply is zero', () => {
      it('should return true', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const complianceModule = await ethers.deployContract('MaxTenPercentOwnershipModule');

        expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
      });
    });
  });

  describe('.preSetModuleState', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        await expect(
          context.suite.complianceModule
            .connect(context.accounts.aliceWallet)
            .preSetModuleState(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100),
        ).to.be.revertedWithCustomError(context.suite.complianceModule, `OnlyComplianceOwnerCanCall`);
      });
    });

    describe('when calling via deployer', () => {
      describe('when compliance already bound', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          await expect(
            context.suite.complianceModule
              .connect(context.accounts.deployer)
              .preSetModuleState(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `TokenAlreadyBound`);
        });
      });

      describe('when compliance is not yet bound', () => {
        it('should preset', async () => {
          const context = await loadFixture(deployComplianceFixture);
          const complianceModule = await ethers.deployContract('MaxTenPercentOwnershipModule');

          const tx = await complianceModule
            .connect(context.accounts.deployer)
            .preSetModuleState(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100);

          await expect(tx)
            .to.emit(complianceModule, 'IDBalancePreSet')
            .withArgs(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100);
        });
      });
    });
  });

  describe('.presetCompleted', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        await expect(
          context.suite.complianceModule.connect(context.accounts.aliceWallet).presetCompleted(await context.suite.compliance.getAddress()),
        ).to.be.revertedWithCustomError(context.suite.complianceModule, `OnlyComplianceOwnerCanCall`);
      });
    });

    describe('when calling via deployer', () => {
      it('should update preset status as true', async () => {
        const context = await loadFixture(deployComplianceFixture);
        const complianceModule = await ethers.deployContract('MaxTenPercentOwnershipModule');

        await complianceModule.connect(context.accounts.deployer).presetCompleted(await context.suite.compliance.getAddress());

        expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
      });
    });
  });

  describe('.batchPreSetModuleState', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        await expect(
          context.suite.complianceModule
            .connect(context.accounts.aliceWallet)
            .batchPreSetModuleState(await context.suite.compliance.getAddress(), [context.accounts.aliceWallet.address], [100]),
        ).to.be.revertedWithCustomError(context.suite.complianceModule, `OnlyComplianceOwnerCanCall`);
      });
    });

    describe('when calling via deployer', () => {
      describe('when _id array is empty', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          await expect(
            context.suite.complianceModule.connect(context.accounts.deployer).batchPreSetModuleState(await context.suite.compliance.getAddress(), [], []),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `InvalidPresetValues`);
        });
      });

      describe('when the lengths of the _id and _balance arrays are not equal', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          await expect(
            context.suite.complianceModule
              .connect(context.accounts.deployer)
              .batchPreSetModuleState(
                await context.suite.compliance.getAddress(),
                [context.accounts.aliceWallet.address, context.accounts.bobWallet.address],
                [100],
              ),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `InvalidPresetValues`);
        });
      });

      describe('when compliance already bound', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          await expect(
            context.suite.complianceModule
              .connect(context.accounts.deployer)
              .batchPreSetModuleState(await context.suite.compliance.getAddress(), [context.accounts.aliceWallet.address], [100]),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `TokenAlreadyBound`);
        });
      });

      describe('when compliance is not yet bound', () => {
        it('should preset', async () => {
          const context = await loadFixture(deployComplianceFixture);
          const complianceModule = await ethers.deployContract('MaxTenPercentOwnershipModule');

          const tx = await complianceModule
            .connect(context.accounts.deployer)
            .batchPreSetModuleState(
              await context.suite.compliance.getAddress(),
              [context.accounts.aliceWallet.address, context.accounts.bobWallet.address],
              [100, 200],
            );

          await expect(tx)
            .to.emit(complianceModule, 'IDBalancePreSet')
            .withArgs(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100)
            .to.emit(complianceModule, 'IDBalancePreSet')
            .withArgs(await context.suite.compliance.getAddress(), context.accounts.bobWallet.address, 200);
        });
      });
    });
  });

  describe('.moduleTransferAction', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const from = context.accounts.aliceWallet.address;
        const to = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleTransferAction(from, to, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      describe('when value exceeds the max percentage', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;
          const decimals = await context.suite.token.decimals();

          // mint one thousand tokens to create total supply
          await context.suite.token
            .connect(context.accounts.tokenAgent)
            .mint(context.accounts.aliceWallet, 1000n * 10n ** decimals);
          
          const oneHundred = 100n * 10n ** decimals;

          // mint 100 tokens in the complice 
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [
              from,
              oneHundred,
            ]),
            await context.suite.complianceModule.getAddress(),
          );

           // transfer 100 (10% of total suply) tokens to the "to" address 
           await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, oneHundred],
            ),
            await context.suite.complianceModule.getAddress(),
          );

           // mint another 100 tokens in the complice 
           await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [
              from,
              oneHundred,
            ]),
            await context.suite.complianceModule.getAddress(),
          );
          
          // attemp to transfer 100 token to "to" address (this exceeds 10%)
          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
                'moduleTransferAction',
                [from, to, oneHundred ],
              ),
              await context.suite.complianceModule.getAddress(),
            ),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `MaxOwnershipExceeded`);
        });
      });

      describe('when value does not exceed the max ownership', () => {
        it('should update receiver and sender balances', async () => {
          const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;
          const decimals = await context.suite.token.decimals();
          const senderIdentity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);
          const receiverIdentity = await context.suite.identityRegistry.identity(context.accounts.bobWallet.address);

          // mint one thousand tokens to create total supply
          await context.suite.token
            .connect(context.accounts.tokenAgent)
            .mint(context.accounts.aliceWallet, 1000n * 10n ** decimals);
          
          const oneHundred = 100n * 10n ** decimals;
          const fifty = 50n * 10n ** decimals;


          // call moduleMintAction with 100 hundred tokens (10%)
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [
              from,
              oneHundred,
            ]),
            await context.suite.complianceModule.getAddress(),
          );

          // transfer 50 tokens (less then 10%)
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, fifty],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const senderBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), senderIdentity);
          expect(senderBalance).to.be.eq(fifty);

          const receiverBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), receiverIdentity);
          expect(receiverBalance).to.be.eq(fifty);
        });
      });
    });
  });

  describe('.moduleMintAction', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const to = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleMintAction(to, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should update minter balance', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const to = context.accounts.aliceWallet.address;
        const receiverIdentity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);

        const decimals = await context.suite.token.decimals();
        const oneHundred = 100n * 10n ** decimals;

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, 1000n * 10n ** decimals);

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [to, oneHundred]),
          await context.suite.complianceModule.getAddress(),
        );

        const receiverBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), receiverIdentity);
        expect(receiverBalance).to.be.eq(oneHundred);
      });
    });
  });

  describe('.moduleBurnAction', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const from = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleBurnAction(from, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should update sender balance', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const from = context.accounts.aliceWallet.address;
        const senderIdentity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);

        const decimals = await context.suite.token.decimals();
        const twenty = 20n * 10n ** decimals;
        const oneHundred = 100n * 10n ** decimals;

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, 1000n * 10n ** decimals);

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [from, oneHundred]),
          await context.suite.complianceModule.getAddress(),
        );

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function moduleBurnAction(address _from, uint256 _value)']).encodeFunctionData('moduleBurnAction', [from, twenty]),
          await context.suite.complianceModule.getAddress(),
        );

        const senderBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), senderIdentity);
        expect(senderBalance).to.be.eq(oneHundred - twenty);
      });
    });
  });

  describe('.moduleCheck', () => {
      it('should always return true', async () => {
        const context = await loadFixture(deployMaxTenPercentOwnershipFullSuite);
        const to = context.accounts.bobWallet.address;
        const from = context.accounts.aliceWallet.address;

        const decimals = await context.suite.token.decimals();
        const oneHundred = 100n * 10n ** decimals;        

        expect(await context.suite.complianceModule.moduleCheck(from, to, oneHundred, await context.suite.compliance.getAddress())).to.be.equal(true);
      });
    });
});
