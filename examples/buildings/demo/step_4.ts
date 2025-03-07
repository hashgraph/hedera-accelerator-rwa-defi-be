import { ethers } from 'hardhat';

async function mintUsdc(usdcAddress: string, amount: bigint) {
  const [owner] = await ethers.getSigners();
  const usdc = await ethers.getContractAt('ERC20Mock', usdcAddress);
  const minttx = await usdc.mint(owner.address, amount);
  await minttx.wait();
  
  console.log(`- minted usdc`);
}

async function fundTreasury(treasuryAddress: string, usdcAddress: string, amount: bigint) {
  const treasury = await ethers.getContractAt('Treasury', treasuryAddress);
  const usdc = await ethers.getContractAt('ERC20Mock', usdcAddress);
  
  const apprtx = await usdc.approve(treasuryAddress, amount);
  await apprtx.wait();

  console.log('- approved usdc to treasury');

  const fundtx = await treasury.deposit(amount, { gasLimit: 600000 });
  await fundtx.wait();

  console.log(`- funded treasury`);
}

async function run () {
  const treasuryAddress = "0xBc1Ef9A1c872D531255e654D3F62Ef602456bAcA";
  const treasury = await ethers.getContractAt('Treasury', treasuryAddress);
  
  const usdc = await treasury.usdc();
  const amount = ethers.parseUnits('1', 6) // mint 1 usdc

  await mintUsdc(usdc, amount);
  await fundTreasury(treasuryAddress, usdc, amount);  // send 1 dolar to treasury;
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
