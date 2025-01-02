import { ethers } from 'hardhat';
import fs from 'fs';

async function main() {
  const [deployer] = await ethers.getSigners();

  console.log('Deploying contracts with the account:', deployer.address);

  const ERC721Metadata = await ethers.getContractFactory('ERC721Metadata');
  const erc721Metadata = await ERC721Metadata.deploy('BuildingNFT', 'BLD');
  await erc721Metadata.deploymentTransaction()?.wait();
  const erc721Address = await erc721Metadata.getAddress();
  console.log('ERC721Metadata deployed to:', erc721Address);

  const AuditRegistry = await ethers.getContractFactory('AuditRegistry');
  const auditRegistry = await AuditRegistry.deploy(erc721Address);
  await auditRegistry.deploymentTransaction()?.wait();
  const auditRegistryAddress = await auditRegistry.getAddress();
  console.log('AuditRegistry deployed to:', auditRegistryAddress);

  const data = {
    ERC721Metadata: erc721Address,
    AuditRegistry: auditRegistryAddress,
  };
  fs.writeFileSync('contractAddresses.json', JSON.stringify(data, null, 2));
  console.log('Contract addresses saved to contractAddresses.json');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
