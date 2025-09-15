import { LogDescription, } from 'ethers';
import { expect, ethers, upgrades } from '../setup';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import * as ERC721MetadataABI from '../../data/abis/ERC721Metadata.json';
import { BuildingFactory, BuildingGovernance, FeeConfiguration, IAutoCompounderFactory, IVaultFactory } from '../../typechain-types';
import { BuildingFactoryInitStruct } from '../../typechain-types/contracts/buildings/BuildingFactory.sol/BuildingFactory';

async function deployFixture() {
  const [owner, notOwner, voter1, voter2, voter3] = await ethers.getSigners();

  const weth = await ethers.deployContract('WETH9');
  const wethAddress = await weth.getAddress();
  const uniswapFactory = await ethers.deployContract('UniswapV2Factory', [notOwner]);
  await uniswapFactory.waitForDeployment();
  const uniswapFactoryAddress = await uniswapFactory.getAddress();
  const uniswapRouter = await ethers.deployContract('UniswapV2Router02', [uniswapFactoryAddress, wethAddress]);
  await uniswapRouter.waitForDeployment();
  const uniswapRouterAddress = await uniswapRouter.getAddress();

  const tokenA = await ethers.deployContract('ERC20Mock', ["Token A", "TKA", 18]);
  const usdc = await ethers.deployContract('ERC20Mock', ["Token B", "TkB", 6]); // USDC

  await tokenA.waitForDeployment();
  await usdc.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  const usdcAddress = await usdc.getAddress();

  // create the NFT separately because ERC721Metadata is too large
  // must transfer ownership to BuildingFactory
  const nftCollectionFactory = await ethers.getContractFactory('ERC721Metadata', owner);
  const nftCollection = await nftCollectionFactory.deploy("Building NFT", "BILDNFT",);
  await nftCollection.waitForDeployment();
  const nftCollectionAddress = await nftCollection.getAddress();

  const identityImplementation = await ethers.deployContract('Identity', [owner.address, true], owner);
  const identityImplementationAuthority = await ethers.deployContract('ImplementationAuthority', [await identityImplementation.getAddress()], owner);
  const identityFactory = await ethers.deployContract('IdFactory', [await identityImplementationAuthority.getAddress()], owner);
  const identityGateway = await ethers.deployContract('IdentityGateway', [await identityFactory.getAddress(), []], owner);
  const identityGatewayAddress = await identityGateway.getAddress();

  // vault factory
  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactory = await VaultFactory.deploy(identityGatewayAddress);
  await vaultFactory.waitForDeployment();

  // autocompounder factory
  const AutoCompounderFactory = await ethers.getContractFactory("AutoCompounderFactory");
  const autoCompounderFactory = await AutoCompounderFactory.deploy(identityGatewayAddress);
  await autoCompounderFactory.waitForDeployment();

  const upkeeper = await ethers.deployContract('UpKeeper');
  const upkeeperAddress = await upkeeper.getAddress();

  // Beacon Upgradable Patter for Building
  const buildingImplementation = await ethers.deployContract('Building');
  const buildingImplementationAddress = await buildingImplementation.getAddress();

  const buildingBeaconFactory = await ethers.getContractFactory('BuildingBeacon');
  const buildingBeacon = await buildingBeaconFactory.deploy(buildingImplementationAddress)
  await buildingBeacon.waitForDeployment();
  const buildingBeaconAddress = await buildingBeacon.getAddress();

  // Beacon Upgradable Pattern for Treasury
  const treasuryImplementation = await ethers.deployContract('Treasury');
  const treasuryImplementationAddress = await treasuryImplementation.getAddress();
  const treasuryBeaconFactory = await ethers.getContractFactory('TreasuryBeacon');
  const treasuryBeacon = await treasuryBeaconFactory.deploy(treasuryImplementationAddress)
  await treasuryBeacon.waitForDeployment();
  const treasuryBeaconAddress = await treasuryBeacon.getAddress();

  // Beacon Upgradable Pattern for Treasury
  const governanceImplementation = await ethers.deployContract('BuildingGovernance');
  const governanceImplementationAddress = await governanceImplementation.getAddress();
  const governanceBeaconFactory = await ethers.getContractFactory('BuildingGovernanceBeacon');
  const governanceBeacon = await governanceBeaconFactory.deploy(governanceImplementationAddress)
  await governanceBeacon.waitForDeployment();
  const governanceBeaconAddress = await governanceBeacon.getAddress();

  const libraries = {
    "BuildingTokenLib" : await (await (await ethers.deployContract("BuildingTokenLib")).waitForDeployment()).getAddress(),
    "BuildingGovernanceLib" : await (await (await ethers.deployContract("BuildingGovernanceLib")).waitForDeployment()).getAddress(),
    "BuildingTreasuryLib" : await (await (await ethers.deployContract("BuildingTreasuryLib")).waitForDeployment()).getAddress(),
    "BuildingVaultLib" : await (await (await ethers.deployContract("BuildingVaultLib")).waitForDeployment()).getAddress(),
    "BuildingAutoCompounderLib" : await (await (await ethers.deployContract("BuildingAutoCompounderLib")).waitForDeployment()).getAddress(),
  }

  // Deploy BuildingFactory
  const buildingFactoryFactory = await ethers.getContractFactory('BuildingFactory', { libraries } );
  const buildingFactoryBeacon = await upgrades.deployBeacon(buildingFactoryFactory, { unsafeAllowLinkedLibraries: true });

  // TREX SUITE ------------------------------------
  const claimTopicsRegistryImplementation = await ethers.deployContract('ClaimTopicsRegistry', owner);
  const trustedIssuersRegistryImplementation = await ethers.deployContract('TrustedIssuersRegistry', owner);
  const identityRegistryStorageImplementation = await ethers.deployContract('IdentityRegistryStorage', owner);
  const identityRegistryImplementation = await ethers.deployContract('IdentityRegistry', owner);
  const modularComplianceImplementation = await ethers.deployContract('ModularCompliance', owner);
  const tokenImplementation = await ethers.deployContract('TokenVotes', owner);
  const trexImplementationAuthority = await ethers.deployContract('TREXImplementationAuthority',[true, ethers.ZeroAddress, ethers.ZeroAddress], owner);
  
  const versionStruct = {
    major: 4,
    minor: 0,
    patch: 0,
  };

  const contractsStruct = {
    tokenImplementation: await tokenImplementation.getAddress(),
    ctrImplementation: await claimTopicsRegistryImplementation.getAddress(),
    irImplementation: await identityRegistryImplementation.getAddress(),
    irsImplementation: await identityRegistryStorageImplementation.getAddress(),
    tirImplementation: await trustedIssuersRegistryImplementation.getAddress(),
    mcImplementation: await modularComplianceImplementation.getAddress(),
  };

  await trexImplementationAuthority.connect(owner).addAndUseTREXVersion(versionStruct, contractsStruct);
  
  const trexlibraries = {
    "TREXDeployments" : await (await (await ethers.deployContract("TREXDeployments")).waitForDeployment()).getAddress()
  }
  const TREXFactory = await ethers.getContractFactory('TREXFactory', { libraries: trexlibraries });
  const trexFactory = await TREXFactory.deploy(
    await trexImplementationAuthority.getAddress(),
    await identityFactory.getAddress(),
  );
  
  await identityFactory.connect(owner).addTokenFactory(await trexFactory.getAddress());
  const trexGateway = await ethers.deployContract('TREXGateway', [await trexFactory.getAddress(), true], owner);
  await trexFactory.transferOwnership(await trexGateway.getAddress());

  const trexGatewayAddress = await trexGateway.getAddress();
  const trexFactoryAddress = await trexFactory.getAddress();

  // ------------------------------------------------------

  // identityGateway must be the Owner of the IdFactory 
  await identityFactory.transferOwnership(identityGatewayAddress);

  const buildingFactoryInit: BuildingFactoryInitStruct = {
    nft: nftCollectionAddress, 
    uniswapRouter: uniswapRouterAddress, 
    uniswapFactory: uniswapFactoryAddress,
    onchainIdGateway: identityGatewayAddress,
    trexGateway: trexGatewayAddress,
    usdc: usdcAddress,
    buildingBeacon: buildingBeaconAddress,
    treasuryBeacon: treasuryBeaconAddress,
    governanceBeacon: governanceBeaconAddress,
    upkeeper: upkeeperAddress,
  }

  const bf = await upgrades.deployBeaconProxy(
    await buildingFactoryBeacon.getAddress(),
    buildingFactoryFactory,
    [buildingFactoryInit],
    { initializer: 'initialize' }, 
  );

  await bf.waitForDeployment();
  const buildingFactoryAddress = await bf.getAddress()
  const buildingFactory = await ethers.getContractAt('BuildingFactory', buildingFactoryAddress);

  // add identiriry registry agents when deploy new erc3643 tokens
  await buildingFactory.addRegistryAgents([
    await vaultFactory.getAddress(),
    await autoCompounderFactory.getAddress()
  ]);

  await nftCollection.transferOwnership(buildingFactoryAddress);
  await trexGateway.addDeployer(buildingFactoryAddress);

  // grant TRUSTED_REGISTRY_ROLE to building factory
  await upkeeper.grantRole(await upkeeper.TRUSTED_REGISTRY_ROLE(), buildingFactoryAddress);

  return {
    owner,
    notOwner,
    buildingFactory,
    buildingFactoryBeacon,
    tokenA,
    tokenAAddress,
    usdc,
    usdcAddress,
    nftCollection,
    nftCollectionAddress,
    uniswapRouterAddress,
    uniswapFactoryAddress,
    identityFactory,
    identityGateway,
    trexFactoryAddress,
    trexGatewayAddress,
    voter1,
    voter2,
    voter3,
    libraries,
    vaultFactory,
    autoCompounderFactory,
  }
}

