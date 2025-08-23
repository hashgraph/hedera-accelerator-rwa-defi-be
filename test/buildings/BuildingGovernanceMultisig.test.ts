import { LogDescription } from 'ethers';
import { BuildingGovernance, Safe } from '../../typechain-types';
import { expect, ethers, upgrades } from '../setup';
import { loadFixture, mine } from '@nomicfoundation/hardhat-network-helpers';
import { network } from 'hardhat';

// Import Safe contracts from the package
import SafeProxyFactoryArtifact from '@safe-global/safe-contracts/build/artifacts/contracts/proxies/SafeProxyFactory.sol/SafeProxyFactory.json';
import SafeArtifact from '@safe-global/safe-contracts/build/artifacts/contracts/Safe.sol/Safe.json';
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers';

// Helper function to create multisig signatures for testing using approved hashes
async function createMultisigSignatures(
  safe: Safe,
  to: string,
  value: bigint,
  data: string,
  signers: any[]
) {

  // Get the current nonce from the Safe
  const currentNonce = await safe.nonce();

  // Get the owners of the Safe to ensure we're using valid signers
  const owners = await safe.getOwners();
  
  // Create signatures array with proper formatting
  const signatures: string[] = [];
  
  // Sort signers by address to ensure consistent ordering (Safe requirement)
  const sortedSigners = [...signers].sort((a, b) => a.address.localeCompare(b.address));
  
  for (const signer of sortedSigners) {            

    // Verify that the signer is actually an owner of the Safe
    if (!owners.includes(signer.address)) {
      throw new Error(`Signer ${signer.address} is not an owner of the Safe`);
    }

    // Create EIP-712 typed data for Safe transaction
    const domain = {
      chainId: await network.provider.send('eth_chainId'),
      verifyingContract: await safe.getAddress()
    };

    const types = {
      SafeTx: [
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'data', type: 'bytes' },
        { name: 'operation', type: 'uint8' },
        { name: 'safeTxGas', type: 'uint256' },
        { name: 'baseGas', type: 'uint256' },
        { name: 'gasPrice', type: 'uint256' },
        { name: 'gasToken', type: 'address' },
        { name: 'refundReceiver', type: 'address' },
        { name: 'nonce', type: 'uint256' }
      ]
    };

    const message = {
      to: to,
      value: value.toString(),
      data: data,
      operation: 0,
      safeTxGas: 0,
      baseGas: 0,
      gasPrice: 0,
      gasToken: ethers.ZeroAddress,
      refundReceiver: ethers.ZeroAddress,
      nonce: currentNonce.toString()
    };

    // Sign the typed data
    const signature = await signer.signTypedData(domain, types, message);
  
    signatures.push(signature);
  }

  return ethers.concat(signatures);
}

/**
 * Creates a Safe wallet using the proper Safe Global deployment pattern.
 * 
 * This function follows the correct Safe deployment approach:
 * 1. Deploy the Safe singleton (implementation contract)
 * 2. Deploy the SafeProxyFactory
 * 3. Use the factory to create a Safe proxy with the singleton as implementation
 * 4. Initialize the Safe through the proxy using the setup function
 * 
 * @param signers Array of signer objects that will be the owners of the Safe
 * @param threshold Number of required confirmations for Safe transactions
 * @returns Promise<Safe> A Safe contract instance connected to the deployed proxy
 */
