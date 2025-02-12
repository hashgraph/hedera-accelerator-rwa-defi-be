// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {AuditRegistry} from "../../audit/AuditRegistry.sol";

abstract contract BuildingAudit is Initializable {
    struct BuildingAuditStorage {
        address auditRegistry;
    }

    event NewAuditRegistry(address addr);

    bytes32 private constant BuildingAuditStorageLocation =
        0x1398114c786fd2d5dbcf29c302f594800c3b9ea470c98dbb34a8fb40a97e7100;

    function _getBuildingAuditStorage() private pure returns (BuildingAuditStorage storage $) {
        assembly {
            $.slot := BuildingAuditStorageLocation
        }
    }

    function __Audit_init() internal onlyInitializing {
        BuildingAuditStorage storage $ = _getBuildingAuditStorage();
        $.auditRegistry = _newAuditRegistry();
    }

    function getAuditRegistry() public view returns(address) {
        BuildingAuditStorage storage $ = _getBuildingAuditStorage();
        return $.auditRegistry;
    }

    function _newAuditRegistry() internal returns (address _registry){
        _registry = address(new AuditRegistry());
        emit NewAuditRegistry(_registry);
    }
}
