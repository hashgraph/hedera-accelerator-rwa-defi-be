import { ethers } from 'hardhat';
import Deployments from '../../../data/deployments/chain-296.json';
import { LogDescription } from 'ethers';
import { BuildingFactory } from '../../../typechain-types';
import {uniswapFactoryAddress, uniswapRouterAddress, usdcAddress} from "../../../constants";

async function getDeployedBuilding(buildingFactory: BuildingFactory, blockNumber: number): Promise<unknown[]> {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters.NewBuilding, blockNumber, blockNumber);
  // Decode the log using the contract's interface
  const event = logs[0]; // Get the first log
  const decodedEvent = buildingFactory.interface.parseLog(event) as LogDescription;

  // Extract and verify the emitted address
  return decodedEvent.args as unknown[];
}

async function createBuilding(): Promise<string> {
  const [owner] = await ethers.getSigners();
  const buildingFactory = await ethers.getContractAt(
    "BuildingFactory",
    Deployments.factories.BuildingFactory
  );

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
  
  const tx = await buildingFactory.newBuilding(buildingDetails, { gasLimit: 6_000_000});  
  await tx.wait();

  const [building, token, treasury, vault, governance] = await getDeployedBuilding(buildingFactory, tx.blockNumber as number);

  console.log("- tx sent with hash" + tx.hash);
  console.log("- created new building: ", building);
  console.log("- created new token: ", token);
  console.log("- created new treasury: ", treasury);
  console.log("- created new vault: ", vault);
  console.log("- created new governance: ", governance);

  await mintAndDelegateTokens(token as string);

  return building as string;
}

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

async function mintAndDelegateTokens(tokenAddress: string) {
  const [voter1, voter2, voter3] = await ethers.getSigners();

  const token = await ethers.getContractAt('TokenVotes', tokenAddress);
  const mintAmount = ethers.parseEther('1000');

  const a = await token.mint(voter1.address, mintAmount, { gasLimit: 6000000 });
  const b = await token.mint(voter2.address, mintAmount, { gasLimit: 6000000 });
  const c = await token.mint(voter3.address, mintAmount, { gasLimit: 6000000 });

  await a.wait();
  await b.wait();
  await c.wait();

  console.log('- tokens minted');

  const d = await token.connect(voter1).delegate(voter1.address, { gasLimit: 6000000 });
  const e = await token.connect(voter2).delegate(voter2.address, { gasLimit: 6000000 });
  const f = await token.connect(voter3).delegate(voter3.address, { gasLimit: 6000000 });

  await d.wait();
  await e.wait();
  await f.wait();

  console.log('- votes delegated');
}


async function run () {
  await createBuilding();
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
