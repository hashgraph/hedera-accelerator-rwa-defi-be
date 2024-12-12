// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {BuildingFactory} from '../BuildingFactory.sol';

contract BuildingFactoryMock is BuildingFactory {
   
    function version() public pure returns (string memory) {
        return '2.0';
    }

    function initialize(
        address _nft,
        address _uniswapRouter,
        address _uniswapFactory
    ) public override initializer {
       super.initialize(_nft, _uniswapRouter, _uniswapFactory);
    }

    function newBuilding(bytes32 _salt, string memory tokenURI) public override onlyOwner {
        super.newBuilding(_salt, tokenURI);
    }
}
