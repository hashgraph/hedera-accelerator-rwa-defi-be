// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC20} from "./IERC20.sol";
import {RewardsVault4626} from "./RewardsVault4626.sol";
import {FixedPointMathLib} from "../math/FixedPointMathLib.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUniswapV2Router02} from "../uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";
import {IRewardsVaultAutoCompounder} from "./interfaces/IRewardsVaultAutoCompounder.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

/// @title RewardsVaultAutoCompounder
/// @notice Simplified auto-compounder for RewardsVault4626
/// @dev This contract allows users to deposit and automatically claims rewards to reinvest them
contract RewardsVaultAutoCompounder is IERC20, ReentrancyGuard, IRewardsVaultAutoCompounder, ERC165 {
    using FixedPointMathLib for uint256;

    /*///////////////////////////////////////////////////////////////
                            STORAGE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The underlying vault
    RewardsVault4626 public immutable VAULT;

    /// @notice The underlying asset token
    IERC20 public immutable ASSET;

    /// @notice Uniswap V2 router for swaps
    IUniswapV2Router02 public immutable UNISWAP_ROUTER;

    /// @notice Intermediate token for swaps (e.g., WETH, USDC)
    address public immutable INTERMEDIATE_TOKEN;

    /// @notice Name of the autocompounder token
    string public name;

    /// @notice Symbol of the autocompounder token
    string public symbol;

    /// @notice Number of decimals
    uint8 public immutable DECIMALS;

    /// @notice Total supply of autocompounder tokens
    uint256 public totalSupply;

    /// @notice Contract owner
    address public owner;

    /// @notice Minimum threshold to perform automatic claim
    uint256 public minimumClaimThreshold;

    /// @notice Maximum allowed slippage for swaps (in basis points, e.g., 300 = 3%)
    uint256 public maxSlippage;

    /*///////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct UserInfo {
        uint256 depositTimestamp; // Timestamp of first deposit
        uint256 totalDeposited; // Total deposited by user
    }

    /*///////////////////////////////////////////////////////////////
                                MAPPINGS
    //////////////////////////////////////////////////////////////*/

    /// @notice User balances in the autocompounder
    mapping(address => uint256) public override balanceOf;

    /// @notice Allowances for transfers
    mapping(address => mapping(address => uint256)) public override allowance;

    /// @notice User information
    mapping(address => UserInfo) public userInfo;

    /// @notice Custom swap paths for each reward token to asset
    mapping(address => address[]) public swapPaths;

    /*///////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /*///////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        RewardsVault4626 _vault,
        string memory _name,
        string memory _symbol,
        uint256 _minimumClaimThreshold,
        IUniswapV2Router02 _uniswapRouter,
        address _intermediateToken,
        uint256 _maxSlippage
    ) {
        VAULT = _vault;
        ASSET = IERC20(_vault.asset());
        name = _name;
        symbol = _symbol;
        DECIMALS = _vault.decimals();
        owner = msg.sender;
        minimumClaimThreshold = _minimumClaimThreshold;
        UNISWAP_ROUTER = _uniswapRouter;
        INTERMEDIATE_TOKEN = _intermediateToken;

        if (_maxSlippage > 5000) revert InvalidSlippage(); // Max 50%
        maxSlippage = _maxSlippage;

        // Set up default path for asset (no swap needed)
        address[] memory directPath = new address[](1);
        directPath[0] = address(ASSET);
        swapPaths[address(ASSET)] = directPath;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposits assets into the autocompounder
    /// @param assets Amount of assets to deposit
    /// @param receiver Address that will receive autocompounder shares
    /// @return shares Number of shares minted
    function deposit(uint256 assets, address receiver) external nonReentrant returns (uint256 shares) {
        if (assets == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        // Calculate shares to mint
        shares = _convertToShares(assets);

        // Transfer assets from user to this contract
        if (!ASSET.transferFrom(msg.sender, address(this), assets)) revert TransferFailed();

        // Approve and deposit into vault
        ASSET.approve(address(VAULT), assets);
        VAULT.deposit(assets, address(this));

        // Mint autocompounder shares
        _mint(receiver, shares);

        // Update user info
        if (userInfo[receiver].depositTimestamp == 0) {
            userInfo[receiver].depositTimestamp = block.timestamp;
        }
        userInfo[receiver].totalDeposited += assets;

        emit Deposit(receiver, assets, shares);
    }

    /// @notice Withdraws assets from the autocompounder
    /// @param shares Number of shares to burn
    /// @param receiver Address that will receive the assets
    /// @return assets Amount of assets received
    function withdraw(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        if (shares > balanceOf[msg.sender]) revert InsufficientBalance();

        // Calculate assets to withdraw
        assets = _convertToAssets(shares);

        // Calculate vault shares BEFORE burning autocompounder shares
        uint256 vaultSharesToRedeem = _convertToVaultShares(shares);
        if (vaultSharesToRedeem == 0) revert InvalidAmount();

        // Burn autocompounder shares
        _burn(msg.sender, shares);

        // Withdraw from vault and transfer to receiver
        VAULT.redeem(vaultSharesToRedeem, receiver, address(this));

        // Update user info only if any remaining
        if (userInfo[msg.sender].totalDeposited > 0) {
            uint256 remainingShares = balanceOf[msg.sender];
            if (remainingShares == 0) {
                userInfo[msg.sender].totalDeposited = 0;
            } else {
                uint256 assetsReduction = assets.mulDivDown(
                    userInfo[msg.sender].totalDeposited,
                    remainingShares + shares
                );
                userInfo[msg.sender].totalDeposited -= assetsReduction;
            }
        }

        emit Withdraw(msg.sender, shares, assets);
    }

    /// @notice Mints exact autocompounder shares
    /// @param shares Exact number of shares to mint
    /// @param receiver Address that will receive shares
    /// @return assets Amount of assets required
    function mint(uint256 shares, address receiver) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        // Calculate required assets
        assets = _convertToAssets(shares);

        // Transfer assets from user to this contract
        if (!ASSET.transferFrom(msg.sender, address(this), assets)) revert TransferFailed();

        // Approve and deposit into vault
        ASSET.approve(address(VAULT), assets);
        VAULT.deposit(assets, address(this));

        // Mint autocompounder shares
        _mint(receiver, shares);

        // Update user info
        if (userInfo[receiver].depositTimestamp == 0) {
            userInfo[receiver].depositTimestamp = block.timestamp;
        }
        userInfo[receiver].totalDeposited += assets;

        emit Deposit(receiver, assets, shares);
    }

    /// @notice Redeems exact autocompounder shares
    /// @param shares Exact number of shares to burn
    /// @param receiver Address that will receive assets
    /// @param owner_ Owner of shares (for allowance)
    /// @return assets Amount of assets received
    function redeem(uint256 shares, address receiver, address owner_) external nonReentrant returns (uint256 assets) {
        if (shares == 0) revert InvalidAmount();
        if (receiver == address(0)) revert InvalidReceiver();

        // Check allowances if not the owner
        if (msg.sender != owner_) {
            uint256 allowed = allowance[owner_][msg.sender];
            if (allowed != type(uint256).max) {
                allowance[owner_][msg.sender] = allowed - shares;
            }
        }

        if (shares > balanceOf[owner_]) revert InsufficientBalance();

        // Calculate assets to withdraw
        assets = _convertToAssets(shares);

        // Calculate vault shares to redeem
        uint256 vaultSharesToRedeem = _convertToVaultShares(shares);
        if (vaultSharesToRedeem == 0) revert InvalidAmount();

        // Burn autocompounder shares
        _burn(owner_, shares);

        // Withdraw from vault and transfer to receiver
        VAULT.redeem(vaultSharesToRedeem, receiver, address(this));

        // Update user info
        if (userInfo[owner_].totalDeposited > 0) {
            uint256 remainingShares = balanceOf[owner_];
            if (remainingShares == 0) {
                userInfo[owner_].totalDeposited = 0;
            } else {
                uint256 assetsReduction = assets.mulDivDown(userInfo[owner_].totalDeposited, remainingShares + shares);
                userInfo[owner_].totalDeposited -= assetsReduction;
            }
        }

        emit Withdraw(owner_, assets, shares);
    }

    /*///////////////////////////////////////////////////////////////
                           AUTO-COMPOUND LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Performs auto-compounding by claiming all rewards and swapping them to asset
    /// @dev This function claims rewards, swaps them via Uniswap, then reinvests in the vault
    function autoCompound() external nonReentrant {
        // Claim all available rewards for this contract
        VAULT.claimAllRewards();

        uint256 totalAssetsToReinvest = 0;
        uint256 swapCount = 0;

        // Get the list of reward tokens from the vault
        uint256 rewardTokensLength = VAULT.getRewardTokensLength();

        for (uint256 i = 0; i < rewardTokensLength; i++) {
            address rewardToken = VAULT.rewardTokens(i);
            uint256 rewardBalance = IERC20(rewardToken).balanceOf(address(this));

            if (rewardBalance >= minimumClaimThreshold) {
                uint256 assetsObtained;

                // If reward token is already the vault's asset, no swap needed
                if (rewardToken == address(ASSET)) {
                    assetsObtained = rewardBalance;
                } else {
                    // Swap reward token to vault asset
                    assetsObtained = _swapRewardToAsset(rewardToken, rewardBalance);
                    if (assetsObtained > 0) {
                        swapCount++;
                    }
                }

                totalAssetsToReinvest += assetsObtained;
            }
        }

        // Reinvest all obtained assets in the vault
        if (totalAssetsToReinvest > 0) {
            ASSET.approve(address(VAULT), totalAssetsToReinvest);
            VAULT.deposit(totalAssetsToReinvest, address(this));
        }

        emit AutoCompound(totalAssetsToReinvest, swapCount);
    }

    /// @notice Allows users to claim their rewards proportionally
    /// @dev Simplified - claims all rewards and distributes them proportionally
    function claimUserRewards() external nonReentrant {
        uint256 userShares = balanceOf[msg.sender];
        if (userShares == 0) revert InvalidAmount();

        // Calculate user's proportion
        uint256 userProportion = userShares.mulDivDown(1e18, totalSupply);

        // Claim all vault rewards
        VAULT.claimAllRewards();

        // For simplicity, just transfer proportion of available assets
        uint256 availableAssets = ASSET.balanceOf(address(this));
        if (availableAssets > 0) {
            uint256 userReward = availableAssets.mulDivDown(userProportion, 1e18);
            if (userReward > 0) {
                if (!ASSET.transfer(msg.sender, userReward)) revert TransferFailed();
                emit RewardsClaimed(msg.sender, address(ASSET), userReward);
            }
        }
    }

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns the total amount of managed assets
    function totalAssets() public view returns (uint256) {
        return VAULT.assetsOf(address(this));
    }

    /// @notice Returns user's assets
    function assetsOf(address user) public view returns (uint256) {
        return _convertToAssets(balanceOf[user]);
    }

    /// @notice Returns current exchange rate (autocompounder shares / assets)
    function exchangeRate() public view returns (uint256) {
        if (totalSupply == 0) return 1e18;
        return totalAssets().mulDivDown(1e18, totalSupply);
    }

    /// @notice Returns user information
    function getUserInfo(address user) external view returns (uint256 depositTimestamp, uint256 totalDeposited) {
        UserInfo memory info = userInfo[user];
        return (info.depositTimestamp, info.totalDeposited);
    }

    /// @notice Returns if user can withdraw (based on vault's lock period)
    function canWithdraw(address user) external view returns (bool) {
        return VAULT.isUnlocked(user);
    }

    /*///////////////////////////////////////////////////////////////
                           INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _convertToShares(uint256 assets) internal view returns (uint256) {
        if (totalSupply == 0) return assets;
        return assets.mulDivDown(totalSupply, totalAssets());
    }

    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        if (totalSupply == 0) return shares;
        return shares.mulDivDown(totalAssets(), totalSupply);
    }

    function _convertToVaultShares(uint256 autocompounderShares) internal view returns (uint256) {
        if (totalSupply == 0) return 0;
        uint256 vaultBalance = VAULT.balanceOf(address(this));
        return autocompounderShares.mulDivDown(vaultBalance, totalSupply);
    }

    function _mint(address to, uint256 amount) internal {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }

    function _burn(address from, uint256 amount) internal {
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }

    /// @notice Swaps a reward token to vault asset via Uniswap
    /// @param rewardToken Address of reward token to swap
    /// @param amount Amount to swap
    /// @return assetsObtained Amount of assets obtained after swap
    function _swapRewardToAsset(address rewardToken, uint256 amount) internal returns (uint256 assetsObtained) {
        address[] memory path = swapPaths[rewardToken];

        // If no path is configured, try default path via intermediate token
        if (path.length == 0) {
            path = _getDefaultSwapPath(rewardToken);
        }

        // If still no valid path, skip this token
        if (path.length < 2 || path[path.length - 1] != address(ASSET)) {
            return 0;
        }

        // Approve token for Uniswap router
        IERC20(rewardToken).approve(address(UNISWAP_ROUTER), amount);

        // Calculate minimum expected amount with slippage
        uint256[] memory amountsOut = UNISWAP_ROUTER.getAmountsOut(amount, path);
        uint256 amountOutMin = (amountsOut[amountsOut.length - 1] * (10000 - maxSlippage)) / 10000;

        try
            UNISWAP_ROUTER.swapExactTokensForTokens(
                amount,
                amountOutMin,
                path,
                address(this),
                block.timestamp + 300 // 5 minutes deadline
            )
        returns (uint256[] memory amounts) {
            assetsObtained = amounts[amounts.length - 1];
            emit TokenSwapped(rewardToken, address(ASSET), amount, assetsObtained);
        } catch {
            // If swap fails, continue without this token
            assetsObtained = 0;
        }
    }

    /// @notice Generates default swap path via intermediate token
    /// @param rewardToken Reward token to swap
    /// @return path Default swap path
    function _getDefaultSwapPath(address rewardToken) internal view returns (address[] memory path) {
        if (rewardToken == address(ASSET)) {
            // If it's already the asset, direct path
            path = new address[](1);
            path[0] = address(ASSET);
        } else if (rewardToken == INTERMEDIATE_TOKEN) {
            // If it's the intermediate token, direct swap to asset
            path = new address[](2);
            path[0] = rewardToken;
            path[1] = address(ASSET);
        } else {
            // Otherwise, swap via intermediate token
            path = new address[](3);
            path[0] = rewardToken;
            path[1] = INTERMEDIATE_TOKEN;
            path[2] = address(ASSET);
        }
    }

    /*///////////////////////////////////////////////////////////////
                            ERC20 FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function transfer(address to, uint256 amount) external override returns (bool) {
        if (to == address(0)) revert InvalidReceiver();

        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external override returns (bool) {
        if (to == address(0)) revert InvalidReceiver();

        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }

        balanceOf[from] -= amount;
        balanceOf[to] += amount;

        emit Transfer(from, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external override returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    /// @notice Returns the number of decimals
    function decimals() external view returns (uint8) {
        return DECIMALS;
    }

    /*///////////////////////////////////////////////////////////////
                           ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Updates minimum threshold for auto-compound
    function setMinimumClaimThreshold(uint256 newThreshold) external onlyOwner {
        minimumClaimThreshold = newThreshold;
    }

    /// @notice Updates maximum allowed slippage
    /// @param newSlippage New slippage in basis points (e.g., 300 = 3%)
    function setMaxSlippage(uint256 newSlippage) external onlyOwner {
        if (newSlippage > 5000) revert InvalidSlippage(); // Max 50%
        maxSlippage = newSlippage;
    }

    /// @notice Configures swap path for a specific reward token
    /// @param rewardToken Address of reward token
    /// @param path Swap path to asset (must start with rewardToken and end with ASSET)
    function setSwapPath(address rewardToken, address[] calldata path) external onlyOwner {
        if (path.length < 2) revert InvalidSwapPath();
        if (path[0] != rewardToken) revert InvalidSwapPath();
        if (path[path.length - 1] != address(ASSET)) revert InvalidSwapPath();

        swapPaths[rewardToken] = path;
        emit SwapPathUpdated(rewardToken, path);
    }

    /// @notice Removes a configured swap path (uses default path)
    /// @param rewardToken Address of reward token
    function removeSwapPath(address rewardToken) external onlyOwner {
        delete swapPaths[rewardToken];
        address[] memory emptyPath = new address[](0);
        emit SwapPathUpdated(rewardToken, emptyPath);
    }

    /// @notice Tests a swap to verify it works
    /// @param rewardToken Token to test
    /// @param amount Amount to test
    /// @return amountOut Estimated output amount
    function testSwap(address rewardToken, uint256 amount) external view returns (uint256 amountOut) {
        address[] memory path = swapPaths[rewardToken];
        if (path.length == 0) {
            path = _getDefaultSwapPath(rewardToken);
        }

        if (path.length < 2) return 0;

        try UNISWAP_ROUTER.getAmountsOut(amount, path) returns (uint256[] memory amounts) {
            amountOut = amounts[amounts.length - 1];
        } catch {
            amountOut = 0;
        }
    }

    /// @notice Returns configured swap path for a token
    /// @param rewardToken Address of reward token
    /// @return path Configured swap path
    function getSwapPath(address rewardToken) external view returns (address[] memory path) {
        path = swapPaths[rewardToken];
        if (path.length == 0) {
            path = _getDefaultSwapPath(rewardToken);
        }
    }

    /// @notice Transfers contract ownership
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert InvalidNewOwner();
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /// @notice Emergency function to recover stuck tokens
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        if (!IERC20(token).transfer(owner, amount)) revert TransferFailed();
    }

    /*///////////////////////////////////////////////////////////////
                        IAutoCompounder COMPATIBILITY
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns underlying asset address (for IAutoCompounder compatibility)
    function asset() external view returns (address) {
        return address(ASSET);
    }

    /// @notice Returns related vault address (for IAutoCompounder compatibility)
    function vault() external view returns (address) {
        return address(VAULT);
    }

    /// @notice ERC165 interface support check
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IRewardsVaultAutoCompounder).interfaceId || super.supportsInterface(interfaceId);
    }
}
