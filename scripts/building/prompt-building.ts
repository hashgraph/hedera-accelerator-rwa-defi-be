import { ethers } from "hardhat";
import Deployments from "../../data/deployments/chain-296.json";
import * as readline from "readline";

export async function promptBuilding(): Promise<string> {
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

    return new Promise<string>((resolve) => {
        const prompt =
            `Enter building address` +
            (defaultBuildingAddress ? ` (press enter to use default ${defaultBuildingAddress})` : "") +
            ": ";

        rl.question(prompt, (answer) => {
            rl.close();
            const result = answer.trim() || defaultBuildingAddress;

            if (!result) {
                throw new Error(`Building address is required`);
            }

            resolve(result);
        });
    });
}
