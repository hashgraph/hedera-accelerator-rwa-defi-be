import { Contract, LogDescription, } from 'ethers';
import { expect, ethers, upgrades } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import * as ERC721MetadataABI from '../../data/abis/ERC721Metadata.json';

async function deployFixture() {
  const [owner, notOwner] = await ethers.getSigners();

  const uniswapRouter = await ethers.deployContract('UniswapRouterMock', []);
  const uniswapRouterAddress = await uniswapRouter.getAddress();
  const uniswapFactory = await ethers.deployContract('UniswapFactoryMock', []);
  const uniswapFactoryAddress = await uniswapFactory.getAddress();

  const tokenA = await ethers.deployContract('ERC20Mock', ["Token A", "TKA", 18]);
  const tokenB = await ethers.deployContract('ERC20Mock', ["Token B", "TkB", 6]); // USDC

  await tokenA.waitForDeployment();
  await tokenB.waitForDeployment();
  const tokenAAddress = await tokenA.getAddress();
  const tokenBAddress = await tokenB.getAddress();

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

  // identityGateway must be the Owner of the IdFactory
  await identityFactory.transferOwnership(identityGatewayAddress);

  // Beacon Upgradable Patter for Building
  const buildingImplementation = await ethers.deployContract('Building');
  const buildingImplementationAddress = await buildingImplementation.getAddress();

  const buildingBeaconFactory = await ethers.getContractFactory('BuildingBeacon');
  const buildingBeacon = await buildingBeaconFactory.deploy(buildingImplementationAddress)
  await buildingBeacon.waitForDeployment();
  const buildingBeaconAddress = await buildingBeacon.getAddress();

  // Deploy BuildingFactory
  const buildingFactoryFactory = await ethers.getContractFactory('BuildingFactory', owner);
  const buildingFactoryBeacon = await upgrades.deployBeacon(buildingFactoryFactory);

  const buildingFactory = await upgrades.deployBeaconProxy(
    await buildingFactoryBeacon.getAddress(),
    buildingFactoryFactory,
    [
      nftCollectionAddress, 
      uniswapRouterAddress, 
      uniswapFactoryAddress,
      buildingBeaconAddress,
      identityGatewayAddress,
    ],
    { 
      initializer: 'initialize'
    }
  );

  await buildingFactory.waitForDeployment();
  const buildingFactoryAddress = await buildingFactory.getAddress()

  await nftCollection.transferOwnership(buildingFactoryAddress);

  return {
    owner,
    notOwner,
    buildingFactory,
    buildingFactoryBeacon,
    tokenA,
    tokenAAddress,
    tokenB,
    tokenBAddress,
    nftCollection,
    nftCollectionAddress,
    uniswapRouterAddress,
    uniswapFactoryAddress,
    identityFactory,
    identityGateway
  }
}

// get ERC721Metadata NFT collection deployed on contract deployment
async function getDeployeBuilding(buildingFactory: Contract, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters['NewBuilding(address)'], blockNumber, blockNumber);

  // Ensure one event was emitted
  expect(logs.length).to.equal(1);

  // Decode the log using the contract's interface
  const event = logs[0]; // Get the first log
  const decodedEvent = buildingFactory.interface.parseLog(event) as LogDescription;

  // Extract and verify the emitted address
  const newBuildingAddress = decodedEvent.args[0]; // Assuming the address is the first argument
  return await ethers.getContractAt('Building', newBuildingAddress);
}

