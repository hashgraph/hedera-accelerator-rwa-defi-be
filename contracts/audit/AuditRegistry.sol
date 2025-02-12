// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title AuditRegistry
 * @author Hashgraph
 * @notice This contract manages audit records for building addresses.
 */
contract AuditRegistry is AccessControl {
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    struct AuditRecord {
        address building;   // EVM address of the building
        address auditor;    // Address of the auditor
        string ipfsHash;    // IPFS hash of the audit document
        uint256 timestamp;  // Timestamp when the audit was added
        bool revoked;       // Status of the audit record (true if revoked)
    }

    // Each new record is assigned an incremental ID (1, 2, 3, etc.)
    uint256 public auditRecordCounter;

    // recordId => AuditRecord
    mapping(uint256 => AuditRecord) public auditRecords;

    // buildingAddress => array of record IDs
    mapping(address => uint256[]) public buildingAuditRecords;

    // Events
    event AuditRecordAdded(
        uint256 indexed recordId,
        address indexed building,
        address indexed auditor,
        string ipfsHash,
        uint256 timestamp
    );
    event AuditRecordUpdated(
        uint256 indexed recordId,
        string newIpfsHash,
        uint256 timestamp
    );
    event AuditRecordRevoked(
        uint256 indexed recordId,
        uint256 timestamp
    );
    event AuditorAdded(address indexed auditor);
    event AuditorRemoved(address indexed auditor);

    /**
     * @dev Constructor grants DEFAULT_ADMIN_ROLE to the deployer.
     */
    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    /**
     * @dev Add a new auditor under AUDITOR_ROLE.
     */
    function addAuditor(address _auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_auditor != address(0), "AuditRegistry: Invalid auditor address");
        grantRole(AUDITOR_ROLE, _auditor);
        emit AuditorAdded(_auditor);
    }

    /**
     * @dev Remove an auditor from AUDITOR_ROLE.
     */
    function removeAuditor(address _auditor) external onlyRole(DEFAULT_ADMIN_ROLE) {
        revokeRole(AUDITOR_ROLE, _auditor);
        emit AuditorRemoved(_auditor);
    }

    /**
     * @notice Adds a new audit record for a building address.
     * @param _building The EVM address of the building.
     * @param _ipfsHash IPFS hash of the audit document.
     */
    function addAuditRecord(address _building, string calldata _ipfsHash)
        external
        onlyRole(AUDITOR_ROLE)
    {
        require(_building != address(0), "AuditRegistry: Invalid building address");
        require(bytes(_ipfsHash).length > 0, "AuditRegistry: IPFS hash is required");

        auditRecordCounter++;
        uint256 newRecordId = auditRecordCounter;

        auditRecords[newRecordId] = AuditRecord({
            building: _building,
            auditor: msg.sender,
            ipfsHash: _ipfsHash,
            timestamp: block.timestamp,
            revoked: false
        });

        buildingAuditRecords[_building].push(newRecordId);

        emit AuditRecordAdded(
            newRecordId,
            _building,
            msg.sender,
            _ipfsHash,
            block.timestamp
        );
    }

    /**
     * @notice Updates an existing audit record (must be the original auditor).
     * @param _recordId The ID of the audit record to update.
     * @param _newIpfsHash The new IPFS hash of the audit document.
     */
    function updateAuditRecord(uint256 _recordId, string calldata _newIpfsHash)
        external
        onlyRole(AUDITOR_ROLE)
    {
        require(bytes(_newIpfsHash).length > 0, "AuditRegistry: IPFS hash is required");

        AuditRecord storage record = auditRecords[_recordId];
        require(record.auditor == msg.sender, "AuditRegistry: Not the original auditor");
        require(!record.revoked, "AuditRegistry: Cannot update a revoked record");

        record.ipfsHash = _newIpfsHash;
        record.timestamp = block.timestamp;

        emit AuditRecordUpdated(_recordId, _newIpfsHash, block.timestamp);
    }

    /**
     * @notice Revokes an audit record (must be the original auditor).
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
     * @notice Retrieves the list of audit record IDs for a specific building address.
     * @param _building The EVM address of the building.
     * @return An array of record IDs associated with that building.
     */
    function getAuditRecordsByBuilding(address _building)
        external
        view
        returns (uint256[] memory)
    {
        return buildingAuditRecords[_building];
    }

    /**
     * @notice Retrieves details of a specific audit record.
     * @param _recordId The ID of the audit record.
     * @return The AuditRecord struct containing audit details.
     */
    function getAuditRecordDetails(uint256 _recordId)
        external
        view
        returns (AuditRecord memory)
    {
        return auditRecords[_recordId];
    }
}