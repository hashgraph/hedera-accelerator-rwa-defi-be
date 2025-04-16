import { ethers } from 'hardhat';
import Deployments from '../../../data/deployments/chain-296.json';
import { LogDescription } from 'ethers';
import { BuildingFactory, BuildingGovernance } from '../../../typechain-types';

async function getDeployedBuilding(buildingFactory: BuildingFactory, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters['NewBuilding(address,address)'], blockNumber, blockNumber);
  // Decode the log using the contract's interface
  const event = logs[0]; // Get the first log
  const decodedEvent = buildingFactory.interface.parseLog(event) as LogDescription;

  // Extract and verify the emitted address
  const newBuildingAddress = decodedEvent.args[0]; // Assuming the address is the first argument
  return await ethers.getContractAt('Building', newBuildingAddress);
}

async function getDeployedToken(buildingFactory: BuildingFactory, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters['NewERC3643Token(address,address,address)'], blockNumber, blockNumber);

  // Decode the log using the contract's interface  
  const decodedEvent = buildingFactory.interface.parseLog(logs[0]) as LogDescription; // Get the first log

  // Extract and verify the emitted address  
  return await ethers.getContractAt('Token',  decodedEvent.args[0]); // Assuming the address is the first argument
}

async function getDeployedGovernance(buildingFactory: BuildingFactory, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters['NewGovernance(address,address,address)'], blockNumber, blockNumber);

  // Decode the log using the contract's interface  
  const decodedEvent = buildingFactory.interface.parseLog(logs[0]) as LogDescription; // Get the first log

  // Extract and verify the emitted address  
  return await ethers.getContractAt('BuildingGovernance',  decodedEvent.args[0]); // Assuming the address is the first argument
}

async function getDeployedTreasury(buildingFactory: BuildingFactory, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters['NewTreasury(address,address,address)'], blockNumber, blockNumber);

  // Decode the log using the contract's interface  
  const decodedEvent = buildingFactory.interface.parseLog(logs[0]) as LogDescription; // Get the first log

  // Extract and verify the emitted address  
  return await ethers.getContractAt('Treasury',  decodedEvent.args[0]); // Assuming the address is the first argument
}

async function createBuilding(): Promise<string> {
  const buildingFactory = await ethers.getContractAt(
    "BuildingFactory",
    Deployments.factories.BuildingFactory
  );

  const tokenURI = "ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq"; // URl of building metadata, it will be used to mint new building NFT 
  const tx = await buildingFactory.newBuilding(tokenURI, { gasLimit: 1220000 });
  await tx.wait();

  const building = await getDeployedBuilding(buildingFactory, tx.blockNumber as number)

  console.log("- created new building: ", await building.getAddress());

  return building.getAddress();
}

async function createToken(building: string): Promise<string> {
  const buildingFactory = await ethers.getContractAt(
    "BuildingFactory",
    Deployments.factories.BuildingFactory
  );

  const name = "Token Name";
  const symbol = "Token Symbol";
  const decimals = 18;

  const tx = await buildingFactory.newERC3643Token(building, name, symbol, decimals);
  await tx.wait();

  const token = await getDeployedToken(buildingFactory, tx.blockNumber as number)

  console.log("- created new token: ", await token.getAddress());

  return token.getAddress();
}

async function createTreasury(building: string, token: string): Promise<string> {
  const buildingFactory = await ethers.getContractAt(
    "BuildingFactory",
    Deployments.factories.BuildingFactory
  );

  const reserve = ethers.parseUnits('10000', 6); // 1k USDC reserve
  const npercentage = 20_00; // 20%

  const tx = await buildingFactory.newTreasury(building, token, reserve, npercentage, { gasLimit: 6000000 });
  await tx.wait();

  const treasury = await getDeployedTreasury(buildingFactory, tx.blockNumber as number)

  console.log("- created new treasury: ", await treasury.getAddress());

  return treasury.getAddress();
}

async function createGovernance(building: string, token: string, treasury: string): Promise<string> {
  const buildingFactory = await ethers.getContractAt(
    "BuildingFactory",
    Deployments.factories.BuildingFactory
  );

  const name = "Governance";

  const tx = await buildingFactory.newGovernance(building, name, token, treasury);
  await tx.wait();

  const governance = await getDeployedGovernance(buildingFactory, tx.blockNumber as number);

  console.log("- created new governance: ", await governance.getAddress());

  return governance.getAddress();
}

async function addLiquidity(buildingAddress: string) {
  const [owner] = await ethers.getSigners();
  const buildingFactory = await ethers.getContractAt('BuildingFactory', Deployments.factories.BuildingFactory);

  const building = await ethers.getContractAt('Building', buildingAddress);
  const buildingDetails = await buildingFactory.getBuildingDetails(buildingAddress);

  const buildingTokenAddress = buildingDetails.erc3643Token;
  const buildingToken = await ethers.getContractAt('BuildingERC20', buildingTokenAddress);
  const buildingTokenAmount = ethers.parseEther('1000');

  const usdc = await ethers.deployContract('BuildingERC20', ["USDC", "USDC", 6]);
  const usdcAmount = ethers.parseUnits('1', 6);
  const usdcAddress = await usdc.getAddress();
  
  const mintTx = await buildingToken.mint(owner.address, buildingTokenAmount, { gasLimit: 6000000 });
  await mintTx.wait()

  const usdcMintTx = await usdc.mint(owner.address, usdcAmount, { gasLimit: 6000000 });
  await usdcMintTx.wait()

  const appr1Tx = await buildingToken.approve(buildingAddress, buildingTokenAmount, { gasLimit: 6000000 });
  await appr1Tx.wait();
  const appr2Tx = await usdc.approve(buildingAddress, usdcAmount, { gasLimit: 6000000 });
  await appr2Tx.wait();
  
  const tx = await building.addLiquidity(buildingTokenAddress, buildingTokenAmount, usdcAddress, usdcAmount, { gasLimit: 6000000 });
  await tx.wait();

  console.log('- liquidity added ', tx.hash);
}

async function mintAndDelegateTokens(tokenAddress: string) {
  const [voter1, voter2, voter3] = await ethers.getSigners();

  const token = await ethers.getContractAt('BuildingERC20', tokenAddress);
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
  const building = await createBuilding();
  const token = await createToken(building);
  const treasury = await createTreasury(building, token);
  const governance = await createGovernance(building, token, treasury);

  await mintAndDelegateTokens(token);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
