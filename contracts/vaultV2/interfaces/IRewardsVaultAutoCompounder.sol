// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title IRewardsVaultAutoCompounder
/// @notice Interface for RewardsVault4626 autocompounder with Uniswap integration
interface IRewardsVaultAutoCompounder {
    /*///////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Deposit(address indexed user, uint256 assets, uint256 shares);
    event Withdraw(address indexed user, uint256 shares, uint256 assets);
    event RewardsClaimed(address indexed user, address indexed rewardToken, uint256 amount);
    event AutoCompound(uint256 totalAssetsReinvested, uint256 swapCount);
    event TokenSwapped(address indexed fromToken, address indexed toToken, uint256 amountIn, uint256 amountOut);
    event SwapPathUpdated(address indexed rewardToken, address[] newPath);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /*///////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotOwner();
    error InvalidAmount();
    error InvalidReceiver();
    error TransferFailed();
    error InsufficientBalance();
    error InvalidNewOwner();
    error InvalidSlippage();
    error SwapFailed();
    error InvalidSwapPath();

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposits assets into the autocompounder
    /// @param assets Amount of assets to deposit
    /// @param receiver Address that will receive autocompounder shares
    /// @return shares Number of shares minted
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);

    /// @notice Withdraws assets from the autocompounder
    /// @param shares Number of shares to burn
    /// @param receiver Address that will receive the assets
    /// @return assets Amount of assets received
    function withdraw(uint256 shares, address receiver) external returns (uint256 assets);

    /// @notice Mints exact autocompounder shares
    /// @param shares Exact number of shares to mint
    /// @param receiver Address that will receive shares
    /// @return assets Amount of assets required
    function mint(uint256 shares, address receiver) external returns (uint256 assets);

    /// @notice Redeems exact autocompounder shares
    /// @param shares Exact number of shares to burn
    /// @param receiver Address that will receive assets
    /// @param owner_ Owner of shares (for allowance)
    /// @return assets Amount of assets received
    function redeem(uint256 shares, address receiver, address owner_) external returns (uint256 assets);

    /*///////////////////////////////////////////////////////////////
                           AUTO-COMPOUND FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Performs auto-compounding with Uniswap swaps
    function autoCompound() external;

    /// @notice Allows users to claim their rewards proportionally
    function claimUserRewards() external;

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the total amount of managed assets
    function totalAssets() external view returns (uint256);

    /// @notice Returns user's assets
    function assetsOf(address user) external view returns (uint256);

    /// @notice Returns the underlying asset address
    function asset() external view returns (address);

    /// @notice Returns the related vault address
    function vault() external view returns (address);

    /// @notice Returns current exchange rate (autocompounder shares / assets)
    function exchangeRate() external view returns (uint256);

    /// @notice Returns user information
    function getUserInfo(address user) external view returns (uint256 depositTimestamp, uint256 totalDeposited);

    /// @notice Returns if user can withdraw (based on vault's lock period)
    function canWithdraw(address user) external view returns (bool);

    /// @notice Tests a swap to verify it works
    function testSwap(address rewardToken, uint256 amount) external view returns (uint256 amountOut);

    /// @notice Returns configured swap path for a token
    function getSwapPath(address rewardToken) external view returns (address[] memory path);

    /*///////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Updates minimum threshold for auto-compound
    function setMinimumClaimThreshold(uint256 newThreshold) external;

    /// @notice Updates maximum allowed slippage
    function setMaxSlippage(uint256 newSlippage) external;

    /// @notice Configures swap path for a specific reward token
    function setSwapPath(address rewardToken, address[] calldata path) external;

    /// @notice Removes a configured swap path
    function removeSwapPath(address rewardToken) external;

    /// @notice Transfers contract ownership
    function transferOwnership(address newOwner) external;

    /// @notice Emergency function to recover stuck tokens
    function emergencyWithdraw(address token, uint256 amount) external;
}
