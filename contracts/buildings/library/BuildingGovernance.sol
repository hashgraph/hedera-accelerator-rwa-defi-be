// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {BuildingGovernance} from "../governance/BuildingGovernance.sol";

struct GovernanceDetails {
    address governanceBeacon;
    address token;
    string name;
    address treasury;
    address initialOwner;
}

library BuildingGovernanceLib {
    function deployGovernance(GovernanceDetails memory details) external returns (address) {
        return address (new BeaconProxy(
            details.governanceBeacon,
            abi.encodeWithSelector(
                BuildingGovernance.initialize.selector, 
                details.token, 
                details.name, 
                details.initialOwner, 
                details.treasury
            )
        ));
    }
}
