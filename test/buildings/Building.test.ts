import { expect, ethers, upgrades } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

async function deployFixture() {
  const [owner, notOwner] = await ethers.getSigners();

  // Uniswap
  const UniswapV2Factory = await ethers.getContractFactory('UniswapV2Factory', owner);
  const uniswapFactory = await UniswapV2Factory.deploy(
      owner.address,
  );
  await uniswapFactory.waitForDeployment();
  const uniswapFactoryAddress = await uniswapFactory.getAddress();

  const WETH = await ethers.getContractFactory('WETH9', owner);
  const weth = await WETH.deploy();
  await weth.waitForDeployment();

  const UniswapV2Router02 = await ethers.getContractFactory('UniswapV2Router02', owner);
  const uniswapRouter = await UniswapV2Router02.deploy(
    uniswapFactoryAddress,
    weth.target
  );
  await uniswapRouter.waitForDeployment();
  const uniswapRouterAddress = await uniswapRouter.getAddress();

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

  const buildingFactory = await ethers.getContractFactory('Building');
  const buildingBeacon = await upgrades.deployBeacon(
    buildingFactory, 
  );
  
  const building = await upgrades.deployBeaconProxy(
    await buildingBeacon.getAddress(), 
    buildingFactory,
    [owner.address], 
    { initializer: 'initialize'}
  );


  return {
    owner,
    notOwner,
    tokenA,
    tokenAAddress,
    tokenB,
    tokenBAddress,
    nftCollection,
    nftCollectionAddress,
    uniswapRouterAddress,
    uniswapFactoryAddress,
    building,
    buildingBeacon,
  }
}

describe('Building', () => {

  describe('upgrade', () => {
    it('should be uprgradable', async () => {
      const { 
        building,
        buildingBeacon
       } = await loadFixture(deployFixture);

      const previousBuildingAddress = await building.getAddress();
      const v2contractFactory = await ethers.getContractFactory('BuildingMock');
      await upgrades.upgradeBeacon(await buildingBeacon.getAddress(), v2contractFactory);

      const upgradedBuilding = await ethers.getContractAt('BuildingMock', previousBuildingAddress);

      expect(await upgradedBuilding.getAddress()).to.be.hexEqual(previousBuildingAddress);
      expect(await upgradedBuilding.version()).to.be.equal('2.0');
    });
  });

  describe('.newBuilding()', () => {    
    it('should deploy new Building', async () => {
      const { 
        owner,
        building,
       } = await loadFixture(deployFixture);

      expect(await building.getAuditRegistry()).to.be.properAddress;
      expect(await building.owner()).to.be.hexEqual(owner.address);
      
    });
  });
});
