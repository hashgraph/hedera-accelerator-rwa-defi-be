import { ethers } from 'hardhat';

async function mintUsdc(usdcAddress: string, amount: bigint) {
  const [owner] = await ethers.getSigners();
  const usdc = await ethers.getContractAt('ERC20Mock', usdcAddress);
  const minttx = await usdc.mint(owner.address, amount);
  await minttx.wait();
  
  console.log(`- minted usdc`);
}

async function fundTreasury(treasuryAddress: string, usdcAddress: string, amount: bigint) {
  const [owner] = await ethers.getSigners();
  const treasury = await ethers.getContractAt('Treasury', treasuryAddress);
  const usdc = await ethers.getContractAt('ERC20Mock', usdcAddress);
  
  const apprtx = await usdc.approve(treasuryAddress, amount);
  await apprtx.wait();

  console.log('- approved usdc to treasury');

  // stake token to vault
  const token = await ethers.getContractAt('BuildingERC20', "0x10Ed6a785d59aDc8099F2eDBB78a6B1239F284eb");
  const vaultAddress = await treasury.vault();
  const vault = await ethers.getContractAt('BasicVault', vaultAddress);
  const stakeAmount = ethers.parseEther('1');
  
  await token.approve(vaultAddress, stakeAmount);
  const stake =  await vault.deposit(stakeAmount, owner.address, { gasLimit: 820000 });
  await stake.wait();

  console.log('- staked token to vault');

  const fundtx = await treasury.deposit(amount, { gasLimit: 600000 });
  await fundtx.wait();

  console.log(`- funded treasury`);
}

async function run () {
  const treasuryAddress = "GOVERNANCE_ADDRESS";
  const treasury = await ethers.getContractAt('Treasury', treasuryAddress);
  
  const usdc = await treasury.usdc();
  const amount = ethers.parseUnits('20000', 6) // mint 1 usdc

  await mintUsdc(usdc, amount);
  await fundTreasury(treasuryAddress, usdc, amount);  // send 1 dolar to treasury;
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
