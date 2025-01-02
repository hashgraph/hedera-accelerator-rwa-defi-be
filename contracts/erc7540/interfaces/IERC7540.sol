// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.24;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IERC7540 {
    /**
     * @notice Deposit Requested event.
     * @dev Emitted when a user requests deposit.
     *
     * @param controller The controller address.
     * @param owner The owner address.
     * @param sender The sender address.
     * @param assets The assets amount.
     */
    event DepositRequested(address indexed controller, address indexed owner, address sender, uint256 assets);

    /**
     * @notice Redeem Requested event.
     * @dev Emitted when a user requests redeem.
     *
     * @param controller The controller address.
     * @param owner The owner address.
     * @param sender The sender address.
     * @param shares The shares amount.
     */
    event RedeemRequested(address indexed controller, address indexed owner, address sender, uint256 shares);

    /**
     * @dev Creates a new pending async deposit request.
     *
     * @param assets The amount of assets to deposit.
     * @param operator The operator address.
     * @param owner The owner address.
     */
    function requestDeposit(uint256 assets, address operator, address owner) external;

    /**
     * @dev Returns the pending asset amount from the deposit request.
     *
     * @param owner The owner of the request.
     * @return assets The assets amount.
     */
    function pendingDepositRequest(address owner) external view returns (uint256 assets);

    /**
     * @dev Creates a new pending async redeem request.
     *
     * @param shares The amount of shares to redeem.
     * @param operator The operator address.
     * @param owner The owner address.
     */
    function requestRedeem(uint256 shares, address operator, address owner) external;

    /**
     * @dev Returns the pending asset amount from the redeem request.
     *
     * @param owner The owner of the request.
     * @return shares The shares amount.
     */
    function pendingRedeemRequest(address owner) external view returns (uint256 shares);

    /**
     * @dev Returns Share token address.
     */
    function share() external view returns (address);

    /**
     * @dev Returns Asset token address.
     */
    function asset() external view returns (address);
}
