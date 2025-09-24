import { ethers } from "hardhat";
import { promptAddress } from "../building/prompt-address";
import { promptBuilding } from "../building/prompt-building";

// Description: 🏗️ - Transfer ERC3643 building token
async function transferToken() {
    const [deployer] = await ethers.getSigners();

    const to = promptAddress("to");

    const buildingDetails = await promptBuilding();
    const token = await ethers.getContractAt("TokenVotes", buildingDetails.erc3643Token);

    const tx = await token.mint(deployer.address, ethers.parseEther("1000"));
    await tx.wait();

    const tx1 = await token.transfer(to, ethers.parseEther("1000"));
    await tx1.wait();
    console.log({ hash: tx1.hash });
}

transferToken().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
