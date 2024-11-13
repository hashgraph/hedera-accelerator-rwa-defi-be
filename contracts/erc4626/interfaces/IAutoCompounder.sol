// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Auto Compounder
 */
interface IAutoCompounder {
    function getExchangeRate() external view returns (uint256);

    function withdraw(uint256 amount, address receiver, address from) external;
}
