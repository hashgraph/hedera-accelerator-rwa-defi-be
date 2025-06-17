import { ethers } from 'hardhat';
import Deployments from  '../../data/deployments/chain-296.json';
import { uniswapFactoryAddress, uniswapRouterAddress, usdcAddress } from '../../constants';

async function addLiquidity(buildingAddress: string) {
  const [owner] = await ethers.getSigners();
  const buildingFactory = await ethers.getContractAt('BuildingFactory', Deployments.factories.BuildingFactory);

  const buildingDetails = await buildingFactory.getBuildingDetails(buildingAddress);

  const tokenAddress = buildingDetails.erc3643Token;
  const token = await ethers.getContractAt('TokenVotes', tokenAddress);
  const usdc = await ethers.getContractAt('ERC20Mock', usdcAddress);
  const router = await ethers.getContractAt('UniswapV2Router02', uniswapRouterAddress);
  const factory = await ethers.getContractAt('UniswapV2Factory', uniswapFactoryAddress);

  const pairPre = await factory.getPair(tokenAddress, usdcAddress);
  
  if (pairPre === ethers.ZeroAddress) {
    const createPairTx = await factory.createPair(tokenAddress, usdcAddress);
    await createPairTx.wait();
  }

  const pairAddress = await factory.getPair(tokenAddress, usdcAddress);

  // 2. Deploy identity for the pair
  if (await buildingFactory.getIdentity(pairAddress) === ethers.ZeroAddress){
    const identityTx = await buildingFactory.deployIdentityForWallet(pairAddress);
    await identityTx.wait();
      
    // 3. Register the identity
    const countryCode = 840; // USA
    await buildingFactory.registerIdentity(buildingAddress, pairAddress, countryCode);
  }
  
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

  console.log('- liquidity added ', tx.hash);
}


addLiquidity("0xdeadbeef")
  .catch(console.error);
