import { ethers } from 'hardhat';
import Deployments from '../data/deployments/chain-296.json';

async function registerIdentity() {
  const [deployer] = await ethers.getSigners();

  const WALLET_ADDRESS = "0xdFc55Ab9d723C6281f23b1cB9178a36d249D6E4a";
  const IDENTITY_ADDRESS = "0x993a317DC32E4EeBc8Fa34a352f8d26de36020d4";
  const BUILDING_ADDRESS = "0x7dF75455c67d09dD1a1c5c388096ab33a09D74fb";
  const COUNTRY = 840; // ISO United States country code (see: https://www.iso.org/obp/ui/#search)

  const buildingFactory = await ethers.getContractAt('BuildingFactory', Deployments.factories.BuildingFactory);
  const buildingDetails = await buildingFactory.getBuildingDetails(BUILDING_ADDRESS);
  const token = await ethers.getContractAt('TokenVotes', buildingDetails.erc3643Token);
  const identityRegistryAddress = await token.identityRegistry();
  
  const identityRegistry = await ethers.getContractAt('IdentityRegistry', identityRegistryAddress, deployer);

  const tx = await identityRegistry
    .connect(deployer)
    .registerIdentity(WALLET_ADDRESS, IDENTITY_ADDRESS, COUNTRY);

  await tx.wait()

  console.log({ hash : tx.hash });
}

registerIdentity()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });