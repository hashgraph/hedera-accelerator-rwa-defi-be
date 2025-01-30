import { ethers } from 'hardhat';
import Deployments from  '../../data/deployments/chain-296.json';

async function createBuildingToken() {
  const buildingFactory = await ethers.getContractAt('BuildingFactory', Deployments.factories.BuildingFactory);
  const buildingAddress = "0x0f8CEC1b612c3827084C65dE7Bd5A6F4B47BE93d";

  const tx = await buildingFactory.newERC3643Token(buildingAddress, "New Token Name", "SYMBOL", 18, { gasLimit : 6000000 });
  await tx.wait();

  const [
    addr, //address addr; // building address
    nftId, //uint256 nftId; // NFT token ID attributed to the building
    tokenURI, //string tokenURI; // NFT metadatada location
    identity, //address identity; // building's OnchainID identity address
    erc3643Token, //address erc3643Token; // TRex token
  ] = await buildingFactory.getBuildingDetails(buildingAddress);
  
  console.log({erc3643Token});
}

createBuildingToken()
  .catch(console.error);
