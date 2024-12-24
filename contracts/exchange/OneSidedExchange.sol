// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
pragma abicoder v2;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

struct Price {
    uint256 price;
    uint256 interval;
}

struct PriceThreshold {
    uint256 maxSellAmount;
    uint256 maxBuyAmount;
    uint256 interval;
}

using SafeERC20 for ERC20;

/**
 * @title One Sided Exchange
 *
 * The contract which represents a one sided exchange
 at desired prices.
 */
contract OneSidedExchange is ReentrancyGuard, Ownable {
    event Deposit(address token, uint256 amount);
    event Withdraw(address token, uint256 amount);
    event SwapSuccess(
        address indexed trader,
        address tokenA,
        address tokenB,
        uint256 tokenAAmount,
        uint256 tokenBAmount
    );
    error InvalidAmount(string message, uint256 amount);
    error NoPriceExists(string message);
    error InvalidAddress(string message);

    mapping(address => Price) internal _buyPrices;
    mapping(address => Price) internal _sellPrices;
    mapping(address => PriceThreshold) internal _thresholds;
    mapping(address => uint256) internal _buyAmounts;
    mapping(address => uint256) internal _sellAmounts;

    constructor() Ownable(msg.sender) {}

    /// @dev Modifier that do check on zero address
    /// @param token Token EVM address
    modifier isValidAddress(address token) {
        if (token == address(0)) {
            revert InvalidAddress("No zero address is allowed");
        }

        _;
    }

    /// @dev Method that publicaly exposed for tokens withdrawal from exchange
    /// @param token Token EVM address
    /// @param amount Amount of tokens to withdraw
    function withdraw(address token, uint256 amount) public nonReentrant onlyOwner isValidAddress(token) {
        if (amount == 0) {
            revert InvalidAmount("Invalid amount", amount);
        }

        if (ERC20(token).balanceOf(address(this)) < amount) {
            revert InvalidAmount("Not enought tokens balance to withdraw", amount);
        }

        _withdraw(token, amount);
    }

    /// @dev Method that publicaly exposed for deposit tokens into exchnage
    /// @param token Token EVM address
    /// @param amount Amount of tokens to deposit
    function deposit(address token, uint256 amount) public nonReentrant onlyOwner isValidAddress(token) {
        if (amount == 0) {
            revert InvalidAmount("Invalid amount", amount);
        }

        _deposit(msg.sender, token, amount);
    }

    /// @dev Method that publicaly exposed for a swap between tokenA and tokenB
    /// @param tokenA First token EVM address
    /// @param tokenB Second token EVM address
    /// @param amount Amount of tokens to swap using tokens rate
    function swap(address tokenA, address tokenB, uint256 amount) public nonReentrant {
        _swap(msg.sender, tokenA, tokenB, amount);
    }

    function _deposit(address signer, address token, uint256 amount) internal {
        /// @notice Owner should give allowance for a contract to transfer n tokens amount.
        uint256 _amount = amount * (10 ** ERC20(token).decimals());
        ERC20(token).safeTransferFrom(signer, address(this), _amount);

        emit Deposit(token, amount);
    }

    function _withdraw(address token, uint256 amount) internal {
        uint256 _amount = amount * (10 ** ERC20(token).decimals());
        ERC20(token).transfer(owner(), _amount);

        emit Withdraw(token, amount);
    }

    function _swap(address trader, address tokenA, address tokenB, uint256 amount) internal {
        (uint256 tokenAAmount, uint256 tokenBAmount) = _checkIfExchangeAllowedForPair(tokenA, tokenB, amount, trader);

        /// @notice Owner should give allowance for a contract to transfer n tokens amount.
        ERC20(tokenA).safeTransferFrom(trader, address(this), tokenAAmount);
        ERC20(tokenB).transfer(trader, tokenBAmount);

        _sellAmounts[tokenA] += tokenAAmount;
        _buyAmounts[tokenB] += tokenBAmount;

        emit SwapSuccess(trader, tokenA, tokenB, tokenAAmount, tokenBAmount);
    }

    function _checkIfExchangeAllowedForPair(
        address tokenA,
        address tokenB,
        uint256 amount,
        address trader
    ) internal view returns (uint256 tokenAAmount, uint256 tokenBAmount) {
        PriceThreshold memory tokenAThreshold = _thresholds[tokenA];
        PriceThreshold memory tokenBThreshold = _thresholds[tokenB];

        (uint256 tokenASellAmount, uint256 tokenBBuyAmount) = estimateTokenReturns(tokenA, tokenB, amount);
        uint256 balanceOfAToken = ERC20(tokenA).balanceOf(trader) * (10 ** ERC20(tokenA).decimals());
        uint256 balanceOfBToken = ERC20(tokenB).balanceOf(address(this)) * (10 ** ERC20(tokenB).decimals());

        if (tokenASellAmount > balanceOfAToken) {
            revert InvalidAmount("No enough tokens to sell", tokenASellAmount);
        } else if (tokenBBuyAmount > balanceOfBToken) {
            revert InvalidAmount("No enough tokens to buy", tokenBBuyAmount);
        }

        if (tokenAThreshold.maxSellAmount != 0 && tokenAThreshold.interval < block.timestamp) {
            if ((_sellAmounts[tokenA] + tokenASellAmount) > tokenAThreshold.maxSellAmount) {
                revert InvalidAmount("Max sell amount of tokens exceeded", (_sellAmounts[tokenA] + tokenASellAmount));
            }
        }

        if (tokenBThreshold.maxBuyAmount != 0 && tokenBThreshold.interval < block.timestamp) {
            if ((_buyAmounts[tokenB] + tokenBBuyAmount) > tokenBThreshold.maxBuyAmount) {
                revert InvalidAmount("Max buy amount of tokens exceeded", (_buyAmounts[tokenB] + tokenBBuyAmount));
            }
        }

        return (tokenASellAmount, tokenBBuyAmount);
    }

    /// @dev Method that publicaly exposed for a token amounts returns estimation
    /// @param tokenA First token EVM address
    /// @param tokenB Second token EVM address
    /// @param amount Amount of tokens to estimate swap using tokens rate
    function estimateTokenReturns(
        address tokenA,
        address tokenB,
        uint256 amount
    ) public view isValidAddress(tokenA) isValidAddress(tokenB) returns (uint256 tokenAAmount, uint256 tokenBAmount) {
        if (_buyPrices[tokenB].interval == 0 || _sellPrices[tokenA].interval == 0) {
            revert NoPriceExists("Sell or buy price for pair not found");
        } else if (_buyPrices[tokenB].interval > block.timestamp || _sellPrices[tokenA].interval > block.timestamp) {
            revert NoPriceExists("Sell or buy price for pair is not valid");
        }

        uint256 tokenADecimals = 10 ** ERC20(tokenA).decimals();
        uint256 tokenBDecimals = 10 ** ERC20(tokenB).decimals();

        if (tokenADecimals != tokenBDecimals) {
            uint256 tokenASellAmount = amount * _sellPrices[tokenA].price;
            uint256 tokenBBuyAmount = ((tokenASellAmount * _sellPrices[tokenA].price) / _buyPrices[tokenB].price);

            return (tokenASellAmount * tokenADecimals, tokenBBuyAmount * tokenBDecimals);
        } else {
            uint256 tokenASellAmount = (amount * tokenADecimals) * _sellPrices[tokenA].price;
            uint256 tokenBBuyAmount = ((tokenASellAmount * _sellPrices[tokenA].price) / _buyPrices[tokenB].price);

            return (tokenASellAmount, tokenBBuyAmount);
        }
    }

    /// Set threshold for sell/buy token amounts considering interval
    /// @param token Token EVM address
    /// @param maxSellAmount Tokens max sell amount
    /// @param maxBuyAmount Tokens max buy amount
    /// @param interval Timestamp in seconds that indicates end time
    function setThreshold(
        address token,
        uint256 maxSellAmount,
        uint256 maxBuyAmount,
        uint256 interval
    ) public onlyOwner isValidAddress(token) {
        uint256 _decimals = ERC20(token).decimals();

        _thresholds[token] = PriceThreshold(
            maxSellAmount * (10 ** _decimals),
            maxBuyAmount * (10 ** _decimals),
            interval
        );
    }

    /// Set buy price for a token considering interval
    /// @param token Token EVM address
    /// @param amount Price of the token
    /// @param interval Timestamp in seconds that indicates end time
    function setBuyPrice(address token, uint256 amount, uint256 interval) public onlyOwner isValidAddress(token) {
        _buyPrices[token] = Price(amount, interval);
    }

    /// Set sell price for a token considering interval
    /// @param token Token EVM address
    /// @param amount Price of the token
    /// @param interval Timestamp in seconds that indicates end time
    function setSellPrice(address token, uint256 amount, uint256 interval) public onlyOwner isValidAddress(token) {
        _sellPrices[token] = Price(amount, interval);
    }
}
