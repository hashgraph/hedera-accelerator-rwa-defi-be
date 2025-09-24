import { ethers } from "hardhat";
import Deployments from "../../data/deployments/chain-296.json";
import { BuildingFactoryStorage } from "../../typechain-types/contracts/buildings/BuildingFactory.sol/BuildingFactory";

export async function promptBuilding(): Promise<BuildingFactoryStorage.BuildingDetailsStructOutput> {
    // get building token from building factory by passing the building address
    const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);

    // Get first building address as default
    const defaultBuildingAddress = (await buildingFactory.getBuildingList())[0].addr;

    // Prompt user for building address
    const userInput = await new Promise<string>((resolve) => {
        process.stdout.write(`Enter building address (press enter to use default ${defaultBuildingAddress}): `);
        process.stdin.once("data", (data) => resolve(data.toString().trim()));
    });

    const buildingAddress = userInput || defaultBuildingAddress;

    console.log("🏢 Building Address:", buildingAddress, "\n");

    return await buildingFactory.getBuildingDetails(buildingAddress);
}
