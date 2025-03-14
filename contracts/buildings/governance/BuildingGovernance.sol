// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.22;

import {GovernorUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/GovernorUpgradeable.sol";
import {GovernorCountingSimpleUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorCountingSimpleUpgradeable.sol";
import {GovernorVotesUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesUpgradeable.sol";
import {GovernorVotesQuorumFractionUpgradeable} from "@openzeppelin/contracts-upgradeable/governance/extensions/GovernorVotesQuorumFractionUpgradeable.sol";
import {IVotes} from "@openzeppelin/contracts/governance/utils/IVotes.sol";
import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {BuildingGovernanceStorage} from "./BuildingGovernanceStorage.sol";

contract BuildingGovernance is Initializable, GovernorUpgradeable, GovernorCountingSimpleUpgradeable, GovernorVotesUpgradeable, GovernorVotesQuorumFractionUpgradeable, OwnableUpgradeable, UUPSUpgradeable, BuildingGovernanceStorage {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(IVotes _token, string memory name, address initialOwner, address treasury) public initializer {
        __Governor_init(name);
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(1);
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();

        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        $.treasury = treasury;
    }

    function createTextProposal(ProposalLevel level, string memory description) public returns(uint256 proposalId) {
        // TODO: decide between multisig vote proposal or governor proposal giving the level
        // Multisig
        // GovernorVote
        
        // Empty arrays mean no executable actions are attached.
        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        targets[0] = address(0);
        values[0] = 0 ether;
        calldatas[0] = new bytes(0x0);

        proposalId = propose(targets, values, calldatas, description);

        emit ProposalCreated(ProposalType.Text, proposalId, msg.sender);
    }

    function createPaymentProposal(uint256 amount, address to, string memory description) public returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        // keep track of payments made in a month
        // decide between multisig vote proposal or governor proposal 

        address[] memory _treasury = new address[](1);
        _treasury[0] = $.treasury;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "makePayment(address,uint256)",
            to,
            amount
        );

        proposalId = propose(_treasury, _values, _calldata, description);
        
        emit ProposalCreated(ProposalType.Payment, proposalId, msg.sender);
    }

    function createChangeReserveProposal(uint256 amount, string memory description) public returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        // keep track of payments made in a month
        // decide between multisig vote proposal or governor proposal 

        address[] memory _treasury = new address[](1);
        _treasury[0] = $.treasury;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "setReserveAmount(uint256)",
            amount
        );

        proposalId = propose(_treasury, _values, _calldata, description);
        
        emit ProposalCreated(ProposalType.Payment, proposalId, msg.sender);
    }

    function votingDelay() public pure override returns (uint256) {
        return 0; // 0 minutes
    }

    function votingPeriod() public pure override returns (uint256) {
        return 150; // 30 minutes
    }

     // Override clock() to return block.number
    function clock() public view override(GovernorUpgradeable, GovernorVotesUpgradeable) returns (uint48) {
        return SafeCast.toUint48(block.number);
    }
    

    function _authorizeUpgrade(address newImplementation)
        internal
        override
        onlyOwner
    {}

    // The following functions are overrides required by Solidity.

    function quorum(uint256 blockNumber)
        public
        view
        override(GovernorUpgradeable, GovernorVotesQuorumFractionUpgradeable)
        returns (uint256)
    {
        return super.quorum(blockNumber);
    }
}

