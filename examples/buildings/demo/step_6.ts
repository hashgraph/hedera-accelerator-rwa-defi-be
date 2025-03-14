import { ethers } from 'hardhat';

async function logProposalState(governanceAddress: string, proposalId: bigint) {
  const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);
  // const token = await ethers.getContractAt('BuildingERC20', await governance.token());
  console.log(
    `\n\n` + 
    `clock: ${await governance.clock()}\n` +
    `voting period: ${await governance.votingPeriod()}\n` +
    `voting delay: ${await governance.votingDelay()}\n` +
    `token: ${await governance.token()}\n` +
    `proposalId: ${proposalId}\n` +
    `proposal threshold: ${await governance.proposalThreshold()}\n` +
    `proposal state: ${await governance.state(proposalId)}\n` +
    `proposal votes: ${await governance.proposalVotes(proposalId)}\n` +
    `proposal snapshot: ${await governance.proposalSnapshot(proposalId)}\n` +
    `proposal deadline: ${await governance.proposalDeadline(proposalId)}\n` +
    `proposal proposer: ${await governance.proposalProposer(proposalId)}\n` +
    `proposal eta: ${await governance.proposalEta(proposalId)}\n\n` 
  );
}

async function executePaymentProposal(governanceAddress: string, description: string, treasury: string) {

  const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);
  
  const descriptionHash = ethers.id(description);

  const targetAbi = [
    "function makePayment(address to, uint256 amount) external"
  ];

  const iface = new ethers.Interface(targetAbi);
  const [to] = await ethers.getSigners();
  const amount = ethers.parseUnits('1', 6);
  const calldata = iface.encodeFunctionData("makePayment", [to.address, amount]);

  const extx = await governance.execute(
    [treasury],
    [0n],
    [calldata],
    descriptionHash,
    { gasLimit: 600000 }
  );

  await extx.wait();

  console.log(`- proposal ${description} executed ${extx.hash}`);
}

async function run () {
  const governance = "GOVERNANCE_ADDRESS";
  const treasury = "c";
  const proposalDescription = "Proposal #2: pay a dolar";
  const proposalId = 0n; // PROPOSAL ID
  
  await executePaymentProposal(governance, proposalDescription, treasury);
  await logProposalState(governance, proposalId);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