async function createSafeWallet(signers: HardhatEthersSigner[], threshold: number): Promise<Safe> {
  // Deploy the Safe singleton (implementation contract)
  const safeSingletonFactory = new ethers.ContractFactory(
    SafeArtifact.abi,
    SafeArtifact.bytecode,
    (await ethers.getSigners())[0]
  );
  const safeSingleton = await safeSingletonFactory.deploy();
  await safeSingleton.waitForDeployment();
  const singletonAddress = await safeSingleton.getAddress();

  // Deploy the SafeProxyFactory
  const safeProxyFactoryFactory = new ethers.ContractFactory(
    SafeProxyFactoryArtifact.abi,
    SafeProxyFactoryArtifact.bytecode,
    (await ethers.getSigners())[0]
  );
  const safeProxyFactory = await safeProxyFactoryFactory.deploy();
  await safeProxyFactory.waitForDeployment();

  // Create the setup data for the Safe
  const setupData = safeSingleton.interface.encodeFunctionData('setup', [
    signers.map((signer) => signer.address),  // address[] calldata _owners,
    threshold,                                // uint256 _threshold,          
    ethers.ZeroAddress,                       // address to,
    ethers.ZeroHash,                          // bytes calldata data,
    ethers.ZeroAddress,                       // address fallbackHandler,
    ethers.ZeroAddress,                       // address paymentToken,
    0,                                        // uint256 payment,
    ethers.ZeroAddress                        // address payable paymentReceiver
  ]);

  // Deploy the Safe proxy using the factory
  const saltNonce = Date.now(); // Use timestamp as salt nonce for uniqueness
  const proxyCreationTx = await (safeProxyFactory as any).createProxyWithNonce(
    singletonAddress,
    setupData,
    saltNonce
  );
  const receipt = await proxyCreationTx.wait();

  // Get the deployed proxy address from the event
  const proxyCreationEvent = receipt?.logs.find(
    (log: any) => log.fragment?.name === 'ProxyCreation'
  );
  
  if (!proxyCreationEvent) {
    throw new Error('ProxyCreation event not found');
  }

  const proxyAddress = proxyCreationEvent.args[0];
  
  // Return the Safe contract instance connected to the proxy
  return (safeSingleton as any).attach(proxyAddress) as Safe;
}

// Helper function to get proposal ID from events
async function getProposalId(governance: BuildingGovernance, blockNumber: number) {
  const logs = await governance.queryFilter(governance.filters.ProposalDefined, blockNumber, blockNumber);
  const decodedEvent = governance.interface.parseLog(logs[0]) as LogDescription;
  return decodedEvent.args[0];
}

