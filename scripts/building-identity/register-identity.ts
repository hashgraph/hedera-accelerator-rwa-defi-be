import { ethers } from "hardhat";
import Deployments from "../../data/deployments/chain-296.json";
import { promptAddress } from "../building/prompt-address";

// Description: 🔍 - Register identity
async function registerIdentity() {
    const [deployer] = await ethers.getSigners();

    const WALLET_ADDRESS = promptAddress("wallet address");
    const IDENTITY_ADDRESS = promptAddress("identity address");
    const BUILDING_ADDRESS = promptAddress("building address");
    const COUNTRY = 840; // ISO United States country code (see: https://www.iso.org/obp/ui/#search)

    const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);
    const buildingDetails = await buildingFactory.getBuildingDetails(BUILDING_ADDRESS);
    const token = await ethers.getContractAt("TokenVotes", buildingDetails.erc3643Token);
    const identityRegistryAddress = await token.identityRegistry();

    const identityRegistry = await ethers.getContractAt("IdentityRegistry", identityRegistryAddress, deployer);

    const tx = await identityRegistry.connect(deployer).registerIdentity(WALLET_ADDRESS, IDENTITY_ADDRESS, COUNTRY);

    await tx.wait();

    console.log({ hash: tx.hash });
}

registerIdentity().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
