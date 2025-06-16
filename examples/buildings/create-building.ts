import { ethers } from 'hardhat';
import Deployments from '../../data/deployments/chain-296.json';
import { usdcAddress } from '../../constants';

async function createBuilding() {
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

  const buildingList = await buildingFactory.getBuildingList();

  const newlyCreated = buildingList[buildingList.length - 1];

  console.log("New building info:", newlyCreated);
  console.log("New building address:", newlyCreated.addr);
}

createBuilding()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
