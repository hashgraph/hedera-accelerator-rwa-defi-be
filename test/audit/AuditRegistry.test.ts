import { expect, ethers } from '../setup';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function getContracts() {
  const provider = ethers.provider;
  const owner = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  const nonAdmin = process.env.PRIVATE_KEY_NON_ADMIN
    ? new ethers.Wallet(process.env.PRIVATE_KEY_NON_ADMIN, provider)
    : null;

  // read contract addresses from file
  const addresses = JSON.parse(fs.readFileSync('contractAddresses.json', 'utf8'));

  const erc721Metadata = await ethers.getContractAt('ERC721Metadata', addresses.ERC721Metadata, owner);
  const auditRegistry = await ethers.getContractAt('AuditRegistry', addresses.AuditRegistry, owner);

  return {
    owner,
    nonAdmin,
    erc721Metadata,
    auditRegistry,
  };
}

describe('AuditRegistry', () => {
  let owner: any;
  let nonAdmin: any;
  let erc721Metadata: any;
  let auditRegistry: any;

  beforeEach(async () => {
    ({ owner, nonAdmin, erc721Metadata, auditRegistry } = await getContracts());
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

      await auditRegistry.connect(owner).addAuditor(owner.address);

      const hasRole = await auditRegistry.hasRole(AUDITOR_ROLE, owner.address);
      expect(hasRole).to.be.true;
    });

    it('should allow the admin to remove an auditor', async () => {
      const AUDITOR_ROLE = await auditRegistry.AUDITOR_ROLE();

      await auditRegistry.connect(owner).addAuditor(owner.address);
      await auditRegistry.connect(owner).removeAuditor(owner.address);

      const hasRole = await auditRegistry.hasRole(AUDITOR_ROLE, owner.address);
      expect(hasRole).to.be.false;
    });
  });  
});