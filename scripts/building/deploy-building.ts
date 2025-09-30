import { ethers } from "hardhat";
import Deployments from "../../data/deployments/chain-296.json";
import { usdcAddress } from "../../constants";
import { promptString } from "./prompt-string";

// Description: 🏢 - Deploy a new building
async function createBuilding(): Promise<string> {
    const [owner] = await ethers.getSigners();

    const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);

    const buildingName = await promptString("building name");
    const buildingSymbol = await promptString("building symbol");
    const tokenURI = await promptString(
        "token URI",
        "ipfs://bafkreidmn4ozne5okre4wpdjarywmiqgtayamg5r3ceq7sq5ez3m5sfpcq",
    );

    const buildingDetails = {
        tokenURI: tokenURI,
        tokenName: buildingName,
        tokenSymbol: buildingSymbol,
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther("1000"),
        treasuryNPercent: 2000n,
        treasuryReserveAmount: ethers.parseUnits("1000", 6),
        governanceName: buildingName + "Governance",
        vaultShareTokenName: buildingName + "Vault Token",
        vaultShareTokenSymbol: "v" + buildingSymbol,
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: buildingName + "AutoCompounder Token",
        aTokenSymbol: "a" + buildingSymbol,
    };

    const tx = await buildingFactory.newBuilding(buildingDetails, {
        gasLimit: 15_000_000,
    });
    await tx.wait();

    const buildingList = await buildingFactory.getBuildingList();

    const newlyCreated = buildingList[buildingList.length - 1];

    console.log("New building info:", newlyCreated);
    console.log("New building address:", newlyCreated.addr);

    return newlyCreated.addr;
}

async function configNewBuilding(buildingAddress: string) {
    const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);

    const tx = await buildingFactory.configNewBuilding(buildingAddress, { gasLimit: 15_000_000 });
    await tx.wait();

    console.log(`new building ${buildingAddress} configured at ${tx.hash}`);
}

createBuilding()
    .then(configNewBuilding)
    .catch((err) => {
        console.error(err);
        process.exitCode = 1;
    });
