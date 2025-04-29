import { ethers } from 'hardhat';
import { LogDescription } from 'ethers';
import { BuildingGovernance } from '../../../typechain-types';
import * as deployments from "../../../data/deployments/chain-296.json";

async function getProposalId(buildingFactory: BuildingGovernance, blockNumber: number) {
  // Decode the event using queryFilter
  const logs = await buildingFactory.queryFilter(buildingFactory.filters.ProposalDefined, blockNumber, blockNumber);

  // Decode the log using the contract's interface  
  const decodedEvent = buildingFactory.interface.parseLog(logs[0]) as LogDescription; // Get the first log

  // Extract and verify the emitted address  
  return decodedEvent.args[0]; 
}

async function createPaymentProposal(governanceAddress: string, description: string, amount: bigint): Promise<bigint> {
  const [voter1] = await ethers.getSigners();
  const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);

  const to = voter1.address;

  const proposaltx = await governance.createPaymentProposal(amount, to, description, { gasLimit: 820000 });
  await proposaltx.wait();
  const proposalId = await getProposalId(governance, proposaltx.blockNumber as number) // ProposalCreated

  console.log('- created payment proposal', proposalId);

  return proposalId;
}

async function castVotes(governanceAddress: string, proposalId: bigint): Promise<void> {
  const [voter1, voter2, voter3] = await ethers.getSigners();

  const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);

  const g = await governance.connect(voter1).castVote(proposalId, 1, { gasLimit: 6000000 }); // "for" vote.
  const h = await governance.connect(voter2).castVote(proposalId, 1, { gasLimit: 6000000 }); // "for" vote.
  const i = await governance.connect(voter3).castVote(proposalId, 1, { gasLimit: 6000000 }); // "for" vote.

  await g.wait();
  await h.wait();
  await i.wait();

  console.log('- votes casted');
}

async function logProposalState(governanceAddress: string, proposalId: bigint) {
  const governance = await ethers.getContractAt('BuildingGovernance', governanceAddress);
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
async function run () {
  const governance = "GOVERNANCE_ADDRESS";
  
  const proposalDescription = "Proposal #1: pay a dolar";
  const amounr = ethers.parseUnits('1', 6);
  const proposalId = await createPaymentProposal(governance, proposalDescription, amounr);

  await logProposalState(governance, proposalId);

  await new Promise((r) => { setTimeout(() => {r(true)}, 60000)})
  console.log('- waited 60 sec');

  await castVotes(governance, proposalId);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
