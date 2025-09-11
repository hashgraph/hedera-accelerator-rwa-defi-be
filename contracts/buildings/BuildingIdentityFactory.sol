// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "../onchainid/factory/IdFactory.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IBuildingIdentityFactory} from "./interfaces/IBuildingIdentityFactory.sol";

contract BuildingIdentityFactory is IBuildingIdentityFactory, AccessControl {
    IdFactory private idFactory;
    bytes32 public constant IDENTITY_DEPLOYER_ROLE = keccak256("IDENTITY_DEPLOYER_ROLE");

    error ZeroAddress();

    constructor(address _idFactory) {
        idFactory = IdFactory(_idFactory);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(IDENTITY_DEPLOYER_ROLE, msg.sender);
    }

    /**
     *  @dev createIdentity an ONCHAINID using a factory using the identityOwner address as salt.
     *  @param identityOwner the address to set as a management key.
     */
    function createIdentity(address identityOwner) external onlyRole(IDENTITY_DEPLOYER_ROLE) returns (address) {
        if (identityOwner == address(0)) {
            revert ZeroAddress();
        }

        return idFactory.createIdentity(identityOwner, Strings.toHexString(identityOwner));
    }

    function getIdentity(address identityOwner) external view returns (address) {
        return idFactory.getIdentity(identityOwner);
    }
}
