import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

describe('OnlyUsaModule', () => {
  async function deployComplianceWithCountryAllowModule() {
    const context = await loadFixture(deployComplianceFixture);
    const { compliance } = context.suite;

    const countryAllowModule = await ethers.deployContract('OnlyUsaModule');
    await compliance.addModule(await countryAllowModule.getAddress());

    return { ...context, suite: { ...context.suite, countryAllowModule } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { countryAllowModule },
      } = await loadFixture(deployComplianceWithCountryAllowModule);

      expect(await countryAllowModule.name()).to.be.equal('OnlyUsaModule');
    });
  });

  describe('.isPlugAndPlay()', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployComplianceWithCountryAllowModule);
      expect(await context.suite.countryAllowModule.isPlugAndPlay()).to.be.true;
    });
  });

  describe('.canComplianceBind()', () => {
    it('should return true', async () => {
      const context = await loadFixture(deployComplianceWithCountryAllowModule);
      expect(await context.suite.countryAllowModule.canComplianceBind(await context.suite.compliance.getAddress())).to.be.true;
    });
  });

  describe('.moduleCheck', () => {
    describe('when identity country is allowed', () => {
      it('should return true', async () => {
        const {
          suite: { compliance, countryAllowModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);
        const contract = await ethers.deployContract('MockContract');
        await compliance.bindToken(await contract.getAddress());

        await contract.setInvestorCountry(840);

        await expect(countryAllowModule.moduleCheck(aliceWallet.address, bobWallet.address, 10, await compliance.getAddress())).to.be.eventually.true;
        await expect(compliance.canTransfer(aliceWallet.address, bobWallet.address, 10)).to.be.eventually.true;
      });
    });

    describe('when identity country is not allowed', () => {
      it('should return false', async () => {
        const {
          suite: { compliance, countryAllowModule },
          accounts: { deployer, aliceWallet, bobWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);
        const contract = await ethers.deployContract('MockContract');
        await compliance.bindToken(await contract.getAddress());

        await contract.setInvestorCountry(10);

        await expect(countryAllowModule.moduleCheck(aliceWallet.address, bobWallet.address, 16, await compliance.getAddress())).to.be.eventually.false;
        await expect(compliance.canTransfer(aliceWallet.address, bobWallet.address, 16)).to.be.eventually.false;
      });
    });
  });

  describe('.isComplianceBound()', () => {
    describe('when the address is a bound compliance', () => {
      it('should return true', async () => {
        const {
          suite: { countryAllowModule, compliance },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.isComplianceBound(await compliance.getAddress())).to.be.eventually.true;
      });
    });

    describe('when the address is not a bound compliance', () => {
      it('should return false', async () => {
        const {
          suite: { countryAllowModule },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.isComplianceBound(await countryAllowModule.getAddress())).to.be.eventually.false;
      });
    });
  });

  describe('.unbindCompliance()', () => {
    describe('when sender is not a bound compliance', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule, compliance },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(anotherWallet).unbindCompliance(await compliance.getAddress())).to.be.revertedWith(
          'only bound compliance can call',
        );
      });
    });
  });
});
