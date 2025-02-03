import { ethers } from 'hardhat';
import Deployments from '../../data/deployments/chain-296.json';

async function createBuilding() {
  const buildingFactory = await ethers.getContractAt(
    "BuildingFactory",
    Deployments.factories.BuildingFactory
  );

  const tokenURI = "ipfs://bafkreifuy6zkjpyqu5ygirxhejoryt6i4orzjynn6fawbzsuzofpdgqscq"; // URl of building metadata, it will be used to mint new building NFT 
  const tx = await buildingFactory.newBuilding(tokenURI);
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
