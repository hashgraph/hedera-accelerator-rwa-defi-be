import { ethers } from "hardhat";
import Deployments from "../../data/deployments/chain-296.json";
import * as readline from "readline";
import { BuildingFactoryStorage } from "../../typechain-types/contracts/buildings/BuildingFactory.sol/BuildingFactory";

export async function promptBuilding(): Promise<BuildingFactoryStorage.BuildingDetailsStructOutput> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);
    // Get first building address as default
    let defaultBuildingAddress = undefined;

    try {
        defaultBuildingAddress = (await buildingFactory.getBuildingList())?.[0]?.addr;
    } catch (error) {
        console.log("No buildings deployed yet.");
    }

    return new Promise((resolve) => {
        const prompt =
            `Enter building address` +
            (defaultBuildingAddress ? ` (press enter to use default ${defaultBuildingAddress})` : "") +
            ": ";

        rl.question(prompt, async (answer) => {
            rl.close();
            const result = answer.trim() || defaultBuildingAddress;

            if (!result) {
                throw new Error(`Building address is required`);
            }

            resolve(await buildingFactory.getBuildingDetails(result));
        });
    });
}
