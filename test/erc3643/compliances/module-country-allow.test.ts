import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { ethers } from 'hardhat';
import { expect } from 'chai';
import { deployComplianceFixture } from '../fixtures/deploy-compliance.fixture';

describe('CountryAllowModule', () => {
  async function deployComplianceWithCountryAllowModule() {
    const context = await loadFixture(deployComplianceFixture);
    const { compliance } = context.suite;

    const countryAllowModule = await ethers.deployContract('CountryAllowModule');
    await compliance.addModule(await countryAllowModule.getAddress());

    return { ...context, suite: { ...context.suite, countryAllowModule } };
  }

  describe('.name()', () => {
    it('should return the name of the module', async () => {
      const {
        suite: { countryAllowModule },
      } = await loadFixture(deployComplianceWithCountryAllowModule);

      expect(await countryAllowModule.name()).to.be.equal('CountryAllowModule');
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

  describe('.batchAllowCountries()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(anotherWallet).batchAllowCountries([42, 66])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(deployer).batchAllowCountries([42, 66])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via the compliance contract', () => {
      it('should allow the given countries', async () => {
        const {
          suite: { compliance, countryAllowModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData('batchAllowCountries', [
              [42, 66],
            ]),
            await countryAllowModule.getAddress(),
          );

        await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 42);
        await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 66);

        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 42)).to.be.true;
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 66)).to.be.true;
      });
    });
  });

  describe('.batchDisallowCountries()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(anotherWallet).batchDisallowCountries([42, 66])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(deployer).batchDisallowCountries([42, 66])).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via the compliance contract', () => {
      it('should disallow the given countries', async () => {
        const {
          suite: { compliance, countryAllowModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        const tx = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchDisallowCountries(uint16[] calldata countries)']).encodeFunctionData(
              'batchDisallowCountries',
              [[42, 66]],
            ),
            await countryAllowModule.getAddress(),
          );

        await expect(tx).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(await compliance.getAddress(), 42);
        await expect(tx).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(await compliance.getAddress(), 66);

        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 42)).to.be.false;
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 66)).to.be.false;
      });
    });
  });

  describe('.addAllowedCountry()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(anotherWallet).addAllowedCountry(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(deployer).addAllowedCountry(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via the compliance contract', () => {
      describe('when country is already allowed', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryAllowModule);

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData('addAllowedCountry', [42]),
              await countryAllowModule.getAddress(),
            );

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData('addAllowedCountry', [42]),
                await countryAllowModule.getAddress(),
              ),
          )
            .to.be.revertedWithCustomError(countryAllowModule, 'CountryAlreadyAllowed')
            .withArgs(await compliance.getAddress(), 42);
        });
      });

      describe('when country is not allowed', () => {
        it('should allow the given country', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryAllowModule);

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData('addAllowedCountry', [42]),
              await countryAllowModule.getAddress(),
            );

          await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 42);

          expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 42)).to.be.true;
        });
      });
    });
  });

  describe('.removeAllowedCountry()', () => {
    describe('when calling not via the Compliance contract', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { anotherWallet },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(anotherWallet).removeAllowedCountry(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling as the owner', () => {
      it('should revert', async () => {
        const {
          suite: { countryAllowModule },
          accounts: { deployer },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        await expect(countryAllowModule.connect(deployer).removeAllowedCountry(42)).to.be.revertedWith('only bound compliance can call');
      });
    });

    describe('when calling via the compliance contract', () => {
      describe('when country is not allowed', () => {
        it('should revert', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryAllowModule);

          await expect(
            compliance
              .connect(deployer)
              .callModuleFunction(
                new ethers.Interface(['function removeAllowedCountry(uint16 country)']).encodeFunctionData('removeAllowedCountry', [42]),
                await countryAllowModule.getAddress(),
              ),
          )
            .to.be.revertedWithCustomError(countryAllowModule, 'CountryNotAllowed')
            .withArgs(await compliance.getAddress(), 42);
        });
      });

      describe('when country is allowed', () => {
        it('should disallow the given country', async () => {
          const {
            suite: { compliance, countryAllowModule },
            accounts: { deployer },
          } = await loadFixture(deployComplianceWithCountryAllowModule);

          await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData('addAllowedCountry', [42]),
              await countryAllowModule.getAddress(),
            );

          const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function removeAllowedCountry(uint16 country)']).encodeFunctionData('removeAllowedCountry', [42]),
              await countryAllowModule.getAddress(),
            );

          await expect(tx).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(await compliance.getAddress(), 42);

          expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 42)).to.be.false;
        });
      });
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

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData('batchAllowCountries', [
              [42, 66],
            ]),
            await countryAllowModule.getAddress(),
          );

        await contract.setInvestorCountry(42);

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

        await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchAllowCountries(uint16[] calldata countries)']).encodeFunctionData('batchAllowCountries', [
              [42, 66],
            ]),
            await countryAllowModule.getAddress(),
          );

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

  describe('.getAllowedCountries()', () => {
    describe('when there is no allowed countries', () => {
      it('should return empty', async () => {
        const {
          suite: { countryAllowModule, compliance },
        } = await loadFixture(deployComplianceWithCountryAllowModule);

        const list = await countryAllowModule.getAllowedCountries(compliance);
        expect(list).to.be.deep.equals([]);
      });
    });

    describe('when there is allowed countries', () => {
      it('should return list of allowed countries', async () => {
        const {
          suite: { countryAllowModule, compliance },
          accounts: { deployer }
        } = await loadFixture(deployComplianceWithCountryAllowModule);
        
        // add allowed
        const tx = await compliance
            .connect(deployer)
            .callModuleFunction(
              new ethers.Interface(['function addAllowedCountry(uint16 country)']).encodeFunctionData('addAllowedCountry', [42n]),
              await countryAllowModule.getAddress(),
            );
        
        await expect(tx).to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 42);
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 42n)).to.be.true;

        // batch add allowed
        const tx2 = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchAllowCountries(uint16[] _countries)']).encodeFunctionData('batchAllowCountries', [[43n, 44n, 45n, 46n]]),
            await countryAllowModule.getAddress(),
          );    
        
        await expect(tx2)
          .to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 43n)
          .to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 44n)
          .to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 45n)
          .to.emit(countryAllowModule, 'CountryAllowed').withArgs(await compliance.getAddress(), 46n);
          
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 43n)).to.be.true;
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 44n)).to.be.true;
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 45n)).to.be.true;
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 46n)).to.be.true;

        const list1 = await countryAllowModule.getAllowedCountries(compliance);
        expect(list1).to.be.deep.equals([42n, 43n, 44n, 45n, 46n]);

        // batch disallow
        const tx3 = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function batchDisallowCountries(uint16[] calldata countries)']).encodeFunctionData(
              'batchDisallowCountries',
              [[44n, 45n]],
            ),
            await countryAllowModule.getAddress(),
          );

        await expect(tx3).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(await compliance.getAddress(), 44n);
        await expect(tx3).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(await compliance.getAddress(), 45n);

        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 44n)).to.be.false;
        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 45n)).to.be.false;

        // disallow one
        const tx4 = await compliance
          .connect(deployer)
          .callModuleFunction(
            new ethers.Interface(['function removeAllowedCountry(uint16 country)']).encodeFunctionData('removeAllowedCountry', [46n]),
            await countryAllowModule.getAddress(),
          );

        await expect(tx4).to.emit(countryAllowModule, 'CountryUnallowed').withArgs(await compliance.getAddress(), 46n);

        expect(await countryAllowModule.isCountryAllowed(await compliance.getAddress(), 46n)).to.be.false;
          
        // list allowed countries
        const list2 = await countryAllowModule.getAllowedCountries(compliance);
        expect(list2).to.be.deep.equals([42n, 43n]);
      });
    });
  });
});