// get ERC721Metadata NFT collection deployed on contract deployment
async function getDeployedBuilding(buildingFactory: BuildingFactory, blockNumber: number): Promise<Array<string>> {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters.NewBuilding, blockNumber, blockNumber);

  // Ensure one event was emitted
  expect(logs.length).to.equal(1);

  // Decode the log using the contract's interface
  const event = logs[0]; // Get the first log
  const decodedEvent = buildingFactory.interface.parseLog(event) as LogDescription;

  // Extract and verify the emitted address
  return Array.from(decodedEvent.args);
}

async function getProposalId(governance: BuildingGovernance, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await governance.queryFilter(governance.filters.ProposalCreated, blockNumber, blockNumber);

  // Decode the log using the contract's interface  
  const decodedEvent = governance.interface.parseLog(logs[0]) as LogDescription; // Get the first log

  // Extract and verify the emitted address  
  return decodedEvent.args[0]; 
}

describe('BuildingFactory', () => {
  describe('upgrade', () => {
    it('should be uprgradable', async () => {
      const { 
        buildingFactory,
        buildingFactoryBeacon,
        libraries,
       } = await loadFixture(deployFixture);

      const previousBuildingFactoryAddress = await buildingFactory.getAddress();
      const v2contractFactory = await ethers.getContractFactory('BuildingFactoryMock', { libraries });
      await upgrades.upgradeBeacon(await buildingFactoryBeacon.getAddress(), v2contractFactory, { unsafeAllowLinkedLibraries: true });

      const upgradedBuildinFactory = await ethers.getContractAt('BuildingFactoryMock', previousBuildingFactoryAddress);

      expect(await upgradedBuildinFactory.getAddress()).to.be.hexEqual(previousBuildingFactoryAddress);
      expect(await upgradedBuildinFactory.version()).to.be.equal('2.0');
    });
  });

  describe('.newBuilding()', () => {    
    it('should create a building', async () => {
      const { 
        owner,
        usdcAddress,
        buildingFactory, 
        nftCollection,
      } = await loadFixture(deployFixture);

      const buildingDetails = {
        tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
        tokenName: 'MyToken', 
        tokenSymbol: 'MYT', 
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther('1000'),
        treasuryNPercent: 2000n, 
        treasuryReserveAmount: ethers.parseEther('1000'),
        governanceName : 'MyGovernance',
        vaultShareTokenName: 'Vault Token Name',
        vaultShareTokenSymbol: 'VTS',
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "AutoCompounder Token Name",
        aTokenSymbol: "ACTS"
      }

      const tx = await buildingFactory.newBuilding(buildingDetails);
      await tx.wait();

      const [buildingAddress] = await getDeployedBuilding(buildingFactory, tx.blockNumber as number);
      
      const configTx = await buildingFactory.configNewBuilding(buildingAddress);
      await configTx.wait();
      
      const building = await ethers.getContractAt('Building', buildingAddress);
      
      expect(await building.getAddress()).to.be.properAddress;
      expect(await nftCollection.ownerOf(0)).to.be.equal(await building.getAddress());
      expect(await nftCollection.tokenURI(0)).to.be.equal(buildingDetails.tokenURI);
      
      const [firstBuilding] = await buildingFactory.getBuildingList();
      
      expect(firstBuilding[0]).to.be.hexEqual(await building.getAddress());
      expect(firstBuilding[1]).to.be.equal(0n);
      expect(firstBuilding[2]).to.be.equal(buildingDetails.tokenURI);
      expect(firstBuilding[3]).to.be.properAddress;
      
      const firstBuildingDetails = await buildingFactory.getBuildingDetails(await building.getAddress());
      
      expect(firstBuildingDetails[0]).to.be.hexEqual(await building.getAddress());
      expect(firstBuildingDetails[1]).to.be.equal(0n);
      expect(firstBuildingDetails[2]).to.be.equal(buildingDetails.tokenURI);
      expect(firstBuildingDetails[3]).to.be.equal(firstBuilding[3]);

      const detailsTokenAddress = firstBuilding[4];

      // make sure tokens were minted to the sender
      const buildingToken = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20', detailsTokenAddress);
      expect(await buildingToken.balanceOf(owner)).to.be.equal(ethers.parseEther('1000'));
    });

    it('should be able to create multiple buildings', async () => {
      const { 
        owner,
        voter1,
        voter2,
        voter3,
        usdcAddress,
        buildingFactory, 
      } = await loadFixture(deployFixture);

      const newDetails = (tokenName: string) => {
        return {
          tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
          tokenName: tokenName, 
          tokenSymbol: 'MYT', 
          tokenDecimals: 18n,
          tokenMintAmount: ethers.parseEther('1000'),
          treasuryNPercent: 2000n, 
          treasuryReserveAmount: ethers.parseEther('1000'),
          governanceName : 'MyGovernance',
          vaultShareTokenName: 'vaultTokenName',
          vaultShareTokenSymbol: 'VTS',
          vaultFeeReceiver: owner,
          vaultFeeToken: usdcAddress,
          vaultFeePercentage: 2000,
          vaultCliff: 0n,
          vaultUnlockDuration: 0n,
          aTokenName: 'atokenName',
          aTokenSymbol: "ACTS"
        }
      }

      await expect(await buildingFactory.connect(owner).newBuilding(newDetails('token1'))).to.emit(buildingFactory, 'NewBuilding(address,address,address,address,address,address,address)');
      await expect(await buildingFactory.connect(owner).newBuilding(newDetails('token11'))).to.emit(buildingFactory, 'NewBuilding(address,address,address,address,address,address,address)');
      await expect(await buildingFactory.connect(voter1).newBuilding(newDetails('token2'))).to.emit(buildingFactory, 'NewBuilding(address,address,address,address,address,address,address)');
      await expect(await buildingFactory.connect(voter2).newBuilding(newDetails('token3'))).to.emit(buildingFactory, 'NewBuilding(address,address,address,address,address,address,address)');
      await expect(await buildingFactory.connect(voter3).newBuilding(newDetails('token4'))).to.emit(buildingFactory, 'NewBuilding(address,address,address,address,address,address,address)');
    })
  });

  describe('.configNewBuilding()', () => {
    it ('should revert if building is not found', async () => {
      const { buildingFactory } = await loadFixture(deployFixture);

      const tx = buildingFactory.configNewBuilding(ethers.ZeroAddress);

      await expect(tx).to.be.revertedWith('Building not found');
    });

    it('should revert if building is already configured', async () => {
      const { buildingFactory, owner, usdcAddress } = await loadFixture(deployFixture);

      const buildingDetails = {
        tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
        tokenName: 'MyToken', 
        tokenSymbol: 'MYT', 
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther('1000'),
        treasuryNPercent: 2000n, 
        treasuryReserveAmount: ethers.parseEther('1000'),
        governanceName : 'MyGovernance',
        vaultShareTokenName: 'Vault Token Name',
        vaultShareTokenSymbol: 'VTS',
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "AutoCompounder Token Name",
        aTokenSymbol: "ACTS"
      }

      const tx = await buildingFactory.newBuilding(buildingDetails);
      await tx.wait();

      const [buildingAddress] = await getDeployedBuilding(buildingFactory, tx.blockNumber as number);

      const configTx = await buildingFactory.connect(owner).configNewBuilding(buildingAddress);
      await configTx.wait();

      const configTx2 = buildingFactory.connect(owner).configNewBuilding(buildingAddress);

      await expect(configTx2).to.be.revertedWith('Building already configured');
    });

    it('should revert if sender is not the owner', async () => {
      const { buildingFactory, owner, notOwner, usdcAddress } = await loadFixture(deployFixture);

      const buildingDetails = {
        tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
        tokenName: 'MyToken', 
        tokenSymbol: 'MYT', 
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther('1000'),
        treasuryNPercent: 2000n, 
        treasuryReserveAmount: ethers.parseEther('1000'),
        governanceName : 'MyGovernance',
        vaultShareTokenName: 'Vault Token Name',
        vaultShareTokenSymbol: 'VTS',
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "AutoCompounder Token Name",
        aTokenSymbol: "ACTS"
      }

      const tx = await buildingFactory.newBuilding(buildingDetails);
      await tx.wait();

      const [buildingAddress] = await getDeployedBuilding(buildingFactory, tx.blockNumber as number);

      const configTx = buildingFactory.connect(notOwner).configNewBuilding(buildingAddress);

      await expect(configTx).to.be.revertedWith('Only the owner can configure the building');
    });
  });

  describe('.callContract()', () => {
    describe('when VAlID building address', () => {
      describe('when contract IS whitelisted', () => {
        it('should call ERC721Metadata contract and set metadata', async () => {
          const { owner, usdcAddress, buildingFactory, nftCollection, nftCollectionAddress } = await loadFixture(deployFixture);
          const NFT_ID = 0;

          const buildingDetails = {
            tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
            tokenName: 'MyToken', 
            tokenSymbol: 'MYT', 
            tokenDecimals: 18n,
            tokenMintAmount: ethers.parseEther('1000'),
            treasuryNPercent: 2000n, 
            treasuryReserveAmount: ethers.parseEther('1000'),
            governanceName : 'MyGovernance',
            vaultShareTokenName: 'Vault Token Name',
            vaultShareTokenSymbol: 'VTS',
            vaultFeeReceiver: owner,
            vaultFeeToken: usdcAddress,
            vaultFeePercentage: 2000,
            vaultCliff: 0n,
            vaultUnlockDuration: 0n,
            aTokenName: "AutoCompounder Token Name",
            aTokenSymbol: "ACTS"
          }
          const tx = await buildingFactory.newBuilding(buildingDetails);
          await tx.wait();
          
          const [buildingAddress] = await getDeployedBuilding(buildingFactory, tx.blockNumber as number);
          const building = await ethers.getContractAt('Building', buildingAddress);
  
          const ERC721MetadataIface = new ethers.Interface(ERC721MetadataABI.abi);
          const encodedMetadataFunctionData = ERC721MetadataIface.encodeFunctionData(
            "setMetadata(uint256,string[],string[])", // function selector
            [ // function parameters
              NFT_ID, 
              ["size", "type", "color", "city"], 
              ["8", "mp4", "blue", "denver"]
            ]
          );
          
          await building.callContract(nftCollectionAddress, encodedMetadataFunctionData);
          const metadata = await nftCollection["getMetadata(uint256)"](NFT_ID);

          expect(metadata[0][0]).to.be.equal('size')
          expect(metadata[0][1]).to.be.equal('8')

          expect(metadata[1][0]).to.be.equal('type')
          expect(metadata[1][1]).to.be.equal('mp4')

          expect(metadata[2][0]).to.be.equal('color')
          expect(metadata[2][1]).to.be.equal('blue')

          expect(metadata[3][0]).to.be.equal('city')
          expect(metadata[3][1]).to.be.equal('denver')
        });
      });
    });
  });

  describe('.addRegistryAgents', () => {
    describe('when sender is not owner', () => {
      it('should revert', async () => {
        const { 
          notOwner,
          buildingFactory, 
        } = await loadFixture(deployFixture);
  
        const tx = buildingFactory.connect(notOwner).addRegistryAgents([ethers.ZeroAddress]);
  
        await expect(tx).to.be.rejectedWith('OwnableUnauthorizedAccount');
      });
    });

    describe('when address is invalid', () => {
      it('should revert', async () => {
        const { 
          owner,
          buildingFactory, 
        } = await loadFixture(deployFixture);
  
        const tx = buildingFactory.connect(owner).addRegistryAgents([ethers.ZeroAddress]);
  
        await expect(tx).to.be.revertedWith('Invalid agent address');
      });
    });

    describe('when sender is owner', () => {
      describe('when address is valid', () => {
        it('should add registry agents', async () => {
          const { 
            owner,
            buildingFactory, 
          } = await loadFixture(deployFixture);
    
          const random = ethers.Wallet.createRandom();
          const random1 = ethers.Wallet.createRandom();
          const random2 = ethers.Wallet.createRandom();
    
          const tx = await buildingFactory.connect(owner).addRegistryAgents([random.address, random1.address, random2.address]);
    
          await expect(tx).to.emit(buildingFactory, 'RegistryAgentsAdded').withArgs([random.address, random1.address, random2.address]);
        });
      });
    });
  });

  describe('.removeRegistryAgents', () => {
    describe('when sender is not owner', () => {
      it('should revert', async () => {
        const { 
          notOwner,
          buildingFactory, 
        } = await loadFixture(deployFixture);
  
        const tx = buildingFactory.connect(notOwner).removeRegistryAgent(ethers.ZeroAddress);
  
        await expect(tx).to.be.rejectedWith('OwnableUnauthorizedAccount');
      });
    });

    describe('when address is invalid', () => {
      it('should revert', async () => {
        const { 
          owner,
          buildingFactory, 
        } = await loadFixture(deployFixture);
  
        const tx = buildingFactory.connect(owner).removeRegistryAgent(ethers.ZeroAddress);
  
        await expect(tx).to.be.revertedWith('Invalid agent address');
      });
    });

    describe('when sender is owner', () => {
      describe('when address is valid', () => {
        it('should add registry agents', async () => {
          const { 
            owner,
            buildingFactory, 
          } = await loadFixture(deployFixture);
    
          const random = ethers.Wallet.createRandom();
    
          await buildingFactory.connect(owner).addRegistryAgents([random.address]);
          const tx = await buildingFactory.connect(owner).removeRegistryAgent(random.address);
    
          await expect(tx).to.emit(buildingFactory, 'RegistryAgentRemoved').withArgs(random.address);
        });
      });
    });
  });

  describe('integration flows', () => {
    it('should create building suite (token, vault, treasury governance), create a payment proposal, execute payment proposal', async () => {
        const { buildingFactory, usdc, usdcAddress, owner, voter1, voter2, voter3, identityGateway } = await loadFixture(deployFixture);

        // create building
        const buildingDetails = {
          tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
          tokenName: 'MyToken', 
          tokenSymbol: 'MYT', 
          tokenDecimals: 18n,
          tokenMintAmount: ethers.parseEther('1000'),
          treasuryNPercent: 2000n, 
          treasuryReserveAmount: ethers.parseUnits('1000', 6),
          governanceName : 'MyGovernance',
          vaultShareTokenName: 'Vault Token Name',
          vaultShareTokenSymbol: 'VTS',
          vaultFeeReceiver: owner,
          vaultFeeToken: usdcAddress,
          vaultFeePercentage: 2000,
          vaultCliff: 0n,
          vaultUnlockDuration: 0n,
          aTokenName: "AutoCompounder Token Name",
          aTokenSymbol: "ACTS"
        }
  
        const buildingTx = await buildingFactory.newBuilding(buildingDetails);
        const [
          buildingAddress, 
          tokenAddress,
          treasuryAddress,
          vaultAddress,
          governanceAddress
        ] = await getDeployedBuilding(buildingFactory, buildingTx.blockNumber as number);

        const configTx = await buildingFactory.configNewBuilding(buildingAddress);
        await configTx.wait();

        // create building token
        const token = await ethers.getContractAt('TokenVotes', tokenAddress);
        const treasury = await ethers.getContractAt('Treasury', treasuryAddress);
        const vault = await ethers.getContractAt('BasicVault', vaultAddress);
        const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);

        // identity CAN BE deployed by the owner or the user
        // this is not for each token, can be performed only once.
        await buildingFactory.connect(voter1).deployIdentityForWallet(voter1.address);
        await buildingFactory.connect(voter1).deployIdentityForWallet(voter2.address);
        await buildingFactory.connect(voter1).deployIdentityForWallet(voter3.address);

        // Token Owner MUST be the one that register the identity
        // this is per token, must be performed for every token
        await buildingFactory.connect(voter1).registerIdentity(buildingAddress, voter1.address, 840); // 840 = US
        await buildingFactory.connect(voter1).registerIdentity(buildingAddress, voter2.address, 840);
        await buildingFactory.connect(voter1).registerIdentity(buildingAddress, voter3.address, 840);

        // mint tokens to voter to be delegated for governance voting
        const mintAmount = ethers.parseEther('1000');
        await token.mint(owner.address, mintAmount);
        await token.mint(voter1.address, mintAmount);
        await token.mint(voter2.address, mintAmount);
        await token.mint(voter3.address, mintAmount);
        await token.connect(voter1).delegate(voter1.address);
        await token.connect(voter2).delegate(voter2.address);
        await token.connect(voter3).delegate(voter3.address);

        // stake tokens to vault
        await token.approve(vaultAddress, mintAmount);
        await vault.deposit(mintAmount, owner.address);
        
        // deposit usdc funds to the treasury in order to make payments
        const fundingAmount = ethers.parseUnits('10000', 6);
        await usdc.mint(owner.address, fundingAmount);
        await usdc.approve(treasuryAddress, fundingAmount);
        await treasury.deposit(fundingAmount);
        
        // make sure calculations of excess sent to vault are correct
        const toBusiness = fundingAmount * buildingDetails.treasuryNPercent / 10000n;
        const excessAmount = fundingAmount - buildingDetails.treasuryReserveAmount - toBusiness;
        expect(await usdc.balanceOf(vaultAddress)).to.be.equal(excessAmount);

        // create govenrnace payment proposal
        const amount = ethers.parseUnits('500', 6); // 500 USDT
        const to = ethers.Wallet.createRandom();
        const description = "Proposal #1: Pay 500 dollars";
  
        // receiver at this moment should have 0 usdc balance
        expect(await usdc.balanceOf(to.address)).to.be.eq(ethers.parseUnits('0', 6));
  
        const tx1 = await governance.createPaymentProposal(amount, to.address, description);
        await tx1.wait();
  
        const proposalId = await getProposalId(governance, tx1.blockNumber as number);
  
        // cast votes
        const votingDelay = await governance.votingDelay();
        const votingPeriod = await governance.votingPeriod();        
        await mine(votingDelay) // wait voting delay to begin casting votes
        await governance.connect(voter1).castVote(proposalId, 1); // "for" vote.
        await governance.connect(voter2).castVote(proposalId, 1); // "for" vote.
        await governance.connect(voter3).castVote(proposalId, 1); // "for" vote.
        await mine(votingPeriod); // wait for proposal voting period 
  
        // execute proposal
        await governance.executePaymentProposal(proposalId);
  
        // receiver should have 500 usdc balance after payment executed; 
        expect(await usdc.balanceOf(to.address)).to.be.eq(ethers.parseUnits('500', 6));
    });

    it('should create building, add compliance modules, transfer and trigger the compliance restriction', async () => {
      const { buildingFactory, usdcAddress, owner, voter1, voter2 } = await loadFixture(deployFixture);

      // create building
      const buildingDetails = {
        tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
        tokenName: 'MyToken', 
        tokenSymbol: 'MYT', 
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther('1000'),
        treasuryNPercent: 2000n, 
        treasuryReserveAmount: ethers.parseUnits('1000', 6),
        governanceName : 'MyGovernance',
        vaultShareTokenName: 'Vault Token Name',
        vaultShareTokenSymbol: 'VTS',
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "AutoCompounder Token Name",
        aTokenSymbol: "ACTS"
      }

      const buildingTx = await buildingFactory.newBuilding(buildingDetails);
      const [
        buildingAddress, 
        tokenAddress,
      ] = await getDeployedBuilding(buildingFactory, buildingTx.blockNumber as number);

      const configTx = await buildingFactory.configNewBuilding(buildingAddress);
      await configTx.wait();

      // create building token
      const token = await ethers.getContractAt('TokenVotes', tokenAddress);

      // deploy the compliance modules to be added to the token
      // in this cas CountryAllowModule allowing only USA (840) users.
      const complianceModule = await ethers.deployContract('CountryAllowModule');
      await complianceModule.waitForDeployment();

      const callData = new ethers.Interface(['function addAllowedCountry(uint16)'])
        .encodeFunctionData('addAllowedCountry', [840]) // only allow contry US (840)

      const modularComplianceAddress = await token.compliance();
      const modularCompliance = await ethers.getContractAt('ModularCompliance', modularComplianceAddress);

      // add the module
      await modularCompliance.connect(owner).addModule(await complianceModule.getAddress());
      // call module function addAllowedCountry to define which country is allowed
      const tx = await modularCompliance.callModuleFunction(callData, await complianceModule.getAddress());

      // check event and storage consistency
      await expect(tx).to.emit(complianceModule, 'CountryAllowed').withArgs(modularComplianceAddress, 840);
      expect(await complianceModule.isCountryAllowed(modularComplianceAddress, 840)).to.be.true;

      // deploy identities for users
      await buildingFactory.connect(voter1).deployIdentityForWallet(voter1.address);
      await buildingFactory.connect(voter2).deployIdentityForWallet(voter2.address);

      // register user identities, one US user and one with another nationality
      await buildingFactory.connect(owner).registerIdentity(buildingAddress, voter1.address, 840); // 840 = US
      await buildingFactory.connect(owner).registerIdentity(buildingAddress, voter2.address, 48); // 48 != US 

      // mint token to owner just to transfer it 
      const mintAmount = ethers.parseEther('2000');
      await token.mint(owner.address, mintAmount);

      // transfer tokens to allowed US user
      await token.transfer(voter1.address, ethers.parseEther('1000'));
      expect(await token.balanceOf(voter1.address)).to.be.equal(ethers.parseEther('1000'));

      // transfer to non US user should revert;
      await expect(token.transfer(voter2.address, ethers.parseEther('1000'))).to.be.revertedWith('Transfer not possible'); 
    });

    it('should create building, add liquidity', async () => {      
      const { 
        owner,
        buildingFactory,
        usdc,
        usdcAddress,
        uniswapRouterAddress,
        uniswapFactoryAddress
      } = await loadFixture(deployFixture);

      const buildingDetails = {
        tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
        tokenName: 'MyToken', 
        tokenSymbol: 'MYT', 
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther('1000'),
        treasuryNPercent: 2000n, 
        treasuryReserveAmount: ethers.parseUnits('1000', 6),
        governanceName : 'MyGovernance',
        vaultShareTokenName: 'Vault Token Name',
        vaultShareTokenSymbol: 'VTS',
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "AutoCompounder Token Name",
        aTokenSymbol: "ACTS"
      }

      const buildingTx = await buildingFactory.newBuilding(buildingDetails);
      const [
        buildingAddress, 
        tokenAddress,
      ] = await getDeployedBuilding(buildingFactory, buildingTx.blockNumber as number);

      const configTx = await buildingFactory.configNewBuilding(buildingAddress);
      await configTx.wait();

      // create building token
      const building = await ethers.getContractAt('Building', buildingAddress);
      const token = await ethers.getContractAt('TokenVotes', tokenAddress);
      const router = await ethers.getContractAt('UniswapV2Router02', uniswapRouterAddress);
      const factory = await ethers.getContractAt('UniswapV2Factory', uniswapFactoryAddress);

      const tokenAmount = ethers.parseEther('1000');
      const usdcAmount = ethers.parseUnits('1000', 6);

      await token.mint(owner.address, tokenAmount);
      await usdc.mint(owner.address, usdcAmount);

      await token.approve(uniswapRouterAddress, tokenAmount);
      await usdc.approve(uniswapRouterAddress, usdcAmount);

      const amountTokenMin = tokenAmount * 95n / 100n; // 5% slippage
      const amountUsdcMin = usdcAmount * 95n / 100n;  // 5% slippage
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes

      const tx = await router.addLiquidity(
        tokenAddress,
        usdcAddress,
        tokenAmount,
        usdcAmount,
        amountTokenMin,
        amountUsdcMin,
        owner.address,
        deadline
      );

      await tx.wait(); 

      const pairAddress = await factory.getPair(tokenAddress, usdcAddress);

      const pairCode = await ethers.provider.getCode(pairAddress);
      expect(pairCode).to.not.equal("0x", "Pair should be deployed");

      const pair = await ethers.getContractAt("UniswapV2Pair", pairAddress);
      const lpBalance = await pair.balanceOf(owner.address);
      expect(lpBalance).to.be.gt(0, "Owner should have received LP tokens");

      const reserves = await pair.getReserves();
      expect(reserves[0]).to.be.oneOf([tokenAmount, usdcAmount]);
      expect(reserves[1]).to.be.oneOf([tokenAmount, usdcAmount]);
    });

    it('should create building, create vault and stake, autocompounder and stake', async () => {      
      const { 
        owner,
        buildingFactory,
        vaultFactory,
        autoCompounderFactory,
        usdcAddress,
        uniswapRouterAddress
      } = await loadFixture(deployFixture);

      const buildingDetails = {
        tokenURI: 'ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq', 
        tokenName: 'MyToken', 
        tokenSymbol: 'MYT', 
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther('2000'),
        treasuryNPercent: 2000n, 
        treasuryReserveAmount: ethers.parseUnits('1000', 6),
        governanceName : 'MyGovernance',
        vaultShareTokenName: 'Vault Token Name',
        vaultShareTokenSymbol: 'VTS',
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "AutoCompounder Token Name",
        aTokenSymbol: "ACTS"
      }

      const buildingTx = await buildingFactory.newBuilding(buildingDetails);
      const [
        buildingAddress, 
        tokenAddress,
      ] = await getDeployedBuilding(buildingFactory, buildingTx.blockNumber as number);

      const configTx = await buildingFactory.configNewBuilding(buildingAddress);
      await configTx.wait();

      // get building token
      const token = await ethers.getContractAt('TokenVotes', tokenAddress);

      // deploy vault
      const vaultDetails: IVaultFactory.VaultDetailsStruct = {
        cliff: 0,
        feeConfigController: owner.address,
        shareTokenName: 'Share Token',
        shareTokenSymbol: 'ST',
        stakingToken: tokenAddress,
        unlockDuration: 0,
        vaultRewardController: owner.address
      }

      const feeConfig: FeeConfiguration.FeeConfigStruct = {
        feePercentage: 0,
        receiver: owner.address,
        token: usdcAddress
      }

      await vaultFactory.deployVault("new_vault", vaultDetails, feeConfig);
      const newVaultAddress = await vaultFactory.vaultDeployed("new_vault");
      const newVault = await ethers.getContractAt('BasicVault', newVaultAddress);

      const stakeAmount = ethers.parseEther('1000');

      await token.approve(newVaultAddress, stakeAmount);
      const vaultDeposit = newVault.deposit(stakeAmount, owner.address);      

      await expect(vaultDeposit).not.to.be.rejected;

      // deploy auto compounder
      const acDetails: IAutoCompounderFactory.AutoCompounderDetailsStruct = {
        aTokenName: 'A Token Name',
        aTokenSymbol: 'ATS',
        operator: owner.address,
        uniswapV2Router: uniswapRouterAddress,
        usdc: usdcAddress,
        vault: newVault
      }

      await autoCompounderFactory.deployAutoCompounder("new_autocompounder", acDetails);
      const newAcAddress = await autoCompounderFactory.autoCompounderDeployed("new_autocompounder");
      const newAc = await ethers.getContractAt('AutoCompounder', newAcAddress);

      await token.approve(newAcAddress, stakeAmount);
      const autoCompounderDeposit = newAc.deposit(stakeAmount, owner.address);

      await expect(autoCompounderDeposit).not.to.be.rejected;
    });

  });
});
