import { ethers } from 'hardhat';
import Deployments from  '../../data/deployments/chain-296.json';

async function createBuildingToken() {
  const [owner] = await ethers.getSigners();

  const buildingFactory = await ethers.getContractAt('BuildingFactory', Deployments.factories.BuildingFactory);
  const buildingList = await buildingFactory.getBuildingList();
  const buildingAddress = buildingList[buildingList.length - 1].addr; // last created building

  const building = await ethers.getContractAt('Building', buildingAddress);
  const buildingDetails = await buildingFactory.getBuildingDetails(buildingAddress);

  const tokenAAddress = buildingDetails.erc3643Token;
  const tokenA = await  ethers.getContractAt('BuildingERC20', tokenAAddress);
  const tokenAAmount = ethers.parseEther('1000');

  const tokenB = await ethers.deployContract('BuildingERC20', ["USDC", "USDC", 6]);
  const tokenBAddress = await tokenB.getAddress();
  const tokenBAmount = ethers.parseEther('10');

  await tokenA.mint(owner.address, tokenAAmount);
  await tokenB.mint(owner.address, tokenBAmount);

  await tokenA.approve(buildingAddress, tokenAAmount);
  await tokenB.approve(buildingAddress, tokenBAmount);
  
  const tx = await building.addLiquidity(tokenAAddress, tokenAAmount, tokenBAddress, tokenBAmount, { gasLimit : 6000000 });
  await tx.wait();

  console.log(tx.hash);
}

createBuildingToken()
  .catch(console.error);
