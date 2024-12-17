// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {AuditRegistry} from "../../audit/AuditRegistry.sol";

/// @title BuildingAudit
/// @author Hashgraph
/// @notice This contract uses namespaced storage see https://docs.openzeppelin.com/contracts/5.x/upgradeable#namespaced_storage
abstract contract BuildingAudit is Initializable {
    /// @custom:storage-location erc7201:hashgraph.buildings.BuildingAudit
    struct BuildingAuditStorage {
        address auditRegistry;
    }

    event NewAuditRegistry(address addr);

    //keccak256(abi.encode(uint256(keccak256("hashgraph.buildings.BuildingAudit")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant BuildingAuditStorageLocation = 0x1398114c786fd2d5dbcf29c302f594800c3b9ea470c98dbb34a8fb40a97e7100;

    function _getBuildingAuditStorage() private pure returns (BuildingAuditStorage storage $) {
        assembly {
            $.slot := BuildingAuditStorageLocation
        }
    }

    function __Audit_init(address _nftAddress) internal onlyInitializing {
        BuildingAuditStorage storage $ = _getBuildingAuditStorage();
        $.auditRegistry = _newAuditRegistry(_nftAddress);
    }

    function getAuditRegistry() public view returns(address) {
        BuildingAuditStorage storage $ = _getBuildingAuditStorage();
        return $.auditRegistry;
    }

    function _newAuditRegistry(address _nftAddress) internal returns (address _registry){
        // TODO: change AuditRegistry to upgradable 
        // BeaconProxy auditProxy = new BeaconProxy(
        //     _auditBeacon,
        //     abi.encodeWithSelector(AuditRegistry.initialize.selector, _nftAddress)
        // );    function _newAuditRegistry(bytes32 _salt, address _nftAddress) internal returns (AuditRegistry _registry){

        _registry = address(new AuditRegistry(_nftAddress));
        emit NewAuditRegistry(address(_registry));
    }

}