async function deployMultisigFixture() {
  const [owner, notOwner, voter1, voter2, voter3, multisigOwner1, multisigOwner2, multisigOwner3] = await ethers.getSigners();

  const buildingGovernanceFactory = await ethers.getContractFactory('BuildingGovernance');
  const buildingGovernanceBeacon = await upgrades.deployBeacon(buildingGovernanceFactory);

  const governanceToken = await ethers.deployContract('ERC20Mock', ['test', 'test', 18]);
  const governanceTokenAddress = await governanceToken.getAddress();
  const governanceName = "Governance";
  const initialOwner = owner.address;

  const identityImplementation = await ethers.deployContract('Identity', [owner.address, true], owner);
  const identityImplementationAuthority = await ethers.deployContract('ImplementationAuthority', [await identityImplementation.getAddress()], owner);
  const identityFactory = await ethers.deployContract('IdFactory', [await identityImplementationAuthority.getAddress()], owner);
  const identityGateway = await ethers.deployContract('IdentityGateway', [await identityFactory.getAddress(), []], owner);
  const identityGatewayAddress = await identityGateway.getAddress();

  // Mint and delegate tokens
  const mintAmount = ethers.parseEther('1000');
  await governanceToken.mint(owner.address, mintAmount);
  await governanceToken.mint(voter1.address, mintAmount);
  await governanceToken.mint(voter2.address, mintAmount);
  await governanceToken.mint(voter3.address, mintAmount);
  await governanceToken.connect(voter1).delegate(voter1.address);
  await governanceToken.connect(voter2).delegate(voter2.address);
  await governanceToken.connect(voter3).delegate(voter3.address);

  const ERC20Mock = await ethers.getContractFactory('ERC20Mock', owner);
  const usdc = await ERC20Mock.deploy('USD Coin', 'USDC', 6n);
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();

  // Create Treasury
  const N_PERCENTAGE = 2000; // 20% to business
  const RESERVE_AMOUNT = ethers.parseUnits('1000', 6);

  const treasuryImplmentation = await ethers.getContractFactory('Treasury');
  const beacon = await upgrades.deployBeacon(treasuryImplmentation);
  await beacon.waitForDeployment();

  const treasuryProxy = await upgrades.deployBeaconProxy(
    beacon,
    treasuryImplmentation,
    [
      usdcAddress,
      RESERVE_AMOUNT,
      N_PERCENTAGE,
      owner.address,
      owner.address,
      owner.address
    ],
    { initializer: 'initialize' }
  );

  await treasuryProxy.waitForDeployment();
  const treasuryAddress = await treasuryProxy.getAddress();
  const treasury = await ethers.getContractAt('Treasury', treasuryAddress);
  await treasury.grantFactoryRole(owner.address);

  // Deploy AuditRegistry
  const AuditRegistry = await ethers.getContractFactory('AuditRegistry');
  const auditRegistry = await AuditRegistry.deploy(owner.address);
  await auditRegistry.waitForDeployment();
  const auditRegistryAddress = await auditRegistry.getAddress();

  const VaultFactory = await ethers.getContractFactory("VaultFactory");
  const vaultFactory = await VaultFactory.deploy(identityGatewayAddress, { from: owner.address });
  await vaultFactory.waitForDeployment();

  // Create Vault
  const vaultDetails = {
    stakingToken: governanceTokenAddress,
    shareTokenName: await governanceToken.name(),
    shareTokenSymbol: await governanceToken.symbol(),
    vaultRewardController: treasuryAddress,
    feeConfigController: initialOwner,
    cliff: 0,
    unlockDuration: 0
  };

  const feeConfig = {
    receiver: ethers.ZeroAddress,
    token: ethers.ZeroAddress,
    feePercentage: 0
  };

  const salt = await vaultFactory.generateSalt(initialOwner, governanceTokenAddress, 0);
  const tx = await vaultFactory.deployVault(salt, vaultDetails, feeConfig);
  await tx.wait();

  const vaultAddress = await vaultFactory.vaultDeployed(salt);
  const vault = await ethers.getContractAt('BasicVault', vaultAddress);
  await treasury.addVault(vaultAddress);

  // Stake tokens to vault
  await governanceToken.approve(vaultAddress, mintAmount);
  await vault.deposit(mintAmount, owner.address);

  // Fund treasury
  const fundingAmount = ethers.parseUnits('10000', 6);
  await usdc.mint(owner.address, fundingAmount);
  await usdc.approve(treasuryAddress, fundingAmount);
  await treasury.deposit(fundingAmount);

  const buildingGovernance = await upgrades.deployBeaconProxy(
    await buildingGovernanceBeacon.getAddress(),
    buildingGovernanceFactory,
    [
      governanceTokenAddress,
      governanceName,
      initialOwner,
      treasuryAddress,
      auditRegistryAddress
    ],
    { initializer: 'initialize' }
  );

  await treasury.grantGovernanceRole(await buildingGovernance.getAddress());
  await auditRegistry.grantGovernanceRole(await buildingGovernance.getAddress());

  const governance = await ethers.getContractAt('BuildingGovernance', await buildingGovernance.getAddress());

  // Deploy Safe Mock contracts with different configurations
  const safe1of1 = await createSafeWallet([multisigOwner1], 1);
  const safe1of2 = await createSafeWallet([multisigOwner1, multisigOwner2], 1);
  const safe2of2 = await createSafeWallet([multisigOwner1, multisigOwner2], 2);
  const safe2of3 = await createSafeWallet([multisigOwner1, multisigOwner2, multisigOwner3], 2);

  // grant governance role to safes
  await treasury.grantGovernanceRole(await safe1of1.getAddress());
  await treasury.grantGovernanceRole(await safe1of2.getAddress());
  await treasury.grantGovernanceRole(await safe2of2.getAddress());
  await treasury.grantGovernanceRole(await safe2of3.getAddress());

  // mint usdc to treasury
  await usdc.mint(await treasury.getAddress(), ethers.parseUnits('10000', 6));

  return {
    owner,
    notOwner,
    voter1,
    voter2,
    voter3,
    multisigOwner1,
    multisigOwner2,
    multisigOwner3,
    governanceToken,
    buildingGovernance,
    buildingGovernanceBeacon,
    buildingGovernanceFactory,
    governance,
    treasury,
    vault,
    usdc,
    auditRegistry,
    safe1of1,
    safe1of2,
    safe2of2,
    safe2of3
  };
}

