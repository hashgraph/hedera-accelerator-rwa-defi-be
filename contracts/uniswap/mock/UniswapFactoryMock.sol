// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IUniswapV2Factory} from "../../buildings/interface/UniswapInterface.sol";

contract UniswapFactoryMock is IUniswapV2Factory {
    function feeTo() external view override returns (address) {}

    function feeToSetter() external view override returns (address) {}

    function rentPayer() external view override returns (address) {}

    function pairCreateFee() external view override returns (uint256) {}

    function getPair(address tokenA, address tokenB) external view override returns (address pair) {
        return address(1);
    }

    function allPairs(uint) external view override returns (address pair) {}

    function allPairsLength() external view override returns (uint) {}

    function createPair(address tokenA, address tokenB) external payable override returns (address pair) {}

    function setFeeTo(address) external override {}

    function setFeeToSetter(address) external override {}

    function setRentPayer(address) external override {}

    function setPairCreateFee(uint256) external override {}

    function setTokenCreateFee(uint256) external override {}
}
