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

async function executePaymentProposal(governanceAddress: string, proposalId: bigint) {

  const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);
  
  const extx = await governance.executePaymentProposal(proposalId, { gasLimit: 600000 });
  await extx.wait();

  console.log(`- proposal executed ${extx.hash}`);
}

async function run () {
  const governance = "GOVERNANCE_ADDRESS"; // replace with the governance address
  const proposalId = 0n; // replace with the proposal ID
  
  await executePaymentProposal(governance, proposalId);
  await logProposalState(governance, proposalId);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
