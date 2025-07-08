// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract BuildingFactoryStorage {
    /// @custom:storage-location erc7201:hashgraph.buildings.BuildingFactory
    struct BuildingFactoryStorageData {
        address nft;
        address uniswapRouter;
        address uniswapFactory;
        address buildingBeacon;
        address onchainIdGateway;
        address trexGateway;
        address treasuryBeacon;
        address usdc;
        address governanceBeacon;
        address[] registryAgents;
        address[] tokenAgents;
        BuildingDetails[] buildingsList;
        mapping (address => BuildingDetails) buildingDetails;
    }

    struct BuildingDetails {
        address addr; // building address
        uint256 nftId; // NFT token ID attributed to the building
        string tokenURI; // NFT metadatada location
        address auditRegistry; // building's OnchainID identity address
        address erc3643Token; // TRex token
        address treasury;
        address governance;
        address vault;
        address autoCompounder;
    }

    struct NewBuildingDetails {
        string tokenURI;
        string tokenName;
        string tokenSymbol;
        uint8 tokenDecimals;
        uint256 tokenMintAmount;
        uint256 treasuryReserveAmount;
        uint256 treasuryNPercent;
        string governanceName;
        string vaultShareTokenName;
        string vaultShareTokenSymbol;
        address vaultFeeReceiver;
        address vaultFeeToken;
        uint256 vaultFeePercentage;
        uint32 vaultCliff;
        uint32 vaultUnlockDuration;
        string aTokenName;
        string aTokenSymbol;
    }

    //keccak256(abi.encode(uint256(keccak256("hashgraph.buildings.BuildingFactory")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant BuildingFactoryStorageLocation = 0x0f40dde8b99b0722537b774c6ef775b5e5a0af035d95bf9802cd87411f806f00;

    function _getBuildingFactoryStorage() internal pure returns (BuildingFactoryStorageData storage $) {
        assembly {
            $.slot := BuildingFactoryStorageLocation
        }
    }

    event NewBuilding(address buildingAddress, address erc3643Token, address treasury, address vault, address governance, address initialOwner, address autoCompounder);
    event IdentityRegistered(address building, address wallet, address identity, uint16 country);
    event ComplianceModuleAdded(address building, address module);
    event RegistryAgentsAdded(address[] agents);
    event RegistryAgentRemoved(address agent);
}
