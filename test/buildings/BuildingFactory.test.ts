import { Contract, LogDescription, } from 'ethers';
import { expect, ethers, upgrades } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

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

  // Deploy implementations

  const buildingFactoryFactory = await ethers.getContractFactory('BuildingFactory', owner);
  const buildingFactoryBeacon = await upgrades.deployBeacon(buildingFactoryFactory);

  const buildingFactory = await upgrades.deployBeaconProxy(
    await buildingFactoryBeacon.getAddress(),
    buildingFactoryFactory,
    [
      nftCollectionAddress, 
      uniswapRouterAddress, 
      uniswapFactoryAddress
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
      } = await loadFixture(deployFixture);

      const salt = ethers.id(`BUILDING_ONE`);
      const tokenURI = "ipfs://building-nft-uri";
      const tx = await buildingFactory.newBuilding(salt, tokenURI);
      await tx.wait();
      const building  = await getDeployeBuilding(buildingFactory, tx.blockNumber as number);

      expect(await building.getAddress()).to.be.properAddress;
      expect(await nftCollection.ownerOf(0)).to.be.equal(await building.getAddress());
      expect(await nftCollection.tokenURI(0)).to.be.equal(tokenURI);
      expect(await building.uniswapFactory()).to.be.hexEqual(uniswapFactoryAddress);
      expect(await building.uniswapRouter()).to.be.hexEqual(uniswapRouterAddress);

      const firstBuilding = await buildingFactory.buildingsList(0);

      expect(firstBuilding.addr).to.be.hexEqual(await building.getAddress());
      expect(firstBuilding.nftId).to.be.equal(0n);
      expect(firstBuilding.salt).to.be.equal(salt);
      expect(firstBuilding.tokenURI).to.be.equal(tokenURI);

    });

    it('should revert if building already created', async () => {
      const { 
        buildingFactory, 
      } = await loadFixture(deployFixture);

      const salt = ethers.id(`BUILDING_ONE`);
      const tokenURI = "ipfs://building-nft-uri";
      await buildingFactory.newBuilding(salt, tokenURI);

      await expect(buildingFactory.newBuilding(salt, tokenURI))
        .to.be.revertedWith('BuildingFactory: Building alreadyExists');
    });

  });
});
