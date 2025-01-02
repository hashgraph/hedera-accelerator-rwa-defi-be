// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.24;

import {ERC20} from "./ERC20.sol";

abstract contract IERC4626 is ERC20 {
    /*///////////////////////////////////////////////////////////////
                                Events
    //////////////////////////////////////////////////////////////*/

    /**
     * @notice Deposit event.
     * @dev Emitted after the deposit.
     *
     * @param sender The address of the account that performed the deposit.
     * @param receiver The address that received the shares created after the deposit.
     * @param assets The amount of assets that were deposited.
     * @param shares The number of shares that were minted.
     */
    event Deposit(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);

    /**
     * @notice Withdraw event.
     * @dev Emitted when shares are withdrawn from the vault in exchange for underlying assets.
     *
     * @param sender The sender address.
     * @param receiver The assets receiver address.
     * @param assets The amount of withdrawn assets.
     * @param shares The number of shares that were burned.
     */
    event Withdraw(address indexed sender, address indexed receiver, uint256 assets, uint256 shares);

    error ZeroShares(uint256 numberOfShares);

    error MaxRewardTokensAmount();

    /*///////////////////////////////////////////////////////////////
                            Mutable Functions
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     *
     * @param assets The amount of staking token to send.
     * @param receiver The shares receiver address.
     * @return shares The amount of shares to receive.
     */
    function deposit(uint256 assets, address receiver) public virtual returns (uint256 shares);

    /**
     * @dev Mints the underlying token.
     *
     * @param shares The amount of shares to send.
     * @param receiver The receiver of tokens.
     * @return amount The amount of tokens to receive.
     */
    function mint(uint256 shares, address receiver) public virtual returns (uint256 amount);

    /**
     * @dev Withdraws staking token and burns shares.
     *
     * @param amount The amount of assets.
     * @param receiver The staking token receiver.
     * @param from The owner of the shares.
     * @return shares The amount of shares to burn.
     */
    function withdraw(uint256 amount, address receiver, address from) public virtual returns (uint256 shares);

    /**
     * @dev Redeems shares for underlying assets.
     *
     * @param shares The amount of shares.
     * @param receiver The staking token receiver.
     * @param from The owner of the shares.
     * @return amount The amount of shares to burn.
     */
    function redeem(uint256 shares, address receiver, address from) public virtual returns (uint256 amount);

    /**
     * @dev Claims all pending reward tokens for the caller.
     *
     * @param _startPosition The starting index in the reward token list from which to begin claiming rewards.
     * @return The index of the start position after the last claimed reward and the total number of reward tokens.
     */
    function claimAllReward(uint256 _startPosition) external payable virtual returns (uint256, uint256);

    /*///////////////////////////////////////////////////////////////
                            View Functions
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Returns rewards for a user with fee considering.
     *
     * @param _user The user address.
     * @param _rewardToken The reward address.
     * @return unclaimedAmount The calculated rewards.
     */
    function getUserReward(address _user, address _rewardToken) external view virtual returns (uint256);

    /**
     * @dev Returns Asset token address.
     */
    function asset() public view virtual returns (address);

    /**
     * @dev Returns Share token address.
     */
    function share() public view virtual returns (address);

    /**
     * @dev Returns amount of assets on the contract balance.
     *
     * @return Asset balance of this contract.
     */
    function totalAssets() public view virtual returns (uint256);

    /**
     * @dev Calculates the amount of underlying assets.
     *
     * @param user The address of the user.
     * @return The amount of underlying assets equivalent to the user's shares.
     */
    function assetsOf(address user) public view virtual returns (uint256);

    /**
     * @dev Calculates how much one share is worth in terms of the underlying asset.
     *
     * @return The amount of assets one share can redeem.
     */
    function assetsPerShare() public view virtual returns (uint256);

    /**
     * @dev Returns the maximum amount of underlying assets that can be deposited by user.
     *
     * @return The maximum assets amount that can be deposited.
     */
    function maxDeposit(address) public virtual returns (uint256);

    /**
     * @dev Returns the maximum amount of shares that can be minted by user.
     *
     * @return The maximum amount of shares that can be minted.
     */
    function maxMint(address) public virtual returns (uint256);

    /**
     * @dev Returns the maximum amount of shares that can be redeemed by user.
     *
     * @param user The user address.
     * @return The maximum amount of shares that can be redeemed.
     */
    function maxRedeem(address user) public view virtual returns (uint256);

    /**
     * @dev Calculates the maximum amount of assets that can be withdrawn.
     *
     * @param user The user address.
     * @return The maximum amount of assets that can be withdrawn.
     */
    function maxWithdraw(address user) public view virtual returns (uint256);

    /**
     * @dev Calculates the number of shares that will be minted for a given amount.
     *
     * @param assets The underlying assets amount to deposit.
     * @return shares The estimated amount of shares that can be minted.
     */
    function previewDeposit(uint256 assets) public view virtual returns (uint256 shares);

    /**
     * @dev Calculates the amount of underlying assets equivalent to a given number of shares.
     *
     * @param shares The shares amount to mint.
     * @return amount The estimated underlying assets amount.
     */
    function previewMint(uint256 shares) public view virtual returns (uint256 amount);

    /**
     * @dev Calculates the amount of shares that would be burned for a given assets amount.
     *
     * @param assets The amount of underlying assets to withdraw.
     * @return shares The estimated number of shares that would be burned.
     */
    function previewWithdraw(uint256 assets) public view virtual returns (uint256 shares);

    /**
     * @dev Calculates the amount of underlying assets equivalent to a specific number of shares.
     *
     * @param shares The shares amount to redeem.
     * @return amount The estimated underlying assets amount that can be redeemed.
     */
    function previewRedeem(uint256 shares) public view virtual returns (uint256 amount);
}
