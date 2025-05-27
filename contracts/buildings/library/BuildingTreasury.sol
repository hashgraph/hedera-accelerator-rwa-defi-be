// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Treasury} from "../../treasury/Treasury.sol";

struct TreasuryDetails {
    address treasuryBeacon;
    address initialOwner;
    uint256 reserveAmount;
    uint256 nPercentage;
    address businessAddress;
    address usdc;
    address buildingFactory;
}

library BuildingTreasuryLib {
    function deployTreasury(TreasuryDetails memory details) external returns (address) {
        return address(new BeaconProxy(
            details.treasuryBeacon,
            abi.encodeWithSelector(
                Treasury.initialize.selector,
                details.usdc,
                details.reserveAmount,
                details.nPercentage,
                details.initialOwner,
                details.businessAddress,
                details.buildingFactory
            )
        ));
    }
}
