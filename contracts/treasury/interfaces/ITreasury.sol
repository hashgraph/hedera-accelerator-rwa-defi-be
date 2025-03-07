// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ITreasury
 * @author Hashgraph
 * @notice This interface manages the Treasury
 */

interface ITreasury {
    // return usdc address
    function usdc() external view returns (address);
    // return vault
    function vault() external view returns (address);
    // deposit USDC into treasury
    function deposit(uint256 amount) external;
    // governance-controlled function to make payments
    function makePayment(address to, uint256 amount) external;
    // update reserve amount (governance role)
    function setReserveAmount(uint256 newReserveAmount) external;
    // granv governance role
    function grantGovernanceRole(address governance) external;
}
