// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {BuildingFactory, BuildingFactoryInit} from '../BuildingFactory.sol';

contract BuildingFactoryMock is BuildingFactory {
   
    function version() public pure returns (string memory) {
        return '2.0';
    }

    function initialize(BuildingFactoryInit calldata init) public override initializer {
       super.initialize(init);
    }

    function newBuilding(NewBuildingDetails calldata details) public override returns (BuildingDetails memory buildingDetails)  {
        buildingDetails = super.newBuilding(details);
    }
}
