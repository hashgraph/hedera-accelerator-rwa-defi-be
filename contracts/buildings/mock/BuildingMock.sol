// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Building} from '../Building.sol';

contract BuildingMock is Building {
    function version() public pure returns (string memory) {
        return '2.0';
    }

    function initialize (address initialOwner) public override {
       super.initialize(initialOwner);
    }
}
