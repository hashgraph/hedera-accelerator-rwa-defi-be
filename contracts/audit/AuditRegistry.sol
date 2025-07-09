// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title AuditRegistry
 * @author Hashgraph
 *
 * @notice This contract manages audit records for building addresses.
 */
contract AuditRegistry is AccessControl {
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    struct AuditRecord {
        address building; // EVM address of the building
        address auditor; // Address of the auditor
        uint64 timestamp; // Timestamp when the audit was added
        bool revoked; // Status of the audit record (true if revoked)
        string ipfsHash; // IPFS hash of the audit document
    }

    // Each new record is assigned an incremental ID (1, 2, 3, etc.)
    uint256 public auditRecordCounter;

    // recordId => AuditRecord
    mapping(uint256 => AuditRecord) public auditRecords;

    // buildingAddress => array of record IDs
    mapping(address => uint256[]) public buildingAuditRecords;

    // Events
    /**
     * @notice AuditRecordAdded event.
     * @dev Emitted when an auditor adds new audit record.
     *
     * @param recordId The record ID.
     * @param building The address of related building contract.
     * @param auditor The address of auditor.
     * @param ipfsHash The related IPFS hash.
     * @param timestamp The timestamp mark.
     */
    event AuditRecordAdded(
        uint256 indexed recordId,
        address indexed building,
        address indexed auditor,
        string ipfsHash,
        uint256 timestamp
    );
    /**
     * @notice AuditRecordUpdated event.
     * @dev Emitted when an auditor updates existing audit record.
     *
     * @param recordId The record ID.
     * @param newIpfsHash The new IPFS hash.
     * @param timestamp The timestamp mark.
     */
    event AuditRecordUpdated(uint256 indexed recordId, string newIpfsHash, uint256 timestamp);
    /**
     * @notice AuditRecordRevoked event.
     * @dev Emitted when an auditor revokes audit record.
     *
     * @param recordId The record ID.
     * @param timestamp The timestamp mark.
     */
    event AuditRecordRevoked(uint256 indexed recordId, uint256 timestamp);
    /**
     * @notice AuditorAdded event.
     * @dev Emitted when the admin grants role to new auditor.
     *
     * @param auditor The added auditor.
     */
    event AuditorAdded(address indexed auditor);
    /**
     * @notice AuditorRemoved event.
     * @dev Emitted when the admin revokes role from an auditor.
     *
     * @param auditor The deleted auditor.
     */
    event AuditorRemoved(address indexed auditor);

    /**
     * 
     * @param governance The address of the governance contract that is granted the role.
     * @dev Emitted when the admin grants the governance role to a contract.
     * @notice This event is used to track the governance contract that can manage auditor roles.
     */
    event GovernanceGranted(address indexed governance);

    /**
     * @dev Thrown when auditor account tries to add a new audit record with duplicate ipfs hash.
     */
    error DuplicateIpfsHash();

    /**
     * @dev Constructor grants DEFAULT_ADMIN_ROLE to the deployer.
     */
    constructor(address initialOwner) {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
    }

    /**
     * @dev Checks if passed _ipfsHash already exists along other records.
     *
     * @param _building The address of building.
     * @param _ipfsHash The IPFS hash for a new record.
     * @return isDuplicate The bool flag shows hash already exists.
     */
    function _isDuplicateHash(address _building, string calldata _ipfsHash) internal view returns (bool isDuplicate) {
        uint256[] storage recordIds = buildingAuditRecords[_building];
        for (uint256 i = 0; i < recordIds.length; i++) {
            if (Strings.equal(auditRecords[recordIds[i]].ipfsHash, _ipfsHash)) return true;
        }
    }

    /**
     * @notice Adds a new audit record for a building address.
     *
     * @param _building The EVM address of the building.
     * @param _ipfsHash IPFS hash of the audit document.
     */
    function addAuditRecord(address _building, string calldata _ipfsHash) external onlyRole(AUDITOR_ROLE) {
        require(_building != address(0), "AuditRegistry: Invalid building address");
        require(bytes(_ipfsHash).length > 0, "AuditRegistry: IPFS hash is required");

        // Check passed ipfs hash is not duplicate
        if (_isDuplicateHash(_building, _ipfsHash)) revert DuplicateIpfsHash();

        auditRecordCounter++;
        uint256 newRecordId = auditRecordCounter;

        auditRecords[newRecordId] = AuditRecord({
            building: _building,
            auditor: msg.sender,
            timestamp: uint64(block.timestamp),
            revoked: false,
            ipfsHash: _ipfsHash
        });

        buildingAuditRecords[_building].push(newRecordId);

        emit AuditRecordAdded(newRecordId, _building, msg.sender, _ipfsHash, block.timestamp);
    }

    /**
     * @notice Updates an existing audit record (must be the original auditor).
     *
     * @param _recordId The ID of the audit record to update.
     * @param _newIpfsHash The new IPFS hash of the audit document.
     */
    function updateAuditRecord(uint256 _recordId, string calldata _newIpfsHash) external onlyRole(AUDITOR_ROLE) {
        require(bytes(_newIpfsHash).length > 0, "AuditRegistry: IPFS hash is required");

        AuditRecord storage record = auditRecords[_recordId];
        require(record.auditor == msg.sender, "AuditRegistry: Not the original auditor");
        require(!record.revoked, "AuditRegistry: Cannot update a revoked record");

        // Check passed ipfs hash is not duplicate
        if (_isDuplicateHash(record.building, _newIpfsHash)) revert DuplicateIpfsHash();

        record.ipfsHash = _newIpfsHash;
        record.timestamp = uint64(block.timestamp);

        emit AuditRecordUpdated(_recordId, _newIpfsHash, block.timestamp);
    }

    /**
     * @notice Revokes an audit record (must be the original auditor).
     *
     * @param _recordId The ID of the audit record to revoke.
     */
    function revokeAuditRecord(uint256 _recordId) external onlyRole(AUDITOR_ROLE) {
        AuditRecord storage record = auditRecords[_recordId];
        require(record.auditor == msg.sender, "AuditRegistry: Not the original auditor");
        require(!record.revoked, "AuditRegistry: Already revoked");

        record.revoked = true;

        emit AuditRecordRevoked(_recordId, block.timestamp);
    }

    /**
     * Add an auditor tru governance voting
     * @param account account to be added as auditor
     */
    function addAuditor(address account) external onlyRole(GOVERNANCE_ROLE) {
        require(account != address(0), "Invalid address");
        _grantRole(AUDITOR_ROLE, account);
        emit AuditorAdded(account);
    }

    /**
     * Remove an auditor tru governance voting
     * @param account auditor account to be removed
     */
    function removeAuditor(address account) external onlyRole(GOVERNANCE_ROLE) {
        require(account != address(0), "Invalid address");
        _revokeRole(AUDITOR_ROLE, account);
        emit AuditorRemoved(account);
    }

    /**
     * Grant governance role to a governance contract
     * @param governance governance contract address to be granted the role
     */
    function grantGovernanceRole(address governance) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(governance != address(0), "AuditRegistry: Invalid governance address");
        _grantRole(GOVERNANCE_ROLE, governance);
        emit GovernanceGranted(governance);
    }

    /**
     * @notice Retrieves the list of audit record IDs for a specific building address.
     * @param _building The EVM address of the building.
     * @return An array of record IDs associated with that building.
     */
    function getAuditRecordsByBuilding(address _building) external view returns (uint256[] memory) {
        return buildingAuditRecords[_building];
    }

    /**
     * @notice Retrieves details of a specific audit record.
     * @param _recordId The ID of the audit record.
     * @return The AuditRecord struct containing audit details.
     */
    function getAuditRecordDetails(uint256 _recordId) external view returns (AuditRecord memory) {
        return auditRecords[_recordId];
    }
}
