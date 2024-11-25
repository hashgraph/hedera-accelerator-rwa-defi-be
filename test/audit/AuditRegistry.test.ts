import { expect, ethers } from '../setup';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import * as dotenv from 'dotenv';

dotenv.config();

async function deployContracts() {
  const provider = ethers.provider;

  const owner = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const auditor1 = owner;
  const auditor2 = owner;

  const ERC721Metadata = await ethers.getContractFactory('ERC721Metadata', owner);
  const erc721Metadata = await ERC721Metadata.deploy('BuildingNFT', 'BLD');
  await erc721Metadata.waitForDeployment();

  const erc721Address = await erc721Metadata.getAddress();

  const AuditRegistry = await ethers.getContractFactory('AuditRegistry', owner);
  const auditRegistry = await AuditRegistry.deploy(erc721Address);
  await auditRegistry.waitForDeployment();

  return {
    owner,
    auditor1,
    auditor2,
    erc721Metadata,
    auditRegistry,
  };
}

describe('AuditRegistry', () => {
  let owner: any;
  let auditor1: any;
  let auditor2: any;
  let erc721Metadata: any;
  let auditRegistry: any;

  beforeEach(async () => {
    ({ owner, auditor1, auditor2, erc721Metadata, auditRegistry } = await deployContracts());
  });

  describe('Deployment', () => {
    it('should deploy contracts successfully', async () => {
      const erc721Address = await erc721Metadata.getAddress();
      const auditRegistryAddress = await auditRegistry.getAddress();

      expect(erc721Address).to.be.a('string');
      expect(auditRegistryAddress).to.be.a('string');
    });
  });

  describe('Auditor Management', () => {
    it('should allow the admin to add an auditor', async () => {
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();

      await auditRegistry.connect(owner).addAuditor(auditor1.address);

      const hasRole = await auditRegistry.hasRole(AUDITOR_ROLE, auditor1.address);
      expect(hasRole).to.be.true;
    });
  });

  describe('Basic Audit Record', () => {
    it('should allow an authorized auditor to add an audit record', async () => {
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();

      await auditRegistry.connect(owner).addAuditor(owner.address);
      await erc721Metadata.connect(owner)['mint(address,string)'](owner.address, 'ipfs://building1');

      await expect(auditRegistry.connect(owner).addAuditRecord(1, 'ipfs://audit1'))
        .to.emit(auditRegistry, 'AuditRecordAdded')
        .withArgs(
          1, // auditRecordId
          1, // buildingId
          owner.address,
          'ipfs://audit1',
          anyValue // timestamp
        );

      const auditRecord = await auditRegistry.auditRecords(1);
      expect(auditRecord.buildingId).to.equal(1);
      expect(auditRecord.ipfsHash).to.equal('ipfs://audit1');
      expect(auditRecord.revoked).to.be.false;
    });

  });
});
