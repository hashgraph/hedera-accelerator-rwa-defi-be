import { ethers } from 'hardhat';
import Deployments from  '../../data/deployments/chain-296.json';
import * as ERC721MetadataABI from '../../data/abis/ERC721Metadata.json';

async function handleOnchainMetadata() {
  const [owner] = await ethers.getSigners();

  //BuildingFactoru
  const buildingFactory = await ethers.getContractAt("BuildingFactory", Deployments.factories.BuildingFactory);
  const buildingAddress = "0x0f8CEC1b612c3827084C65dE7Bd5A6F4B47BE93d";
  
  // NFT collection
  const ERC721MetadataIface = new ethers.Interface(ERC721MetadataABI.abi);
  const ERC721MetadataAddress = Deployments.implementations.ERC721Metadata; 
  const ERC721Metadata = await ethers.getContractAt("ERC721Metadata", ERC721MetadataAddress);
  const [_addr, NFT_ID] = await buildingFactory.getBuildingDetails(buildingAddress);
  
  // Building 

  // encode function call to set metadata
  const encodedMetadataFunctionData = ERC721MetadataIface.encodeFunctionData(
    "setMetadata(uint256,string[],string[])", // function selector
    [ // function parameters
      NFT_ID, 
      ["size", "type", "color", "city"],  // keys
      ["8", "mp4", "blue", "denver"] // values
    ]
  );

  // execute the callFromBuilding function passing a valid building address, the nft collection address and the encoded function call
  const tx = await buildingFactory.connect(owner).callFromBuilding(
    buildingAddress, 
    ERC721MetadataAddress, // execute call on ERC721Metadata contract calling from building
    encodedMetadataFunctionData,
    {
      gasLimit: 600000
    }
  );
  await tx.wait();

  // Query Metadata directly from the NFT collection 
  const metadata = await ERC721Metadata["getMetadata(uint256)"](NFT_ID);
  
  console.log({metadata});
} 

handleOnchainMetadata()
  .catch(console.error);
