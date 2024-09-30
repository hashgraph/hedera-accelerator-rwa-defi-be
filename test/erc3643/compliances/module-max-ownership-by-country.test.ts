import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

async function deployMaxOwnershipFullSuite() {
  const context = await loadFixture(deploySuiteWithModularCompliancesFixture);
  const complianceModule = await ethers.deployContract('MaxOwnershipByCountryModule');
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
    complianceCountry: 840 // ISO US country code
  };
}

describe('Compliance Module: MaxOwnershipByCountry', () => {
  it('should deploy the MaxOwnership contract and bind it to the compliance', async () => {
    const context = await loadFixture(deployMaxOwnershipFullSuite);

    expect(await context.suite.complianceModule.getAddress()).not.to.be.undefined;
    expect(await context.suite.compliance.isModuleBound(await context.suite.complianceModule.getAddress())).to.be.true;
  });

  describe('.name', () => {
    it('should return the name of the module', async () => {
      const context = await loadFixture(deployMaxOwnershipFullSuite);

      expect(await context.suite.complianceModule.name()).to.be.equal('MaxOwnershipByCountryModule');
    });
  });

  describe('.isPlugAndPlay', () => {
    it('should return false', async () => {
      const context = await loadFixture(deployMaxOwnershipFullSuite);
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.false;
    });
  });

  describe('.canComplianceBind', () => {
    describe('when token totalSupply is greater than zero', () => {
      describe('when compliance preset status is false', () => {
        it('should return false', async () => {
          const context = await loadFixture(deployMaxOwnershipFullSuite);
          await context.suite.token.connect(context.accounts.tokenAgent).mint(context.accounts.aliceWallet.address, 1000);
          expect(await context.suite.complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.false;
        });
      });

      describe('when compliance preset status is true', () => {
        it('should return true', async () => {
          const context = await loadFixture(deployMaxOwnershipFullSuite);
          const complianceModule = await ethers.deployContract('MaxOwnershipByCountryModule');

          await complianceModule
            .connect(context.accounts.deployer)
            .preSetModuleState(await context.suite.compliance.getAddress(), context.accounts.aliceWallet.address, 100);

          expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
        });
      });
    });

    describe('when token totalSupply is zero', () => {
      it('should return true', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const complianceModule = await ethers.deployContract('MaxOwnershipByCountryModule');

        expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
      });
    });
  });

  describe('.setMaxPercentage', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);

        await expect(context.suite.complianceModule.setMaxPercentage(context.complianceCountry, 100, 50)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should set max percentage', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);

        const tx = await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, 100, 50]),
          await context.suite.complianceModule.getAddress(),
        );

        await expect(tx).to.emit(context.suite.complianceModule, 'MaxPercentageSet').withArgs(await context.suite.compliance.getAddress(), 100, 50);
      });
    });
  });

  describe('.preSetModuleState', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
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
          const context = await loadFixture(deployMaxOwnershipFullSuite);
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
          const complianceModule = await ethers.deployContract('MaxOwnershipByCountryModule');

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
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        await expect(
          context.suite.complianceModule.connect(context.accounts.aliceWallet).presetCompleted(await context.suite.compliance.getAddress()),
        ).to.be.revertedWithCustomError(context.suite.complianceModule, `OnlyComplianceOwnerCanCall`);
      });
    });

    describe('when calling via deployer', () => {
      it('should update preset status as true', async () => {
        const context = await loadFixture(deployComplianceFixture);
        const complianceModule = await ethers.deployContract('MaxOwnershipByCountryModule');

        await complianceModule.connect(context.accounts.deployer).presetCompleted(await context.suite.compliance.getAddress());

        expect(await complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
      });
    });
  });

  describe('.batchPreSetModuleState', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
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
          const context = await loadFixture(deployMaxOwnershipFullSuite);
          await expect(
            context.suite.complianceModule.connect(context.accounts.deployer).batchPreSetModuleState(await context.suite.compliance.getAddress(), [], []),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `InvalidPresetValues`);
        });
      });

      describe('when the lengths of the _id and _balance arrays are not equal', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxOwnershipFullSuite);
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
          const context = await loadFixture(deployMaxOwnershipFullSuite);
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
          const complianceModule = await ethers.deployContract('MaxOwnershipByCountryModule');

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
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const from = context.accounts.aliceWallet.address;
        const to = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleTransferAction(from, to, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      describe('when value exceeds the max percentage', () => {
        it('should revert', async () => {
          const context = await loadFixture(deployMaxOwnershipFullSuite);
          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;
          const decimals = await context.suite.token.decimals();

          // mint one thousand tokens to create total supply
          await context.suite.token
            .connect(context.accounts.tokenAgent)
            .mint(context.accounts.aliceWallet, ethers.parseUnits('1000' ,decimals));
          
          const twentyPercent = ethers.parseUnits('20' , 2);
          const oneHundredPercent = ethers.parseUnits('100' , 2);
          const twoHundred = ethers.parseUnits('200' ,decimals);

          // set 100% as the max percentage of ownership in order to mint for the sender
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, oneHundredPercent, oneHundredPercent]),
            await context.suite.complianceModule.getAddress(),
          );

          // mint total supply (1000 tokens) to the from address
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [
              from,
              await context.suite.token.totalSupply(),
            ]),
            await context.suite.complianceModule.getAddress(),
          );

          // set 20% as the max percentage of ownership
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, twentyPercent]),
            await context.suite.complianceModule.getAddress(),
          );

           // transfer 200 (20% of total suply) tokens to the "to" address 
           await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, twoHundred],
            ),
            await context.suite.complianceModule.getAddress(),
          );
          
          // attemp to transfer another 200 token to "to" address (this exceeds 20%)
          await expect(
            context.suite.compliance.callModuleFunction(
              new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
                'moduleTransferAction',
                [from, to, twoHundred ],
              ),
              await context.suite.complianceModule.getAddress(),
            ),
          ).to.be.revertedWithCustomError(context.suite.complianceModule, `MaxOwnershipExceeded`);
        });
      });

      describe('when value does not exceed the max ownership', () => {
        it('should update receiver and sender balances', async () => {
          const context = await loadFixture(deployMaxOwnershipFullSuite);
          const from = context.accounts.aliceWallet.address;
          const to = context.accounts.bobWallet.address;
          const decimals = await context.suite.token.decimals();
          const senderIdentity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);
          const receiverIdentity = await context.suite.identityRegistry.identity(context.accounts.bobWallet.address);

          // mint one thousand tokens to create total supply
          await context.suite.token
            .connect(context.accounts.tokenAgent)
            .mint(context.accounts.aliceWallet, ethers.parseUnits('1000', decimals));
          
          const tenPercent = ethers.parseUnits('10', 2);
          const twentyPercent = ethers.parseUnits('20', 2);
          const oneHundred = ethers.parseUnits('100', decimals);

          // set local maxPercentage 20% and nonlocal 10%
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, tenPercent]),
            await context.suite.complianceModule.getAddress(),
          );

          // call moduleMintAction with 200 hundred tokens (20%) to alice which is a local resident
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [
              from,
              2n * oneHundred,
            ]),
            await context.suite.complianceModule.getAddress(),
          );

          // transfer 100 tokens (10%) for bob wich is non local
          await context.suite.compliance.callModuleFunction(
            new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData(
              'moduleTransferAction',
              [from, to, oneHundred],
            ),
            await context.suite.complianceModule.getAddress(),
          );

          const senderBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), senderIdentity);
          expect(senderBalance).to.be.eq(oneHundred);

          const receiverBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), receiverIdentity);
          expect(receiverBalance).to.be.eq(oneHundred);
        });
      });
    });
  });

  describe('.moduleMintAction', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const to = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleMintAction(to, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {    
      it('should update minter balance', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const to = context.accounts.aliceWallet.address;
        const receiverIdentity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);

        const decimals = await context.suite.token.decimals();
        const twentyPercent = ethers.parseUnits("20", 2);

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, ethers.parseUnits("1000", decimals));

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, twentyPercent]),
          await context.suite.complianceModule.getAddress(),
        );

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [to, ethers.parseUnits("20", decimals)]),
          await context.suite.complianceModule.getAddress(),
        );

        const receiverBalance = await context.suite.complianceModule.getIDBalance(await context.suite.compliance.getAddress(), receiverIdentity);
        expect(receiverBalance).to.be.eq(ethers.parseUnits("20", decimals));
      });
    });
  });

  describe('.moduleBurnAction', () => {
    describe('when calling directly', () => {
      it('should revert', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const from = context.accounts.bobWallet.address;

        await expect(context.suite.complianceModule.moduleBurnAction(from, 10)).to.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via compliance', () => {
      it('should update sender balance', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const from = context.accounts.aliceWallet.address;
        const senderIdentity = await context.suite.identityRegistry.identity(context.accounts.aliceWallet.address);

        const decimals = await context.suite.token.decimals();
        const twentyPercent = ethers.parseUnits('20', 2);
        const twenty = ethers.parseUnits('20', decimals);
        const oneHundred = ethers.parseUnits('100', decimals);

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, ethers.parseUnits('1000', decimals));

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, twentyPercent]),
          await context.suite.complianceModule.getAddress(),
        );

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
    describe('when identity not found', () => {
      it('should return false', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const to = context.accounts.anotherWallet.address;
        const from = context.accounts.aliceWallet.address;

        const decimals = await context.suite.token.decimals();
        const twentyPercent = ethers.parseUnits('20', 2);
        const oneHundred = ethers.parseUnits('100', decimals);

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, ethers.parseUnits('1000', decimals));
        

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, twentyPercent]),
          await context.suite.complianceModule.getAddress(),
        );

        await expect(context.suite.complianceModule.moduleCheck(from, to, oneHundred, await context.suite.compliance.getAddress())).to.revertedWith(
          'identity not found',
        );
      });
    });

    describe('when value exceeds compliance max ownership', () => {
      it('should return false', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const toAlice = context.accounts.aliceWallet.address;
        const toBob = context.accounts.bobWallet.address;
        const from = context.accounts.bobWallet.address;

        const decimals = await context.suite.token.decimals();
        const tenPercent = ethers.parseUnits('10', 2);
        const twentyPercent = ethers.parseUnits('20', 2);
        const oneHundred = ethers.parseUnits('100', decimals);

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, ethers.parseUnits('1000', decimals));

        // set 20% to local and 10% to non local
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, tenPercent]),
          await context.suite.complianceModule.getAddress(),
        );

        const result1 = await context.suite.complianceModule.moduleCheck(from, toAlice, 3n * oneHundred, await context.suite.compliance.getAddress());
        expect(result1).to.be.false;

        const result2 = await context.suite.complianceModule.moduleCheck(from, toBob, 2n * oneHundred, await context.suite.compliance.getAddress());
        expect(result2).to.be.false;
      });
    });

    describe('when user balance exceeds compliance max balance', () => {
      it('should return false', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const toAlice = context.accounts.aliceWallet.address;
        const toBob = context.accounts.bobWallet.address;
        const from = context.accounts.bobWallet.address;

        const decimals = await context.suite.token.decimals();
        const tenPercent = ethers.parseUnits('10', 2);
        const twentyPercent = ethers.parseUnits('20', 2);
        const oneHundred = ethers.parseUnits('100', decimals);

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, ethers.parseUnits('1000', decimals));

        // set 20% to local and 10% to non local
        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, tenPercent]),
          await context.suite.complianceModule.getAddress(),
        );

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [toAlice, 2n * oneHundred]),
          await context.suite.complianceModule.getAddress(),
        );

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function moduleMintAction(address _to, uint256 _value)']).encodeFunctionData('moduleMintAction', [toBob, 1n * oneHundred]),
          await context.suite.complianceModule.getAddress(),
        );

        const result1 = await context.suite.complianceModule.moduleCheck(from, toAlice, oneHundred, await context.suite.compliance.getAddress());
        expect(result1).to.be.false;

        const result2 = await context.suite.complianceModule.moduleCheck(from, toBob, oneHundred, await context.suite.compliance.getAddress());
        expect(result2).to.be.false;
      });
    });

    describe('when user balance does not exceed compliance max balance', () => {
      it('should return true', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const toAlice = context.accounts.aliceWallet.address;
        const toBob = context.accounts.aliceWallet.address;
        const from = context.accounts.bobWallet.address;

        const decimals = await context.suite.token.decimals();
        const tenPercent = ethers.parseUnits('10', 2);
        const twentyPercent = ethers.parseUnits('20', 2);
        const oneHundred = ethers.parseUnits('100', decimals);

        // mint one thousand tokens to create total supply
        await context.suite.token
          .connect(context.accounts.tokenAgent)
          .mint(context.accounts.aliceWallet, ethers.parseUnits('1000', decimals));

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, tenPercent]),
          await context.suite.complianceModule.getAddress(),
        );

        const result1 = await context.suite.complianceModule.moduleCheck(from, toAlice, 2n * oneHundred, await context.suite.compliance.getAddress());
        expect(result1).to.be.true;

        const result2 = await context.suite.complianceModule.moduleCheck(from, toBob, oneHundred, await context.suite.compliance.getAddress());
        expect(result2).to.be.true;
      });
    });

    describe('when token total supply is zero', () => {
      it('should return true', async () => {
        const context = await loadFixture(deployMaxOwnershipFullSuite);
        const to = context.accounts.bobWallet.address;
        const from = context.accounts.aliceWallet.address;

        const decimals = await context.suite.token.decimals();
        const twentyPercent = ethers.parseUnits('20', 2);
        const oneHundred = ethers.parseUnits('100', decimals) 

        await context.suite.compliance.callModuleFunction(
          new ethers.Interface(['function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal)']).encodeFunctionData('setMaxPercentage', [context.complianceCountry, twentyPercent, twentyPercent]),
          await context.suite.complianceModule.getAddress(),
        );

        expect(await context.suite.complianceModule.moduleCheck(from, to, oneHundred, await context.suite.compliance.getAddress())).to.be.equal(true);
      });
    });
  });
});
