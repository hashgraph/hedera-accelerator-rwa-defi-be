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
import {ISafe} from "./interfaces/ISafe.sol";

contract BuildingGovernance is Initializable, GovernorUpgradeable, GovernorCountingSimpleUpgradeable, GovernorVotesUpgradeable, GovernorVotesQuorumFractionUpgradeable, OwnableUpgradeable, UUPSUpgradeable, BuildingGovernanceStorage {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    // keccak256(abi.encode(uint256(keccak256("openzeppelin.storage.Governor")) - 1)) & ~bytes32(uint256(0xff))
    bytes32 private constant GovernorStorageLocation = 0x7c712897014dbe49c045ef1299aa2d5f9e67e48eea4403efa21f1e0f3ac0cb00;

    function _governorStorage() private pure returns (GovernorStorage storage $) {
        assembly {
            $.slot := GovernorStorageLocation
        }
    }

    function initialize(IVotes _token, string memory name, address initialOwner, address treasury, address auditRegistry) public initializer {
        __Governor_init(name);
        __GovernorCountingSimple_init();
        __GovernorVotes_init(_token);
        __GovernorVotesQuorumFraction_init(1);
        __Ownable_init(initialOwner);
        __UUPSUpgradeable_init();

        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        $.treasury = treasury;
        $.auditRegistry = auditRegistry;
        $.multisigThreshold = 500e6; // 500 USDC
    }

    function createTextProposal(ProposalLevel /*level*/, string memory description) public returns(uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
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

        $.proposals[proposalId].exists = true;
        $.proposals[proposalId].proposalType = ProposalType.Text;
        $.proposals[proposalId].descriptionHash = keccak256(bytes(description));

        emit ProposalDefined(proposalId, ProposalType.Text, ProposalLevel.GovernorVote, msg.sender, address(0), 0);
    }

    function createPaymentProposal(uint256 amount, address to, string memory description) public returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        
        // Check if amount is below multisig threshold
        if (amount <= $.multisigThreshold && $.safeAddress != address(0)) {
            // Create multisig proposal
            return _createMultisigPaymentProposal(amount, to, description);
        } else {
            // Create DAO proposal
            return _createDaoPaymentProposal(amount, to, description);
        }
    }

    function _createDaoPaymentProposal(uint256 amount, address to, string memory description) internal returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

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

        $.proposals[proposalId].exists = true;
        $.proposals[proposalId].proposalType = ProposalType.Payment;
        $.proposals[proposalId].to = to;
        $.proposals[proposalId].amount = amount;
        $.proposals[proposalId].descriptionHash = keccak256(bytes(description));
        
        emit ProposalDefined(proposalId, ProposalType.Payment, ProposalLevel.GovernorVote, msg.sender, to, amount);
    }

    function _createMultisigPaymentProposal(uint256 amount, address to, string memory description) internal returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        
        // Generate a unique proposal ID for multisig proposals
        proposalId = uint256(keccak256(abi.encodePacked(
            block.timestamp,
            msg.sender,
            to,
            amount,
            description
        )));

        $.proposals[proposalId].exists = true;
        $.proposals[proposalId].proposalType = ProposalType.Payment;
        $.proposals[proposalId].to = to;
        $.proposals[proposalId].amount = amount;
        $.proposals[proposalId].descriptionHash = keccak256(bytes(description));
        $.proposals[proposalId].isMultisig = true;
        
        emit ProposalDefined(proposalId, ProposalType.Payment, ProposalLevel.MultisigVote, msg.sender, to, amount);
    }

    function createChangeReserveProposal(uint256 amount, string memory description) public returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

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

        $.proposals[proposalId].exists = true;
        $.proposals[proposalId].proposalType = ProposalType.ChangeReserve;
        $.proposals[proposalId].amount = amount;
        $.proposals[proposalId].descriptionHash = keccak256(bytes(description));
        
        emit ProposalDefined(proposalId, ProposalType.ChangeReserve, ProposalLevel.GovernorVote, msg.sender, address(0), amount);
    }

    function createAddAuditorProposal(address auditor, string memory description) public returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        require(auditor != address(0), "BuildingGovernance: Invalid auditor address");

        address[] memory _auditRegistry = new address[](1);
        _auditRegistry[0] = $.auditRegistry;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "addAuditor(address)",
            auditor
        );

        proposalId = propose(_auditRegistry, _values, _calldata, description);

        $.proposals[proposalId].exists = true;
        $.proposals[proposalId].proposalType = ProposalType.AddAuditor;
        $.proposals[proposalId].to = auditor;
        $.proposals[proposalId].descriptionHash = keccak256(bytes(description));
        
        emit ProposalDefined(proposalId, ProposalType.AddAuditor, ProposalLevel.GovernorVote, msg.sender, auditor, 0);
    }

    function createRemoveAuditorProposal(address auditor, string memory description) public returns (uint256 proposalId) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        require(auditor != address(0), "BuildingGovernance: Invalid auditor address");

        address[] memory _auditRegistry = new address[](1);
        _auditRegistry[0] = $.auditRegistry;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "removeAuditor(address)",
            auditor
        );

        proposalId = propose(_auditRegistry, _values, _calldata, description);

        $.proposals[proposalId].exists = true;
        $.proposals[proposalId].proposalType = ProposalType.RemoveAuditor;
        $.proposals[proposalId].to = auditor;
        $.proposals[proposalId].descriptionHash = keccak256(bytes(description));
        
        emit ProposalDefined(proposalId, ProposalType.RemoveAuditor, ProposalLevel.GovernorVote, msg.sender, auditor, 0);
    }

    function executePaymentProposal(uint256 proposalId) external {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

        require($.proposals[proposalId].exists, "BuildingGovernance: invalid proposal ID");
        require($.proposals[proposalId].proposalType == ProposalType.Payment, "BuildingGovernance: invalid proposal type");
        require(!$.proposals[proposalId].isMultisig, "BuildingGovernance: use executeMultisigPaymentProposal for multisig proposals");


        address[] memory _treasury = new address[](1);
        _treasury[0] = $.treasury;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "makePayment(address,uint256)",
            $.proposals[proposalId].to,
            $.proposals[proposalId].amount
        );

        execute(_treasury, _values, _calldata, $.proposals[proposalId].descriptionHash);
    }

    function executeMultisigPaymentProposal(
        uint256 proposalId,
        bytes calldata signatures
    ) external {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

        require($.proposals[proposalId].exists, "BuildingGovernance: invalid proposal ID");
        require($.proposals[proposalId].proposalType == ProposalType.Payment, "BuildingGovernance: invalid proposal type");
        require($.proposals[proposalId].isMultisig, "BuildingGovernance: not a multisig proposal");
        require($.safeAddress != address(0), "BuildingGovernance: safe address not set");

        // Prepare the transaction data for the Safe
        bytes memory safeData = abi.encodeWithSignature(
            "makePayment(address,uint256)",
            $.proposals[proposalId].to,
            $.proposals[proposalId].amount
        );

        // Execute the transaction through the Safe
        bool success = ISafe($.safeAddress).execTransaction(
            $.treasury,           // to
            0,                    // value
            safeData,             // data
            0,                    // operation (0 = call)
            0,                    // safeTxGas (0 = use default)
            0,                    // baseGas (0 = use default)
            0,                    // gasPrice (0 = use default)
            address(0),           // gasToken
            payable(address(0)),  // refundReceiver
            signatures            // signatures
        );

        require(success, "BuildingGovernance: multisig execution failed");
        
        emit MultisigProposalExecuted(proposalId, $.safeAddress, $.proposals[proposalId].to, $.proposals[proposalId].amount);
    }

    function executeTextProposal(uint256 proposalId) external {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

        require($.proposals[proposalId].exists, "BuildingGovernance: invalid proposal ID");
        require($.proposals[proposalId].proposalType == ProposalType.Text , "BuildingGovernance: invalid proposal type");

        address[] memory targets = new address[](1);
        uint256[] memory values = new uint256[](1);
        bytes[] memory calldatas = new bytes[](1);

        targets[0] = address(0);
        values[0] = 0 ether;
        calldatas[0] = new bytes(0x0);

        execute(targets, values, calldatas, $.proposals[proposalId].descriptionHash);
    }

    function executeChangeReserveProposal(uint256 proposalId) external {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

        require($.proposals[proposalId].exists, "BuildingGovernance: invalid proposal ID");
        require($.proposals[proposalId].proposalType == ProposalType.ChangeReserve , "BuildingGovernance: invalid proposal type");

        address[] memory targets = new address[](1);
        targets[0] = $.treasury;

        uint256[] memory values = new uint256[](1);
        values[0] = 0;

        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSignature(
            "setReserveAmount(uint256)",
            $.proposals[proposalId].amount
        );

        execute(targets, values, calldatas, $.proposals[proposalId].descriptionHash);
    }

    function executeAddAuditorProposal(uint256 proposalId) external {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

        require($.proposals[proposalId].exists, "BuildingGovernance: invalid proposal ID");
        require($.proposals[proposalId].proposalType == ProposalType.AddAuditor, "BuildingGovernance: invalid proposal type");

        address[] memory _auditRegistry = new address[](1);
        _auditRegistry[0] = $.auditRegistry;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "addAuditor(address)",
            $.proposals[proposalId].to
        );

        execute(_auditRegistry, _values, _calldata, $.proposals[proposalId].descriptionHash);
    }

    function executeRemoveAuditorProposal(uint256 proposalId) external {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();

        require($.proposals[proposalId].exists, "BuildingGovernance: invalid proposal ID");
        require($.proposals[proposalId].proposalType == ProposalType.RemoveAuditor, "BuildingGovernance: invalid proposal type");

        address[] memory _auditRegistry = new address[](1);
        _auditRegistry[0] = $.auditRegistry;

        uint256[] memory _values = new uint256[](1);
        _values[0] = 0;

        bytes[] memory _calldata = new bytes[](1);
        _calldata[0] = abi.encodeWithSignature(
            "removeAuditor(address)",
            $.proposals[proposalId].to
        );

        execute(_auditRegistry, _values, _calldata, $.proposals[proposalId].descriptionHash);
    }

    function votingDelay() public pure override returns (uint256) {
        return 60; // 60 seconds delay
    }

    function votingPeriod() public pure override returns (uint256) {
        return 3600; // 1 hour voting period
    }

    // Override _propose function to user block.timestamp in order to work on hedera
    function _propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description,
        address proposer
    ) internal override returns (uint256 proposalId) {
        GovernorStorage storage $ = _governorStorage();
        proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));

        if (targets.length != values.length || targets.length != calldatas.length || targets.length == 0) {
            revert GovernorInvalidProposalLength(targets.length, calldatas.length, values.length);
        }
        if ($._proposals[proposalId].voteStart != 0) {
            revert GovernorUnexpectedProposalState(proposalId, state(proposalId), bytes32(0));
        }

        uint256 snapshot = block.timestamp + votingDelay(); 
        uint256 duration = votingPeriod();

        ProposalCore storage proposal = $._proposals[proposalId];
        proposal.proposer = proposer;
        proposal.voteStart = SafeCast.toUint48(snapshot);
        proposal.voteDuration = SafeCast.toUint32(duration);

        emit ProposalCreated(
            proposalId,
            proposer,
            targets,
            values,
            new string[](targets.length),
            calldatas,
            snapshot,
            snapshot + duration,
            description
        );

        // Using a named return variable to avoid stack too deep errors
    }
    
    // using timestamp as clock in order to work on hedera network
    function clock() public view virtual override(GovernorUpgradeable, GovernorVotesUpgradeable) returns (uint48) {
        return uint48(block.timestamp);
    }

    // using mode=timestamp as clock mode in order to work on hedera network
    function CLOCK_MODE() public pure virtual override(GovernorUpgradeable, GovernorVotesUpgradeable) returns (string memory) {
        return "mode=timestamp";
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

    // Configuration functions for multisig setup
    function setMultisigThreshold(uint256 threshold) external onlyOwner {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        $.multisigThreshold = threshold;
        emit MultisigThresholdUpdated(threshold);
    }

    function setSafeAddress(address safeAddress) external onlyOwner {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        $.safeAddress = safeAddress;
        emit SafeAddressUpdated(safeAddress);
    }

    function getMultisigThreshold() external view returns (uint256) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        return $.multisigThreshold;
    }

    function getSafeAddress() external view returns (address) {
        BuildingGovernanceData storage $ = _getBuildingGovernanceStorage();
        return $.safeAddress;
    }
}

