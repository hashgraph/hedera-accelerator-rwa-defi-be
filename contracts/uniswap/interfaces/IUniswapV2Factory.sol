// SPDX-License-Identifier: GPL-3.0
pragma solidity >=0.5.0;

/******************************************************************************\
* Original IUniswapV2Factory interface authors are
* Zinsmeister, N., Adams, H., Robinson, D., & Salem, M. (2019). v2-core (Version 1.0.1) [Computer software].
* https://github.com/Uniswap/v2-core
*
* Modified the `PairCreated` event in order to emit additional ERC20 metadata
/******************************************************************************/

interface IUniswapV2Factory {
    event PairCreated(
        address indexed token0,
        address indexed token1,
        address pair,
        uint pairSeqNum,
        string token0Symbol,
        string token1Symbol,
        string token0Name,
        string token1Name,
        uint token0Decimals,
        uint token1Decimals
    );

    event FeeReceiverChanged(address indexed _receiver);
    event FeeSetterChanged(address indexed _feeSetter);

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function getPair(address tokenA, address tokenB) external view returns (address pair);

    function allPairs(uint) external view returns (address pair);

    function allPairsLength() external view returns (uint);

    function createPair(address tokenA, address tokenB) external returns (address pair);

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;
}
