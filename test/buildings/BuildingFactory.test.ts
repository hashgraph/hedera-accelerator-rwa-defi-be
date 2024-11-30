import { LogDescription } from 'ethers';
import { expect, ethers } from '../setup';
import { BuildingFactory } from '../../typechain-types';

async function deployFixture() {
  const [owner, notOwner] = await ethers.getSigners();
  
  const usdcAddress = "0x0000000000000000000000000000000000001549";
  const uniswapRouterAddress = "0x0000000000000000000000000000000000004b40";
  const uniswapFactoryAddress = "0x00000000000000000000000000000000000026e7";

  const usdc = await ethers.getContractAt('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20', usdcAddress);

  // create the NFT separately because ERC721Metadata is too large
  // must transfer ownership to BuildingFactory
  console.log(' - deploying Building NFT Collection');
  const nftCollectionFactory = await ethers.getContractFactory('ERC721Metadata', owner);
  const nftCollection = await nftCollectionFactory.deploy("Building NFT", "BILDNFT",);
  await nftCollection.waitForDeployment();
  const nftCollectionAddress = await nftCollection.getAddress();

  // // Deploy implementations
  console.log(' - deploying BuildingFactory')
  const buildingFactoryFactory = await ethers.getContractFactory('BuildingFactory', owner);
  const buildingFactory = await buildingFactoryFactory.deploy();
  await buildingFactory.waitForDeployment();
  // const buildingFactory = await ethers.getContractAt('BuildingFactory', "0x5979e42f408E771dE80704F05DD9cabCed6A10B9");
  const buildingFactoryAddress = await buildingFactory.getAddress()
  console.log(' - BuildingFactory address', buildingFactoryAddress);

  console.log(' - transfer NFT ownership to BuildingFactory');
  await nftCollection.transferOwnership(buildingFactoryAddress);
  
  console.log(' - Initializing BuildingFactory');
  const tx = await buildingFactory.initialize(nftCollectionAddress, usdcAddress, uniswapRouterAddress, uniswapFactoryAddress);
  await tx.wait();

  return {
    owner,
    notOwner,
    buildingFactory,
    usdc
  }
}

// get ERC721Metadata NFT collection deployed on contract deployment
async function getDeployeBuilding(buildingFactory: BuildingFactory, blockNumber: number) {
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
  describe('.newBuilding()', () => {
    describe('when there is ', () => {
      it('should do it', async () => {
        const { buildingFactory, usdc } = await deployFixture();

        const usdcAmount = ethers.parseUnits('1', 6);
        const tokenAmount = ethers.parseUnits('100', 6);

        // create a unique salt to create2 new building
        // (factoryAddress)-usdc-(tokenSymbol)
        const salt = ethers.id(`${await buildingFactory.getAddress()}-usdc-bild`);

        console.log('- new building');
        const tx = await buildingFactory.newBuilding(salt, { value: ethers.parseEther('10'), gasLimit: 800000 });
        await tx.wait();
        console.log('- new building created', tx.hash);

        const newBuilding = await getDeployeBuilding(buildingFactory, Number(tx.blockNumber));
        const newBuildingAddress = await newBuilding.getAddress();
        console.log(' - newBuildingAddress',  newBuildingAddress)

        console.log('- approving usdc to buildingFactory');
        const txapprove = await usdc.approve(buildingFactory.getAddress(), usdcAmount);
        await txapprove.wait();
        console.log('- usdc to buildingFactory approved');

        console.log('- add liquidity to Building');
        const tx2 = await buildingFactory.addLiquidityToBuilding(newBuildingAddress, usdcAmount, tokenAmount, { value: ethers.parseEther('20'), gasLimit: 8000000 });
        await tx2.wait();
        console.log('- liquidity added', tx2.hash);

        // const buildingAddress =  await buildingFactory.building();

        const building = await ethers.getContractAt('Building', newBuildingAddress);
        const _usdc = await building.usdc();
        const _token = await building.token();

        console.log({ _usdc, _token, newBuildingAddress })

        // // should emit NewBuilding event
        // await expect(tx).to.emit(buildingFactory, 'NewBuilding');
        
        // const newBuilding = await getDeployeBuilding(buildingFactory)
        // const newBuildingAddress = await newBuilding.getAddress();
        
        // expect(newBuildingAddress).to.be.properAddress; // Verify it's a valid address
        // expect(await nftCollection.ownerOf(0)).to.be.equal(newBuildingAddress);// Very it is the owner of new minted NFT
        // expect(await usdc.balanceOf(newBuildingAddress)).to.be.equal(1000n);
        
      });
    });
  });
});
