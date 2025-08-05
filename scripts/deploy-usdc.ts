import { ethers } from "hardhat";

async function deploy() {
  const usdc = await ethers.deployContract('USDC', []);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  console.log({ usdcAddress });
}

deploy()
  .catch(console.error)
