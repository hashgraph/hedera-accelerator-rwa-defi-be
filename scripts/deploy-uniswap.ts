import { ethers } from "hardhat";

async function deploy() {
  const [owner] = await ethers.getSigners();

  const weth = await ethers.deployContract('WETH9');
  await weth.waitForDeployment();
  const wethAddress = await weth.getAddress();
  const uniswapFactory = await ethers.deployContract('UniswapV2Factory', [owner]);
  await uniswapFactory.waitForDeployment();
  const uniswapFactoryAddress = await uniswapFactory.getAddress();
  const uniswapRouter = await ethers.deployContract('UniswapV2Router02', [uniswapFactoryAddress, wethAddress]);
  await uniswapRouter.waitForDeployment();
  const uniswapRouterAddress = await uniswapRouter.getAddress();

  console.log({uniswapFactoryAddress, uniswapRouterAddress});
}

deploy()
  .catch(console.error)