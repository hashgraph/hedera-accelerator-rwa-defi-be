import { expect, ethers } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

async function deployFixture() {
  const [owner, auditor1, auditor2] = await ethers.getSigners();
  const AuditRegistry = await ethers.getContractFactory('AuditRegistry', owner);
  const auditRegistry = await AuditRegistry.deploy();
  await auditRegistry.waitForDeployment();

  return {
    owner,
    auditor1,
    auditor2,
    auditRegistry,
  };
}

describe('AuditRegistry', () => {
  describe('Deployment', () => {
    it('should deploy contract successfully', async () => {
      const { auditRegistry } = await loadFixture(deployFixture);
      expect(await auditRegistry.getAddress()).to.be.a('string');
    });
  });

  describe('Auditor Management', () => {
    it('should allow the admin to add an auditor', async () => {
      const { auditRegistry, auditor1, owner } = await loadFixture(deployFixture);
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();
      await auditRegistry.connect(owner).grantRole(await auditRegistry.AUDITOR_ROLE(), await auditor1.getAddress());
      const hasRole = await auditRegistry.hasRole(AUDITOR_ROLE, await auditor1.getAddress());
      expect(hasRole).to.be.true;
    });

    it('should not allow non-admin to add an auditor', async () => {
      const { auditRegistry, auditor1, auditor2 } = await loadFixture(deployFixture);
      const DEFAULT_ADMIN_ROLE = await auditRegistry.DEFAULT_ADMIN_ROLE();
      await expect(
        auditRegistry.connect(auditor1).grantRole(await auditRegistry.AUDITOR_ROLE(), await auditor2.getAddress())
      ).to.be.revertedWithCustomError(auditRegistry, 'AccessControlUnauthorizedAccount').withArgs(
        await auditor1.getAddress(),
        DEFAULT_ADMIN_ROLE
      );
    });
  });

  describe('Basic Audit Record', () => {
    it('should allow an authorized auditor to add an audit record for an address', async () => {
      const { auditRegistry, owner, auditor1 } = await loadFixture(deployFixture);
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();
      await auditRegistry.connect(owner).grantRole(await auditRegistry.AUDITOR_ROLE(), await auditor1.getAddress());
      const buildingAddr = await owner.getAddress();
      await expect(auditRegistry.connect(auditor1).addAuditRecord(buildingAddr, 'ipfs://audit1'))
        .to.emit(auditRegistry, 'AuditRecordAdded')
        .withArgs(
          1,
          buildingAddr,
          await auditor1.getAddress(),
          'ipfs://audit1',
          anyValue
        );
      const record = await auditRegistry.auditRecords(1);
      expect(record.building).to.equal(buildingAddr);
      expect(record.ipfsHash).to.equal('ipfs://audit1');
      expect(record.revoked).to.be.false;
    });

    it.only('should revert in case of duplicate ipfs hash', async () => {
      const { auditRegistry, owner, auditor1 } = await loadFixture(deployFixture);
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();
      await auditRegistry.connect(owner).grantRole(await auditRegistry.AUDITOR_ROLE(), await auditor1.getAddress());
      const buildingAddr = await owner.getAddress();
      await expect(auditRegistry.connect(auditor1).addAuditRecord(buildingAddr, 'ipfs://audit1'))
        .to.emit(auditRegistry, 'AuditRecordAdded')
        .withArgs(
          1,
          buildingAddr,
          await auditor1.getAddress(),
          'ipfs://audit1',
          anyValue
        );
      const record = await auditRegistry.auditRecords(1);
      expect(record.building).to.equal(buildingAddr);
      expect(record.ipfsHash).to.equal('ipfs://audit1');
      expect(record.revoked).to.be.false;

      await expect(auditRegistry.connect(auditor1).addAuditRecord(buildingAddr, 'ipfs://audit1'))
        .to.be.revertedWithCustomError(auditRegistry, 'DuplicateIpfsHash');
    });

    it.only('should revert in case of duplicate ipfs hash during record update', async () => {
      const { auditRegistry, owner, auditor1 } = await loadFixture(deployFixture);
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();
      await auditRegistry.connect(owner).grantRole(await auditRegistry.AUDITOR_ROLE(), await auditor1.getAddress());
      const buildingAddr = await owner.getAddress();
      await expect(auditRegistry.connect(auditor1).addAuditRecord(buildingAddr, 'ipfs://audit1'))
        .to.emit(auditRegistry, 'AuditRecordAdded')
        .withArgs(
          1,
          buildingAddr,
          await auditor1.getAddress(),
          'ipfs://audit1',
          anyValue
        );
      const record = await auditRegistry.auditRecords(1);
      expect(record.building).to.equal(buildingAddr);
      expect(record.ipfsHash).to.equal('ipfs://audit1');
      expect(record.revoked).to.be.false;

      await expect(auditRegistry.connect(auditor1).updateAuditRecord(1, 'ipfs://audit1'))
        .to.be.revertedWithCustomError(auditRegistry, 'DuplicateIpfsHash');
    });
  });
});
