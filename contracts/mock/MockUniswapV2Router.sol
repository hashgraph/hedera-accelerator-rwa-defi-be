// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "../vaultV2/IERC20.sol";
import {IUniswapV2Router02} from "../uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";

contract MockUniswapV2Router is IUniswapV2Router02 {
    mapping(address => mapping(address => uint256)) public exchangeRates;
    bool public shouldFail = false;
    
    function setExchangeRate(address tokenA, address tokenB, uint256 rate) external {
        exchangeRates[tokenA][tokenB] = rate;
    }
    
    function setShouldFail(bool _shouldFail) external {
        shouldFail = _shouldFail;
    }
    
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external override returns (uint[] memory amounts) {
        require(!shouldFail, "Mock: Swap failed");
        require(path.length >= 2, "Invalid path");
        
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        // Transfer input token from sender
        IERC20(path[0]).transferFrom(msg.sender, address(this), amountIn);
        
        // Calculate output amount
        uint256 currentAmount = amountIn;
        for (uint i = 1; i < path.length; i++) {
            uint256 rate = exchangeRates[path[i-1]][path[i]];
            if (rate == 0) rate = 1e18; // Default 1:1 rate
            
            currentAmount = (currentAmount * rate) / 1e18;
            amounts[i] = currentAmount;
        }
        
        // Ensure minimum output
        require(amounts[amounts.length - 1] >= amountOutMin, "Insufficient output");
        
        // Transfer output token to recipient
        IERC20(path[path.length - 1]).transfer(to, amounts[amounts.length - 1]);
    }
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view override returns (uint[] memory amounts) {
        amounts = new uint[](path.length);
        amounts[0] = amountIn;
        
        uint256 currentAmount = amountIn;
        for (uint i = 1; i < path.length; i++) {
            uint256 rate = exchangeRates[path[i-1]][path[i]];
            if (rate == 0) rate = 1e18; // Default 1:1 rate
            
            currentAmount = (currentAmount * rate) / 1e18;
            amounts[i] = currentAmount;
        }
    }
    
    // Implement required interface functions with minimal functionality
    function factory() external pure override returns (address) {
        return address(0);
    }
    
    function WETH() external pure override returns (address) {
        return address(0);
    }
    
    function addLiquidity(
        address,
        address,
        uint,
        uint,
        uint,
        uint,
        address,
        uint
    ) external pure override returns (uint, uint, uint) {
        revert("Not implemented");
    }
    
    function addLiquidityETH(
        address,
        uint,
        uint,
        uint,
        address,
        uint
    ) external payable override returns (uint, uint, uint) {
        revert("Not implemented");
    }
    
    function removeLiquidity(
        address,
        address,
        uint,
        uint,
        uint,
        address,
        uint
    ) external pure override returns (uint, uint) {
        revert("Not implemented");
    }
    
    function removeLiquidityETH(
        address,
        uint,
        uint,
        uint,
        address,
        uint
    ) external pure override returns (uint, uint) {
        revert("Not implemented");
    }
    
    function removeLiquidityWithPermit(
        address,
        address,
        uint,
        uint,
        uint,
        address,
        uint,
        bool,
        uint8,
        bytes32,
        bytes32
    ) external pure override returns (uint, uint) {
        revert("Not implemented");
    }
    
    function removeLiquidityETHWithPermit(
        address,
        uint,
        uint,
        uint,
        address,
        uint,
        bool,
        uint8,
        bytes32,
        bytes32
    ) external pure override returns (uint, uint) {
        revert("Not implemented");
    }
    
    function swapTokensForExactTokens(
        uint,
        uint,
        address[] calldata,
        address,
        uint
    ) external pure override returns (uint[] memory) {
        revert("Not implemented");
    }
    
    function swapExactETHForTokens(
        uint,
        address[] calldata,
        address,
        uint
    ) external payable override returns (uint[] memory) {
        revert("Not implemented");
    }
    
    function swapTokensForExactETH(
        uint,
        uint,
        address[] calldata,
        address,
        uint
    ) external pure override returns (uint[] memory) {
        revert("Not implemented");
    }
    
    function swapExactTokensForETH(
        uint,
        uint,
        address[] calldata,
        address,
        uint
    ) external pure override returns (uint[] memory) {
        revert("Not implemented");
    }
    
    function swapETHForExactTokens(
        uint,
        address[] calldata,
        address,
        uint
    ) external payable override returns (uint[] memory) {
        revert("Not implemented");
    }
    
    function quote(uint, uint, uint) external pure override returns (uint) {
        revert("Not implemented");
    }
    
    function getAmountOut(uint, uint, uint) external pure override returns (uint) {
        revert("Not implemented");
    }
    
    function getAmountIn(uint, uint, uint) external pure override returns (uint) {
        revert("Not implemented");
    }
    
    function getAmountsIn(uint, address[] calldata) external pure override returns (uint[] memory) {
        revert("Not implemented");
    }
    
    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address,
        uint,
        uint,
        uint,
        address,
        uint
    ) external pure override returns (uint) {
        revert("Not implemented");
    }
    
    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address,
        uint,
        uint,
        uint,
        address,
        uint,
        bool,
        uint8,
        bytes32,
        bytes32
    ) external pure override returns (uint) {
        revert("Not implemented");
    }
    
    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint,
        uint,
        address[] calldata,
        address,
        uint
    ) external pure override {
        revert("Not implemented");
    }
    
    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint,
        address[] calldata,
        address,
        uint
    ) external payable override {
        revert("Not implemented");
    }
    
    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint,
        uint,
        address[] calldata,
        address,
        uint
    ) external pure override {
        revert("Not implemented");
    }
}
