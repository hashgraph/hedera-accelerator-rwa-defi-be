// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "../IERC20.sol";

/// @title IRewardsVault4626
/// @notice Interface for RewardsVault4626 contract
/// @dev Includes ERC4626 functionality with rewards distribution and lock period functionality
interface IRewardsVault4626 {
    /*///////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct UserInfo {
        uint256 lockTimeStart;
        bool exists;
    }

    struct RewardInfo {
        uint256 amount;
        bool exists;
    }

    /*///////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event RewardAdded(address indexed token, uint256 amount);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event RewardTokenRegistered(address indexed token);
    event Deposit(address indexed from, address indexed to, uint256 amount, uint256 shares);
    event Withdraw(address indexed from, address indexed to, uint256 amount, uint256 shares);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /*///////////////////////////////////////////////////////////////
                        ERC20 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function decimals() external view returns (uint8);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    /*///////////////////////////////////////////////////////////////
                        ERC4626 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function mint(uint256 shares, address receiver) external returns (uint256 assets);
    function withdraw(uint256 assets, address receiver, address owner_) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner_) external returns (uint256 assets);
    
    function totalAssets() external view returns (uint256);
    function assetsOf(address user) external view returns (uint256);
    function assetsPerShare() external view returns (uint256);
    
    function previewDeposit(uint256 assets) external view returns (uint256);
    function previewMint(uint256 shares) external view returns (uint256);
    function previewWithdraw(uint256 assets) external view returns (uint256);
    function previewRedeem(uint256 shares) external view returns (uint256);
    
    function maxDeposit(address) external view returns (uint256);
    function maxMint(address) external view returns (uint256);
    function maxWithdraw(address owner_) external view returns (uint256);
    function maxRedeem(address owner_) external view returns (uint256);

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the underlying asset token
    function asset() external view returns (IERC20);
    
    /// @notice Returns the lock period in seconds
    function lockPeriod() external view returns (uint256);
    
    /// @notice Returns the contract owner
    function owner() external view returns (address);
    
    /// @notice Returns reward token address at given index
    function rewardTokens(uint256 index) external view returns (address);
    
    /// @notice Returns user information
    function userInfo(address user) external view returns (UserInfo memory);
    
    /// @notice Returns reward token information
    function rewardInfo(address token) external view returns (RewardInfo memory);

    /// @notice Check if user's assets are unlocked
    function isUnlocked(address user) external view returns (bool);

    /// @notice Get time remaining until unlock
    function getTimeUntilUnlock(address user) external view returns (uint256);

    /// @notice Get claimable reward amount for a specific token
    function getClaimableReward(address user, address token) external view returns (uint256);

    /// @notice Get number of reward tokens
    function getRewardTokensLength() external view returns (uint256);

    /// @notice Get user's locked amount (in assets)
    function getLockedAmount(address user) external view returns (uint256);

    /// @notice Get total value locked (TVL)
    function getTVL() external view returns (uint256);

    /*///////////////////////////////////////////////////////////////
                        REWARD FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Add reward tokens to the vault (only owner)
    function addReward(address token, uint256 amount) external;

    /// @notice Claim all available rewards for the caller
    function claimAllRewards() external;

    /// @notice Claim specific reward tokens
    function claimSpecificsReward(address[] memory tokens) external returns (uint256);

    /*///////////////////////////////////////////////////////////////
                        LOCK PERIOD FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Unlock and withdraw with pagination support
    function unlock(uint256 startPosition, uint256 assets) external returns (uint256, uint256, uint256);

    /*///////////////////////////////////////////////////////////////
                        OWNERSHIP FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfer ownership of the vault
    function transferOwnership(address newOwner) external;
}
