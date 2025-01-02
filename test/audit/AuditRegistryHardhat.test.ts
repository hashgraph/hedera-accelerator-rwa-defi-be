import { expect, ethers } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

async function deployFixture() {
  const [owner, auditor1, auditor2] = await ethers.getSigners();

  const ERC721Metadata = await ethers.getContractFactory('ERC721Metadata', owner);
  const erc721Metadata = await ERC721Metadata.deploy('BuildingNFT', 'BLD');
  await erc721Metadata.waitForDeployment();

  const AuditRegistry = await ethers.getContractFactory('AuditRegistry', owner);
  const auditRegistry = await AuditRegistry.deploy(await erc721Metadata.getAddress());
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
  describe('Deployment', () => {
    it('should deploy contracts successfully', async () => {
      const { erc721Metadata, auditRegistry } = await loadFixture(deployFixture);

      expect(await erc721Metadata.getAddress()).to.be.a('string');
      expect(await auditRegistry.getAddress()).to.be.a('string');
    });
  });

  describe('Auditor Management', () => {
    it('should allow the admin to add an auditor', async () => {
      const { auditRegistry, auditor1, owner } = await loadFixture(deployFixture);

      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();

      await auditRegistry.connect(owner).addAuditor(await auditor1.getAddress());

      const hasRole = await auditRegistry.hasRole(AUDITOR_ROLE, await auditor1.getAddress());
      expect(hasRole).to.be.true;
    });

    it('should not allow non-admin to add an auditor', async () => {
      const { auditRegistry, auditor1, auditor2 } = await loadFixture(deployFixture);
    
      const DEFAULT_ADMIN_ROLE = await auditRegistry.DEFAULT_ADMIN_ROLE();
    
      await expect(
        auditRegistry.connect(auditor1).addAuditor(await auditor2.getAddress())
      ).to.be.revertedWithCustomError(auditRegistry, 'AccessControlUnauthorizedAccount').withArgs(
        await auditor1.getAddress(),
        DEFAULT_ADMIN_ROLE
      );
    });

  describe('Basic Audit Record', () => {
    it('should allow an authorized auditor to add an audit record', async () => {
      const { auditRegistry, erc721Metadata, owner, auditor1 } = await loadFixture(deployFixture);

      // mint building NFT
      await erc721Metadata.connect(owner)['mint(address,string)'](await owner.getAddress(), 'ipfs://building1');

      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();
      await auditRegistry.connect(owner).addAuditor(await auditor1.getAddress());

      // add audit record
      await expect(auditRegistry.connect(auditor1).addAuditRecord(0, 'ipfs://audit1'))
        .to.emit(auditRegistry, 'AuditRecordAdded')
        .withArgs(
          1, // audit recordId
          0, // buildingId
          await auditor1.getAddress(),
          'ipfs://audit1',
          anyValue // timestamp
        );

      const auditRecord = await auditRegistry.auditRecords(1);
      expect(auditRecord.buildingId).to.equal(0);
      expect(auditRecord.ipfsHash).to.equal('ipfs://audit1');
      expect(auditRecord.revoked).to.be.false;
    });
  });
  });
});