describe('BuildingFactory', () => {
  describe('upgrade', () => {
    it('should be uprgradable', async () => {
      const { 
        buildingFactory,
        buildingFactoryBeacon
       } = await loadFixture(deployFixture);

      const previousBuildingFactoryAddress = await buildingFactory.getAddress();
      const v2contractFactory = await ethers.getContractFactory('BuildingFactoryMock');
      await upgrades.upgradeBeacon(await buildingFactoryBeacon.getAddress(), v2contractFactory);

      const upgradedBuildinFactory = await ethers.getContractAt('BuildingFactoryMock', previousBuildingFactoryAddress);

      expect(await upgradedBuildinFactory.getAddress()).to.be.hexEqual(previousBuildingFactoryAddress);
      expect(await upgradedBuildinFactory.version()).to.be.equal('2.0');
    });
  });


  describe('.newBuilding()', () => {    
    it('should create a building', async () => {
      const { 
        buildingFactory, 
        uniswapFactoryAddress, 
        uniswapRouterAddress, 
        nftCollection,
        identityFactory
      } = await loadFixture(deployFixture);

      const tokenURI = "ipfs://building-nft-uri";
      const tx = await buildingFactory.newBuilding(tokenURI);
      await tx.wait();
      
      const building  = await getDeployeBuilding(buildingFactory, tx.blockNumber as number);
      
      expect(await building.getAddress()).to.be.properAddress;
      expect(await nftCollection.ownerOf(0)).to.be.equal(await building.getAddress());
      expect(await nftCollection.tokenURI(0)).to.be.equal(tokenURI);
      expect(await building.getUniswapFactory()).to.be.hexEqual(uniswapFactoryAddress);
      expect(await building.getUniswapRouter()).to.be.hexEqual(uniswapRouterAddress);
      
      const [firstBuilding] = await buildingFactory.getBuildingList();
      
      expect(firstBuilding[0]).to.be.hexEqual(await building.getAddress());
      expect(firstBuilding[1]).to.be.equal(0n);
      expect(firstBuilding[2]).to.be.equal(tokenURI);
      expect(firstBuilding[3]).to.be.properAddress;
      
      const firstBuildingDetails = await buildingFactory.getBuildingDetails(await building.getAddress());
      
      expect(firstBuildingDetails[0]).to.be.hexEqual(await building.getAddress());
      expect(firstBuildingDetails[1]).to.be.equal(0n);
      expect(firstBuildingDetails[2]).to.be.equal(tokenURI);
      expect(firstBuildingDetails[3]).to.be.equal(firstBuilding[3]);

      const buildingAddress = firstBuilding[0];
      const identityAddress = firstBuilding[3];
      
      await expect(tx).to.emit(identityFactory, 'WalletLinked').withArgs(buildingAddress, identityAddress);
    });

  });

  describe('.callFromBuilding()', () => {
    describe('when INVALID building address', () => {
      it('should revert', async () => {
        const { buildingFactory, nftCollectionAddress } = await loadFixture(deployFixture);
        const invalidBuildingAddress = ethers.Wallet.createRandom().address;
        const NFT_ID = 0;

        const ERC721MetadataIface = new ethers.Interface(ERC721MetadataABI.abi);
        const encodedMetadataFunctionData = ERC721MetadataIface.encodeFunctionData(
          "setMetadata(uint256,string[],string[])", // function selector
          [ // function parameters
            NFT_ID, 
            ["size"], 
            ["8"]
          ]
        );
        
        await expect(
          buildingFactory.callFromBuilding(invalidBuildingAddress, nftCollectionAddress, encodedMetadataFunctionData)
        ).to.be.revertedWith('BuildingFactory: Invalid building address');
      });
    });
    describe('when VAlID building address', () => {
      describe('when contract is NOT whitelisted', () => {
        it('should revert', async () => {
          const { buildingFactory } = await loadFixture(deployFixture);
          const NFT_ID = 0;
          const invalidContractAddress = ethers.Wallet.createRandom().address;

          const tokenURI = "ipfs://building-nft-uri";
          const tx = await buildingFactory.newBuilding(tokenURI);
          await tx.wait();
          
          const building  = await getDeployeBuilding(buildingFactory, tx.blockNumber as number);
          const buildingAddress = await building.getAddress();
  
          const ERC721MetadataIface = new ethers.Interface(ERC721MetadataABI.abi);
          const encodedMetadataFunctionData = ERC721MetadataIface.encodeFunctionData(
            "setMetadata(uint256,string[],string[])", // function selector
            [ // function parameters
              NFT_ID, 
              ["size"], 
              ["8"]
            ]
          );
          
          await expect(
            buildingFactory.callFromBuilding(buildingAddress, invalidContractAddress, encodedMetadataFunctionData)
          ).to.be.revertedWith('BuildingFactory: Invalid callable contract');
        });
      });
      describe('when contract IS whitelisted', () => {
        it('should call ERC721Metadata contract and set metadata', async () => {
          const { buildingFactory, nftCollection, nftCollectionAddress } = await loadFixture(deployFixture);
          const NFT_ID = 0;

          const tokenURI = "ipfs://building-nft-uri";
          const tx = await buildingFactory.newBuilding(tokenURI);
          await tx.wait();
          
          const building  = await getDeployeBuilding(buildingFactory, tx.blockNumber as number);
          const buildingAddress = await building.getAddress();
  
          const ERC721MetadataIface = new ethers.Interface(ERC721MetadataABI.abi);
          const encodedMetadataFunctionData = ERC721MetadataIface.encodeFunctionData(
            "setMetadata(uint256,string[],string[])", // function selector
            [ // function parameters
              NFT_ID, 
              ["size", "type", "color", "city"], 
              ["8", "mp4", "blue", "denver"]
            ]
          );
          
          await buildingFactory.callFromBuilding(buildingAddress, nftCollectionAddress, encodedMetadataFunctionData);
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
});
