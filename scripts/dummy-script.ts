import { ethers } from 'hardhat';

// Helper function to add a delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function main() {
  console.log("Getting the deployer...");
  const [deployer] = await ethers.getSigners();

  // --- 1. DEPLOY THE CONTRACT ---
  console.log("\nDeploying the 'Dummy' contract...");
  const contractFactory = await ethers.getContractFactory('Dummy', deployer);
  const contract = await contractFactory.deploy();
  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`✅ Contract deployed to: ${contractAddress}`);
  
  // Wait for the mirror node to sync
  console.log("\nWaiting for mirror node sync...");
  await sleep(5000);

  // --- 2. CALL getCount() TO CHECK INITIAL STATE ---
  console.log("Checking initial state with getCount()...");
  const initialCount = await contract.getCount();
  console.log(`Initial count is: ${initialCount.toString()}`);

  // --- 3. CALL A STATE-CHANGING FUNCTION ---
  console.log("\nCalling the 'increment()' function...");
  const incrementTx = await contract.increment();
  await incrementTx.wait(); // Wait for the transaction to be mined
  console.log("'increment()' transaction successful.");
  
  // --- 4. CALL getCount() AGAIN TO VERIFY THE CHANGE ---
  console.log("\nVerifying final state with getCount()...");
  const finalCount = await contract.getCount();
  console.log(`✅ Final count is: ${finalCount.toString()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });