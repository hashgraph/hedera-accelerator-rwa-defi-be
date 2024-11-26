// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

interface UniswapV2Factory {
    function createPair(address tokenA, address tokenB) 
        external payable returns (address pair);
}

interface UniswapV2Pair {
    function lpToken () external view returns (address);
}

interface UniswapV2Router02 {
    function addLiquidity(
    address tokenA,
    address tokenB,
    uint amountADesired,
    uint amountBDesired,
    uint amountAMin,
    uint amountBMin,
    address to,
    uint deadline
    ) external payable returns (uint amountA, uint amountB, uint liquidity);
}
