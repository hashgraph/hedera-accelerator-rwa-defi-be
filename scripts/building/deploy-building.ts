import { ethers } from "hardhat";
import Deployments from "../../data/deployments/chain-296.json";
import { usdcAddress } from "../../constants";

// Description: 🏢 - Deploy a new building
async function createBuilding(): Promise<string> {
    const [owner] = await ethers.getSigners();

    const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);

    const buildingDetails = {
        tokenURI: "ipfs://bafkreidmn4ozne5okre4wpdjarywmiqgtayamg5r3ceq7sq5ez3m5sfpcq",
        tokenName: "Dubai Complex 0222",
        tokenSymbol: "DUB0122",
        tokenDecimals: 18n,
        tokenMintAmount: ethers.parseEther("1000"),
        treasuryNPercent: 2000n,
        treasuryReserveAmount: ethers.parseUnits("1000", 6),
        governanceName: "Dubai Governance 22",
        vaultShareTokenName: "Dubai Vault Token 22",
        vaultShareTokenSymbol: "vDUB02",
        vaultFeeReceiver: owner,
        vaultFeeToken: usdcAddress,
        vaultFeePercentage: 2000,
        vaultCliff: 0n,
        vaultUnlockDuration: 0n,
        aTokenName: "Dubait AutoCompounder Token 222",
        aTokenSymbol: "aDUB02",
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
