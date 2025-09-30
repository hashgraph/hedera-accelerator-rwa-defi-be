import { ethers } from "hardhat";

// Description: 🔍 - Deploy UpKeeper
async function deploy() {
    const keepr = await ethers.deployContract("UpKeeper", []);
    await keepr.waitForDeployment();
    const keeprAddress = await keepr.getAddress();

    console.log({ keeprAddress });
}

deploy().catch(console.error);
