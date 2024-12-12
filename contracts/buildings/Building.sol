// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {BuildingBase} from './BuildingBase.sol';
import {BuildingLiquidityPool} from "./extensions/BuildingLiquidityPool.sol";
import {BuildingAudit} from "./extensions/BuildingAudit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Building is BuildingBase, BuildingLiquidityPool, BuildingAudit {

    /**
     * Contract initializer
     * @param _salt proxy identifier
     * @param _uniswapRouter uniswap router address
     * @param _uniswapFactory uniswap factory address
     * @param _nftAddress NFT collection address
     */
    function initialize (
        bytes32 _salt,
        address _uniswapRouter, 
        address _uniswapFactory,
        address _nftAddress
    ) public virtual initializer {
        __Ownable_init(_msgSender());
        __Building_init();
        __Liquidity_init(_uniswapRouter, _uniswapFactory);
        __Audit_init(_salt, _nftAddress);
    }

    /**
     * 
     * @param tokenA address of token A
     * @param tokenAAmount amount of token A
     * @param tokenB address of token B
     * @param tokenBAmount amount of token B
     * @return amountA amount of token A provided to the liquidity Pool
     * @return amountB amount of token B provided to the liquidity Pool
     * @return liquidity amount of liquidity tokens minted
     * @return pair address of the LP 
     */
    function addLiquidity(
        address tokenA, 
        uint256 tokenAAmount, 
        address tokenB, 
        uint256 tokenBAmount
    ) public virtual payable returns (uint amountA, uint amountB, uint liquidity, address pair) {        
        IERC20(tokenA).transferFrom(_msgSender(), address(this), tokenAAmount);
        IERC20(tokenB).transferFrom(_msgSender(), address(this), tokenBAmount);
        (amountA, amountB, liquidity, pair) =
            _addLiquidityToPool(tokenA, tokenB, tokenAAmount, tokenBAmount);        
    }
}
