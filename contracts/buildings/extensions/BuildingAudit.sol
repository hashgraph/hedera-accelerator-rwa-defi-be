// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../../audit/AuditRegistry.sol";

abstract contract BuildingAudit is Initializable {
    AuditRegistry public auditRegistry;

    event NewAuditRegistry(address addr);

    function __Audit_init(bytes32 _salt, address _nftAddress) internal onlyInitializing {
        auditRegistry = _newAuditRegistry(_salt, _nftAddress);
    }

    function _newAuditRegistry(bytes32 _salt, address _nftAddress) internal returns (AuditRegistry _registry){
        _registry = (new AuditRegistry){ salt : _salt}(_nftAddress);
        emit NewAuditRegistry(address(_registry));
    }

}