describe('BuildingGovernance Multisig', () => {
  describe('Configuration', () => {
    it('should set multisig threshold', async () => {
      const { governance, owner } = await loadFixture(deployMultisigFixture);
      
      const newThreshold = ethers.parseUnits('1000', 6); // 1000 USDC
      await expect(governance.connect(owner).setMultisigThreshold(newThreshold))
        .to.emit(governance, 'MultisigThresholdUpdated')
        .withArgs(newThreshold);
      
      expect(await governance.getMultisigThreshold()).to.equal(newThreshold);
    });

    it('should set safe address', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      const safeAddress = await safe1of1.getAddress();
      await expect(governance.connect(owner).setSafeAddress(safeAddress))
        .to.emit(governance, 'SafeAddressUpdated')
        .withArgs(safeAddress);
      
      expect(await governance.getSafeAddress()).to.equal(safeAddress);
    });

    it('should revert when non-owner tries to configure', async () => {
      const { governance, notOwner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      const safeAddress = await safe1of1.getAddress();
      await expect(governance.connect(notOwner).setSafeAddress(safeAddress))
        .to.be.revertedWithCustomError(governance, 'OwnableUnauthorizedAccount');
      
      await expect(governance.connect(notOwner).setMultisigThreshold(1000))
        .to.be.revertedWithCustomError(governance, 'OwnableUnauthorizedAccount');
    });
  });

  describe('Payment Proposal Creation', () => {
    it('should create DAO proposal for amount above threshold', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      // Set up multisig configuration
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6)); // 500 USDC threshold
      
      // Create proposal above threshold
      const amount = ethers.parseUnits('1000', 6); // 1000 USDC
      const to = ethers.Wallet.createRandom();
      const description = "Large payment proposal";
      
      const tx = await governance.createPaymentProposal(amount, to.address, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);
      
      // Should emit ProposalDefined with GovernorVote level
      await expect(tx).to.emit(governance, 'ProposalDefined')
        .withArgs(proposalId, 1, 0, owner.address, to.address, amount); // ProposalType.Payment, ProposalLevel.GovernorVote
    });

    it('should create multisig proposal for amount below threshold', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      // Set up multisig configuration
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6)); // 500 USDC threshold
      
      // Create proposal below threshold
      const amount = ethers.parseUnits('100', 6); // 100 USDC
      const to = ethers.Wallet.createRandom();
      const description = "Small payment proposal";
      
      const tx = await governance.createPaymentProposal(amount, to.address, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);
      
      // Should emit ProposalDefined with MultisigVote level
      await expect(tx).to.emit(governance, 'ProposalDefined')
        .withArgs(proposalId, 1, 1, owner.address, to.address, amount); // ProposalType.Payment, ProposalLevel.MultisigVote
    });

    it('should create DAO proposal when safe address not set', async () => {
      const { governance, owner } = await loadFixture(deployMultisigFixture);
      
      // Don't set safe address
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
      
      // Create proposal below threshold
      const amount = ethers.parseUnits('100', 6); // 100 USDC
      const to = ethers.Wallet.createRandom();
      const description = "Small payment proposal";
      
      const tx = await governance.createPaymentProposal(amount, to.address, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);
      
      // Should still create DAO proposal when safe not configured
      await expect(tx).to.emit(governance, 'ProposalDefined')
        .withArgs(proposalId, 1, 0, owner.address, to.address, amount); // ProposalType.Payment, ProposalLevel.GovernorVote
    });
  });

  describe('Multisig Payment Execution', () => {
    describe('1-of-1 Multisig', () => {
      it('should execute payment with 1-of-1 multisig', async () => {
        const { governance, owner, safe1of1, treasury, usdc, multisigOwner1 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "1-of-1 multisig payment";

        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Verify initial balance
        expect(await usdc.balanceOf(to.address)).to.equal(0);
        
        // Create signature for 1-of-1 multisig
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe1of1,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1]
        );
        
        // Execute multisig proposal
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.emit(governance, 'MultisigProposalExecuted')
          .withArgs(proposalId, await safe1of1.getAddress(), to.address, amount);
        
        // Verify payment was made
        expect(await usdc.balanceOf(to.address)).to.equal(amount);
      });
    });

    describe('1-of-2 Multisig', () => {
      it('should execute payment with 1-of-2 multisig (single signature)', async () => {
        const { governance, owner, safe1of2, treasury, usdc, multisigOwner1 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe1of2.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "1-of-2 multisig payment";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signature for 1-of-2 multisig (only one signature needed)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe1of2,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1]
        );
        
        // Execute multisig proposal
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.emit(governance, 'MultisigProposalExecuted')
          .withArgs(proposalId, await safe1of2.getAddress(), to.address, amount);
        
        // Verify payment was made
        expect(await usdc.balanceOf(to.address)).to.equal(amount);
      });

      it('should execute payment with 1-of-2 multisig (both signatures)', async () => {
        const { governance, owner, safe1of2, treasury, usdc, multisigOwner1, multisigOwner2 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe1of2.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "1-of-2 multisig payment (both signatures)";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signatures for 1-of-2 multisig (both signatures)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe1of2,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1, multisigOwner2]
        );
        
        // Execute multisig proposal
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.emit(governance, 'MultisigProposalExecuted')
          .withArgs(proposalId, await safe1of2.getAddress(), to.address, amount);
        
        // Verify payment was made
        expect(await usdc.balanceOf(to.address)).to.equal(amount);
      });
    });

    describe('2-of-2 Multisig', () => {
      it('should execute payment with 2-of-2 multisig', async () => {
        const { governance, owner, safe2of2, treasury, usdc, multisigOwner1, multisigOwner2 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe2of2.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "2-of-2 multisig payment";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signatures for 2-of-2 multisig (both signatures required)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe2of2,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1, multisigOwner2]
        );
        
        // Execute multisig proposal
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.emit(governance, 'MultisigProposalExecuted')
          .withArgs(proposalId, await safe2of2.getAddress(), to.address, amount);
        
        // Verify payment was made
        expect(await usdc.balanceOf(to.address)).to.equal(amount);
      });

      it('should revert with insufficient signatures for 2-of-2 multisig', async () => {
        const { governance, owner, safe2of2, treasury, multisigOwner1 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe2of2.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "2-of-2 multisig payment (insufficient signatures)";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signature for 2-of-2 multisig (only one signature - insufficient)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe2of2,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1]
        );
        
        // Should revert due to insufficient signatures
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.be.revertedWith("GS020");
      });
    });

    describe('2-of-3 Multisig', () => {
      it('should execute payment with 2-of-3 multisig (2 signatures)', async () => {
        const { governance, owner, safe2of3, treasury, usdc, multisigOwner1, multisigOwner2 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe2of3.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "2-of-3 multisig payment (2 signatures)";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signatures for 2-of-3 multisig (2 signatures required)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe2of3,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1, multisigOwner2]
        );
        
        // Execute multisig proposal
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.emit(governance, 'MultisigProposalExecuted')
          .withArgs(proposalId, await safe2of3.getAddress(), to.address, amount);
        
        // Verify payment was made
        expect(await usdc.balanceOf(to.address)).to.equal(amount);
      });

      it('should execute payment with 2-of-3 multisig (3 signatures)', async () => {
        const { governance, owner, safe2of3, treasury, usdc, multisigOwner1, multisigOwner2, multisigOwner3 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe2of3.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "2-of-3 multisig payment (3 signatures)";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signatures for 2-of-3 multisig (all 3 signatures)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe2of3,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1, multisigOwner2, multisigOwner3]
        );
        
        // Execute multisig proposal
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.emit(governance, 'MultisigProposalExecuted')
          .withArgs(proposalId, await safe2of3.getAddress(), to.address, amount);
        
        // Verify payment was made
        expect(await usdc.balanceOf(to.address)).to.equal(amount);
      });

      it('should revert with insufficient signatures for 2-of-3 multisig', async () => {
        const { governance, owner, safe2of3, treasury, multisigOwner1 } = await loadFixture(deployMultisigFixture);
        
        // Set up multisig configuration
        await governance.connect(owner).setSafeAddress(await safe2of3.getAddress());
        await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
        
        // Create multisig proposal
        const amount = ethers.parseUnits('100', 6);
        const to = ethers.Wallet.createRandom();
        const description = "2-of-3 multisig payment (insufficient signatures)";
        
        const tx = await governance.createPaymentProposal(amount, to.address, description);
        const proposalId = await getProposalId(governance, tx.blockNumber as number);
        
        // Create signature for 2-of-3 multisig (only one signature - insufficient)
        const safeData = treasury.interface.encodeFunctionData("makePayment", [to.address, amount]);
        const signatures = await createMultisigSignatures(
          safe2of3,
          await treasury.getAddress(),
          0n,
          safeData,
          [multisigOwner1]
        );
        
        // Should revert due to insufficient signatures
        await expect(governance.executeMultisigPaymentProposal(proposalId, signatures))
          .to.be.revertedWith("GS020");
      });
    });
  });

  describe('Error Handling', () => {
    it('should revert when executing multisig proposal without safe address', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      // set safe address
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
      
      // Create multisig proposal 
      const amount = ethers.parseUnits('100', 6);
      const to = ethers.Wallet.createRandom();
      const description = "Payment proposal";
      
      const tx = await governance.createPaymentProposal(amount, to.address, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);

      // unset safe address
      await governance.connect(owner).setSafeAddress(ethers.ZeroAddress);
      
      // Try to execute as multisig proposal
      await expect(governance.executeMultisigPaymentProposal(proposalId, "0x"))
        .to.be.revertedWith("BuildingGovernance: safe address not set");
    });

    it('should revert when executing DAO proposal with multisig function', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      // Set up multisig configuration
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
      
      // Create proposal above threshold (will be DAO proposal)
      const amount = ethers.parseUnits('1000', 6);
      const to = ethers.Wallet.createRandom();
      const description = "Large payment proposal";
      
      const tx = await governance.createPaymentProposal(amount, to.address, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);
      
      // Try to execute DAO proposal with multisig function
      await expect(governance.executeMultisigPaymentProposal(proposalId, "0x"))
        .to.be.revertedWith("BuildingGovernance: not a multisig proposal");
    });

    it('should revert when executing multisig proposal with DAO function', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      // Set up multisig configuration
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
      
      // Create proposal below threshold (will be multisig proposal)
      const amount = ethers.parseUnits('100', 6);
      const to = ethers.Wallet.createRandom();
      const description = "Small payment proposal";
      
      const tx = await governance.createPaymentProposal(amount, to.address, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);
      
      // Try to execute multisig proposal with DAO function
      await expect(governance.executePaymentProposal(proposalId))
        .to.be.revertedWith("BuildingGovernance: use executeMultisigPaymentProposal for multisig proposals");
    });

    it('should revert when executing non-existent proposal', async () => {
      const { governance, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      await governance.setSafeAddress(await safe1of1.getAddress());
      
      const nonExistentProposalId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));
      
      await expect(governance.executeMultisigPaymentProposal(nonExistentProposalId, "0x"))
        .to.be.revertedWith("BuildingGovernance: invalid proposal ID");
    });

    it('should revert when executing wrong proposal type', async () => {
      const { governance, owner, safe1of1 } = await loadFixture(deployMultisigFixture);
      
      // Set up multisig configuration
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
      
      // Create text proposal (not payment)
      const description = "Text proposal";
      const tx = await governance.createTextProposal(0, description);
      const proposalId = await getProposalId(governance, tx.blockNumber as number);
      
      // Try to execute text proposal with payment function
      await expect(governance.executeMultisigPaymentProposal(proposalId, "0x"))
        .to.be.revertedWith("BuildingGovernance: invalid proposal type");
    });
  });

  describe('Integration Tests', () => {
    it('should handle mixed DAO and multisig proposals correctly', async () => {
      const { governance, owner, safe1of1, treasury, usdc, multisigOwner1, voter1, voter2, voter3 } = await loadFixture(deployMultisigFixture);
      
      // Set up multisig configuration
      await governance.connect(owner).setSafeAddress(await safe1of1.getAddress());
      await governance.connect(owner).setMultisigThreshold(ethers.parseUnits('500', 6));
      
      // Create both types of proposals
      const smallAmount = ethers.parseUnits('100', 6);
      const largeAmount = ethers.parseUnits('1000', 6);
      const recipient1 = ethers.Wallet.createRandom();
      const recipient2 = ethers.Wallet.createRandom();
      
      // Create multisig proposal (small amount)
      const multisigTx = await governance.createPaymentProposal(smallAmount, recipient1.address, "Small payment");
      const multisigProposalId = await getProposalId(governance, multisigTx.blockNumber as number);
      
      // Create DAO proposal (large amount)
      const daoTx = await governance.createPaymentProposal(largeAmount, recipient2.address, "Large payment");
      const daoProposalId = await getProposalId(governance, daoTx.blockNumber as number);
      
      // Execute multisig proposal
      const safeData = treasury.interface.encodeFunctionData("makePayment", [recipient1.address, smallAmount]);
      const signatures = await createMultisigSignatures(
        safe1of1,
        await treasury.getAddress(),
        0n,
        safeData,
        [multisigOwner1]
      );
      
      await governance.executeMultisigPaymentProposal(multisigProposalId, signatures);
      expect(await usdc.balanceOf(recipient1.address)).to.equal(smallAmount);
      
      // Execute DAO proposal through normal voting process
      const votingDelay = await governance.votingDelay();
      const votingPeriod = await governance.votingPeriod();
      
      await mine(votingDelay);
      await governance.connect(voter1).castVote(daoProposalId, 1);
      await governance.connect(voter2).castVote(daoProposalId, 1);
      await governance.connect(voter3).castVote(daoProposalId, 1);
      await mine(votingPeriod);
      
      await governance.executePaymentProposal(daoProposalId);
      expect(await usdc.balanceOf(recipient2.address)).to.equal(largeAmount);
    });
  });
});
