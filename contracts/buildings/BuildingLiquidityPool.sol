// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/safe-HTS/SafeHTS.sol";
import "./interface/UniswapInterface.sol";

contract BuildingLiquidityPool is Initializable {
    address internal uniswapRouter;
    address internal uniswapFactory;
    address internal pair;
    address internal lpToken;

    function initialize ( 
        address _uniswapRouter, 
        address _uniswapFactory
    ) public initializer {
        uniswapRouter = _uniswapRouter;
        uniswapFactory = _uniswapFactory;
    }

    function getPair() public view returns (address) {
        return pair;
    }

    function getLpToken() public view returns (address) {
        return lpToken;
    }

    function _addLiquidityToPool(
        address _usdc, 
        address _token, 
        uint256 usdcAmount, 
        uint256 tokenAmount
    ) internal returns(uint amountA, uint amountB, uint liquidity) {
        if (pair == address(0)){
            pair = UniswapV2Factory(uniswapFactory).createPair{ value : msg.value }(_token, _usdc);
            lpToken = UniswapV2Pair(pair).lpToken();
            SafeHTS.safeAssociateToken(lpToken, address(this));
        }

        SafeHTS.safeMintToken(_token, uint64(tokenAmount), new bytes[](0)); // fix decimals ?  
        SafeHTS.safeApprove(_token, address(uniswapRouter), tokenAmount);
        SafeHTS.safeApprove(_usdc, address(uniswapRouter), usdcAmount);

        (
            amountA, // The actual amounts of tokenA that were added to the pool.
            amountB, // The actual amounts of tokenB that were added to the pool.
            liquidity // The number of liquidity tokens (LP tokens) minted and sent to the to address.
        ) = UniswapV2Router02(uniswapRouter).addLiquidity(
            _token, // The addresses of the tokenA you want to add to the liquidity pool
            _usdc, // The addresses of the tokenB you want to add to the liquidity pool
            tokenAmount, // amountADesired The amounts of tokenA you wish to deposit into the liquidity pool
            usdcAmount, // amountBDesired The amounts of tokenB you wish to deposit into the liquidity pool
            tokenAmount, // The minimum amounts of tokenA you are willing to add. (These serve as a safeguard against large price slippage)
            usdcAmount, // The minimum amounts of tokenB you are willing to add. (These serve as a safeguard against large price slippage)
            address(this), // The address that will receive the liquidity pool (LP) tokens
            block.timestamp + 300 // A timestamp (in seconds) after which the transaction will revert if it hasn't been executed.  prevents front-running 
        );
    }
}
