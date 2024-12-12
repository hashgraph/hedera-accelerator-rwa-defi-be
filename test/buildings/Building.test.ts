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

  const salt = ethers.id('SALT');
  const buildingFactory = await ethers.getContractFactory('Building');
  const buildingBeacon = await upgrades.deployBeacon(
    buildingFactory, 
  );
  
  const building = await upgrades.deployBeaconProxy(
    await buildingBeacon.getAddress(), 
    buildingFactory,
    [
      salt, 
      uniswapRouterAddress, 
      uniswapFactoryAddress, 
      nftCollectionAddress
    ], 
    { 
      initializer: 'initialize'
    }
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
        uniswapRouterAddress, 
        uniswapFactoryAddress,
        building,
       } = await loadFixture(deployFixture);

      expect(await building.uniswapFactory()).to.be.hexEqual(uniswapFactoryAddress);
      expect(await building.uniswapRouter()).to.be.hexEqual(uniswapRouterAddress);
      expect(await building.auditRegistry()).to.be.properAddress;
      expect(await building.owner()).to.be.hexEqual(owner.address);
      
    });

    
    it('should add liquidity', async () => {
      const { 
        owner,
        uniswapRouterAddress, 
        uniswapFactoryAddress,
        nftCollectionAddress,
        tokenA,
        tokenAAddress,
        tokenB,
        tokenBAddress,
       } = await loadFixture(deployFixture);

      const salt = ethers.id('LIQUIDITY');
      const buildingFactory = await ethers.getContractFactory('BuildingMock');
      const building = await upgrades.deployProxy(
        buildingFactory, 
        [
          salt, 
          uniswapRouterAddress, 
          uniswapFactoryAddress, 
          nftCollectionAddress
        ], 
        { 
          initializer: 'initialize'
        }
      );

      const buildingAddress = await building.getAddress();

      const tokenAAmount = ethers.parseEther('100');
      const tokenBAmount = ethers.parseUnits('1', 6);

      await tokenA.mint(owner.address, tokenAAmount);
      await tokenB.mint(owner.address, tokenBAmount);

      await tokenA.approve(buildingAddress, tokenAAmount);
      await tokenB.approve(buildingAddress, tokenBAmount);

       await building.addLiquidity(
        tokenAAddress, 
        tokenAAmount, 
        tokenBAddress, 
        tokenBAmount, 
        {
          value: ethers.parseEther('20'), 
          gasLimit: 800000 
        }
      );      

      expect(await building.amountA()).to.be.equal(tokenAAmount);
      expect(await building.amountB()).to.be.equal(tokenBAmount);
      expect(await building.liquidity()).to.be.equal(tokenAAmount);
      expect(await building.pair()).to.be.properAddress;
      
    });
  });
});
