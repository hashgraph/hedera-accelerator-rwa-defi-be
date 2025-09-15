// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

abstract contract BuildingGovernanceStorage {
    /// @custom:storage-location erc7201:hashgraph.buildings.BuildingGovernance
    struct BuildingGovernanceData {
        address treasury;
        address auditRegistry;
        address safeAddress;           // Gnosis Safe address for multisig
        uint256 multisigThreshold;     // Amount threshold for multisig vs DAO
        mapping (uint256 => ProposalData) proposals;
    }

    struct ProposalData {
        bool exists;
        ProposalType proposalType;
        address to;
        uint256 amount;
        bytes32 descriptionHash;
        bool isMultisig;              // Flag to distinguish multisig from DAO proposals
    }

    //keccak256(abi.encode(uint256(keccak256("hashgraph.buildings.BuildingGovernance")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant BuildingGovernanceStorageLocation = 0x72a4ccd47996c0aa9e54efd606e03b13bee57794bd0974b6dda8fcd457f37700;

    function _getBuildingGovernanceStorage() internal pure returns (BuildingGovernanceData storage $) {
        assembly {
            $.slot := BuildingGovernanceStorageLocation
        }
    }    
    
    enum ProposalLevel { GovernorVote, MultisigVote }
    enum ProposalType { Text, Payment, ChangeReserve, AddAuditor, RemoveAuditor }
    
    event ProposalDefined(uint256 id, ProposalType proposalType, ProposalLevel level, address proposer, address receiver, uint256 amount);
    event MultisigProposalExecuted(uint256 id, address safeAddress, address receiver, uint256 amount);
    event MultisigThresholdUpdated(uint256 threshold);
    event SafeAddressUpdated(address safeAddress);
}
