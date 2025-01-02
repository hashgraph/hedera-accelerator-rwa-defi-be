import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deploySuiteWithModularCompliancesFixture } from '../fixtures/deploy-full-suite.fixture';

describe('TransferLimitOneHundredModule', () => {
  async function deployComplianceWithTransferLimitOneHundred() {
    const context = await loadFixture(deploySuiteWithModularCompliancesFixture);

    const complianceModule = await ethers.deployContract('TransferLimitOneHundredModule');
    await context.suite.compliance.bindToken(await context.suite.token.getAddress());
    await context.suite.compliance.addModule(await complianceModule.getAddress());

    return { ...context, suite: { ...context.suite, complianceModule } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { complianceModule },
      } = await loadFixture(deployComplianceWithTransferLimitOneHundred);

      expect(await complianceModule.name()).to.be.equal('TransferLimitOneHundredModule');
    });
  });

  describe('.isPlugAndPlay()', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployComplianceWithTransferLimitOneHundred);
      expect(await context.suite.complianceModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind()', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployComplianceWithTransferLimitOneHundred);
      expect(await context.suite.complianceModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
    });
  });

  describe('.moduleTransferAction', () => {
    describe('when transfering more than one hundred tokens', () => {
      it('should revert', async () => {
        const {
          suite: { compliance, complianceModule, token },
          accounts: { aliceWallet, bobWallet }
        } = await loadFixture(deployComplianceWithTransferLimitOneHundred);

        const decimals = await token.decimals();
        const hundredOne = 101n * 10n ** decimals;

        await expect(compliance.callModuleFunction(
          new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData('moduleTransferAction', [aliceWallet.address, bobWallet.address, hundredOne]),
          await complianceModule.getAddress(),
        )).to.be.rejectedWith('Transfer amount must be one hundred or less');
      });
    });

    describe('when transfering one hundred tokens or less', () => {
      it('should resolve', async () => {
        const {
          suite: { compliance, complianceModule, token },
          accounts: { aliceWallet, bobWallet }
        } = await loadFixture(deployComplianceWithTransferLimitOneHundred);

        const decimals = await token.decimals();
        const hundred = 100n * 10n ** decimals;

        await compliance.callModuleFunction(
          new ethers.Interface(['function moduleTransferAction(address _from, address _to, uint256 _value)']).encodeFunctionData('moduleTransferAction', [aliceWallet.address, bobWallet.address, hundred]),
          await complianceModule.getAddress(),
        );
      });
    });
  });

  describe('.isComplianceBound()', () => {
    describe('when the address is a bound compliance', () => {
      it('should return true', async () => {
        const {
          suite: { complianceModule, compliance },
        } = await loadFixture(deployComplianceWithTransferLimitOneHundred);

        await expect(complianceModule.isComplianceBound(await compliance.getAddress())).to.be.eventually.true;
      });
    });

    describe('when the address is not a bound compliance', () => {
      it('should return false', async () => {
        const {
          suite: { complianceModule },
        } = await loadFixture(deployComplianceWithTransferLimitOneHundred);

        await expect(complianceModule.isComplianceBound(await complianceModule.getAddress())).to.be.eventually.false;
      });
    });
  });

  describe('.unbindCompliance()', () => {
    describe('when sender is not a bound compliance', () => {
      it('should revert', async () => {
        const {
          suite: { complianceModule, compliance },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithTransferLimitOneHundred);

        await expect(complianceModule.connect(anotherWallet).unbindCompliance(await compliance.getAddress())).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });
  });
});
