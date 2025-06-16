// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IUniswapV1Factory {
    function getExchange(address) external view returns (address);
}
