// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./IERC4626.sol";
import "../math/FixedPointMathLib.sol";
import "./IERC20.sol";

/// @title RewardsVault4626
/// @notice ERC4626 compliant vault with rewards distribution and lock period functionality
/// @dev Converts the original Vault contract to be ERC4626 compliant with ERC20 interactions
contract RewardsVault4626 is IERC4626 {
    using FixedPointMathLib for uint256;

    /*///////////////////////////////////////////////////////////////
                            STORAGE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice The underlying asset token
    IERC20 public immutable asset;

    /// @notice Lock period in seconds
    uint256 public immutable lockPeriod;

    /// @notice Contract owner
    address public owner;

    /// @notice Array of reward token addresses
    address[] public rewardTokens;

    /// @notice Total amount of underlying assets in the vault
    uint256 private _totalAssets;

    /*///////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct UserInfo {
        uint256 lockTimeStart;
        mapping(address => uint256) lastClaimedAmountPerToken;
        bool exists;
    }

    struct RewardInfo {
        uint256 amount;
        bool exists;
    }

    /*///////////////////////////////////////////////////////////////
                                MAPPINGS
    //////////////////////////////////////////////////////////////*/

    /// @notice User information mapping
    mapping(address => UserInfo) public userInfo;

    /// @notice Reward token information mapping
    mapping(address => RewardInfo) public rewardInfo;

    /*///////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event RewardAdded(address indexed token, uint256 amount);
    event RewardClaimed(address indexed user, address indexed token, uint256 amount);
    event RewardTokenRegistered(address indexed token);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /*///////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "Not authorized");
        _;
    }

    /*///////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        IERC20 _asset,
        string memory _name,
        string memory _symbol,
        uint8 _decimals,
        uint256 _lockPeriod,
        address _owner
    ) ERC20(_name, _symbol, _decimals) {
        asset = _asset;
        lockPeriod = _lockPeriod;
        owner = _owner;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Deposits assets and returns shares
    function deposit(uint256 assets, address receiver) public virtual override returns (uint256 shares) {
        require(assets > 0, "Cannot deposit 0");
        require(receiver != address(0), "Invalid receiver");

        // Calculate shares to mint
        shares = previewDeposit(assets);

        // Update user info
        _updateUserRewards(receiver);

        // Transfer assets from caller to vault
        require(asset.transferFrom(msg.sender, address(this), assets), "Transfer failed");

        // Mint shares to receiver
        _mint(receiver, shares);

        // Update total assets
        _totalAssets += assets;

        // Set lock time if first deposit
        if (!userInfo[receiver].exists) {
            userInfo[receiver].lockTimeStart = block.timestamp;
            userInfo[receiver].exists = true;
            _initializeUserRewards(receiver);
        }
        // Note: Lock time is NOT reset on subsequent deposits to prevent lock extension attacks

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Mints shares and returns assets needed
    function mint(uint256 shares, address receiver) public virtual override returns (uint256 assets) {
        require(shares > 0, "Cannot mint 0");

        assets = previewMint(shares);

        // Update user info
        _updateUserRewards(receiver);

        // Transfer assets from caller to vault
        require(asset.transferFrom(msg.sender, address(this), assets), "Transfer failed");

        // Mint shares to receiver
        _mint(receiver, shares);

        // Update total assets
        _totalAssets += assets;

        // Set lock time if first deposit
        if (!userInfo[receiver].exists) {
            userInfo[receiver].lockTimeStart = block.timestamp;
            userInfo[receiver].exists = true;
            _initializeUserRewards(receiver);
        }
        // Note: Lock time is NOT reset on subsequent deposits to prevent lock extension attacks

        emit Deposit(msg.sender, receiver, assets, shares);
    }

    /// @notice Withdraws assets and burns shares
    function withdraw(
        uint256 assets,
        address receiver,
        address owner_
    ) public virtual override returns (uint256 shares) {
        require(assets > 0, "Cannot withdraw 0");
        require(_isUnlocked(owner_), "Assets are still locked");

        shares = previewWithdraw(assets);

        // Check allowance if not owner
        if (msg.sender != owner_) {
            uint256 allowed = allowance[owner_][msg.sender];
            if (allowed != type(uint256).max) {
                allowance[owner_][msg.sender] = allowed - shares;
            }
        }

        // Claim all rewards before withdrawal
        _claimAllRewards(owner_);

        // Burn shares from owner
        _burn(owner_, shares);

        // Update total assets
        _totalAssets -= assets;

        // Transfer assets to receiver
        require(asset.transfer(receiver, assets), "Transfer failed");

        emit Withdraw(msg.sender, receiver, assets, shares);
    }

    /// @notice Redeems shares and returns assets
    function redeem(uint256 shares, address receiver, address owner_) public virtual override returns (uint256 assets) {
        require(shares > 0, "Cannot redeem 0");
        require(_isUnlocked(owner_), "Assets are still locked");

        assets = previewRedeem(shares);

        // Check allowance if not owner
        if (msg.sender != owner_) {
            uint256 allowed = allowance[owner_][msg.sender];
            if (allowed != type(uint256).max) {
                allowance[owner_][msg.sender] = allowed - shares;
            }
        }

        // Claim all rewards before redemption
        _claimAllRewards(owner_);

        // Burn shares from owner
        _burn(owner_, shares);

        // Update total assets
        _totalAssets -= assets;

        // Transfer assets to receiver
        require(asset.transfer(receiver, assets), "Transfer failed");

        emit Withdraw(msg.sender, receiver, assets, shares);
    }

    /*///////////////////////////////////////////////////////////////
                            ACCOUNTING LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Returns total assets managed by vault
    function totalAssets() public view virtual override returns (uint256) {
        return _totalAssets;
    }

    /// @notice Returns assets owned by user
    function assetsOf(address user) public view virtual override returns (uint256) {
        return _convertToAssetsDown(balanceOf[user]);
    }

    /// @notice Returns assets per share
    function assetsPerShare() public view virtual override returns (uint256) {
        return _convertToAssetsDown(10 ** decimals);
    }

    /// @notice Preview deposit calculation
    function previewDeposit(uint256 assets) public view virtual override returns (uint256) {
        return _convertToSharesDown(assets);
    }

    /// @notice Preview mint calculation
    function previewMint(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssetsUp(shares);
    }

    /// @notice Preview withdraw calculation
    function previewWithdraw(uint256 assets) public view virtual override returns (uint256) {
        return _convertToSharesUp(assets);
    }

    /// @notice Preview redeem calculation
    function previewRedeem(uint256 shares) public view virtual override returns (uint256) {
        return _convertToAssetsDown(shares);
    }

    /*///////////////////////////////////////////////////////////////
                          MAXIMUM LOGIC
    //////////////////////////////////////////////////////////////*/

    function maxDeposit(address) public pure virtual override returns (uint256) {
        return type(uint256).max;
    }

    function maxMint(address) public pure virtual override returns (uint256) {
        return type(uint256).max;
    }

    function maxWithdraw(address owner_) public view virtual override returns (uint256) {
        if (!_isUnlocked(owner_)) return 0;
        return _convertToAssetsDown(balanceOf[owner_]);
    }

    function maxRedeem(address owner_) public view virtual override returns (uint256) {
        if (!_isUnlocked(owner_)) return 0;
        return balanceOf[owner_];
    }

    /*///////////////////////////////////////////////////////////////
                        REWARDS LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Add reward tokens to the vault
    function addReward(address token, uint256 amount) external onlyOwner {
        _addRewardInternal(token, amount);
    }

    /// @notice Claim all available rewards for the caller
    function claimAllRewards() external {
        _claimAllRewards(msg.sender);
    }

    /// @notice Claim specific reward tokens
    function claimSpecificsReward(address[] memory tokens) external returns (uint256) {
        for (uint256 i = 0; i < tokens.length; i++) {
            _claimReward(msg.sender, tokens[i]);
        }
        return tokens.length;
    }

    /// @notice Get claimable reward amount for a specific token
    function getClaimableReward(address user, address token) external view returns (uint256) {
        if (!rewardInfo[token].exists || balanceOf[user] == 0) return 0;

        uint256 amount = rewardInfo[token].amount;
        uint256 lastClaimed = userInfo[user].lastClaimedAmountPerToken[token];

        return (amount - lastClaimed).mulDivDown(balanceOf[user], 1e18);
    }

    /*///////////////////////////////////////////////////////////////
                        LOCK PERIOD LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if user's assets are unlocked
    function isUnlocked(address user) external view returns (bool) {
        return _isUnlocked(user);
    }

    /// @notice Get time remaining until unlock
    function getTimeUntilUnlock(address user) external view returns (uint256) {
        if (!userInfo[user].exists) return 0;

        uint256 unlockTime = userInfo[user].lockTimeStart + lockPeriod;
        if (block.timestamp >= unlockTime) return 0;

        return unlockTime - block.timestamp;
    }

    /// @notice Unlock and withdraw (mimics original Vault's unlock function)
    function unlock(uint256 startPosition, uint256 assets) external returns (uint256, uint256, uint256) {
        require(userInfo[msg.sender].exists, "User has no deposits");
        require(_isUnlocked(msg.sender), "You can't unlock your token because the lock period is not reached");

        // Claim rewards with pagination (process 10 rewards at a time)
        uint256 endPosition = startPosition + 10;
        if (endPosition > rewardTokens.length) {
            endPosition = rewardTokens.length;
        }

        for (uint256 i = startPosition; i < endPosition; i++) {
            _claimReward(msg.sender, rewardTokens[i]);
        }

        // Then withdraw the assets
        uint256 shares = previewWithdraw(assets);
        _burn(msg.sender, shares);
        _totalAssets -= assets;
        require(asset.transfer(msg.sender, assets), "Transfer failed");

        emit Withdraw(msg.sender, msg.sender, assets, shares);

        return (block.timestamp, userInfo[msg.sender].lockTimeStart, lockPeriod);
    }

    /*///////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get number of reward tokens
    function getRewardTokensLength() external view returns (uint256) {
        return rewardTokens.length;
    }

    /// @notice Get user's locked amount (in assets)
    function getLockedAmount(address user) external view returns (uint256) {
        return assetsOf(user);
    }

    /// @notice Get total value locked (TVL)
    function getTVL() external view returns (uint256) {
        return totalAssets();
    }

    /*///////////////////////////////////////////////////////////////
                        OWNERSHIP LOGIC
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfer ownership of the vault
    /// @param newOwner The new owner address
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /*///////////////////////////////////////////////////////////////
                          INTERNAL LOGIC
    //////////////////////////////////////////////////////////////*/

    function _convertToSharesDown(uint256 assets) internal view returns (uint256) {
        if (totalSupply == 0) return assets;
        return assets.mulDivDown(totalSupply, totalAssets());
    }

    function _convertToSharesUp(uint256 assets) internal view returns (uint256) {
        if (totalSupply == 0) return assets;
        return assets.mulDivUp(totalSupply, totalAssets());
    }

    function _convertToAssetsDown(uint256 shares) internal view returns (uint256) {
        if (totalSupply == 0) return shares;
        return shares.mulDivDown(totalAssets(), totalSupply);
    }

    function _convertToAssetsUp(uint256 shares) internal view returns (uint256) {
        if (totalSupply == 0) return shares;
        return shares.mulDivUp(totalAssets(), totalSupply);
    }

    function _isUnlocked(address user) internal view returns (bool) {
        if (!userInfo[user].exists) return true;
        return block.timestamp >= userInfo[user].lockTimeStart + lockPeriod;
    }

    function _updateUserRewards(address user) internal {
        if (!userInfo[user].exists) return;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _claimReward(user, rewardTokens[i]);
        }
    }

    function _initializeUserRewards(address user) internal {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address token = rewardTokens[i];
            userInfo[user].lastClaimedAmountPerToken[token] = rewardInfo[token].amount;
        }
    }

    function _claimAllRewards(address user) internal {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _claimReward(user, rewardTokens[i]);
        }
    }

    function _claimReward(address user, address token) internal {
        if (!rewardInfo[token].exists || balanceOf[user] == 0) return;

        uint256 amount = rewardInfo[token].amount;
        uint256 lastClaimed = userInfo[user].lastClaimedAmountPerToken[token];

        if (amount > lastClaimed) {
            uint256 reward = (amount - lastClaimed).mulDivDown(balanceOf[user], 1e18);

            if (reward > 0) {
                userInfo[user].lastClaimedAmountPerToken[token] = amount;
                require(IERC20(token).transfer(user, reward), "Transfer failed");
                emit RewardClaimed(user, token, reward);
            }
        }
    }

    function _addRewardInternal(address token, uint256 amount) internal {
        require(token != address(0), "Invalid token address");
        require(token != address(asset), "Cannot add underlying asset as reward");
        require(amount > 0, "Amount must be greater than 0");
        require(totalSupply > 0, "No shares minted yet");

        IERC20 rewardToken = IERC20(token);

        // Calculate reward per share using original Vault logic
        uint256 perShareRewards = amount.mulDivDown(1e18, totalSupply);

        // Register token if not exists
        if (!rewardInfo[token].exists) {
            rewardTokens.push(token);
            rewardInfo[token].exists = true;
            rewardInfo[token].amount = perShareRewards;
            emit RewardTokenRegistered(token);
        } else {
            rewardInfo[token].amount += perShareRewards;
        }

        // Transfer rewards to vault
        require(rewardToken.transferFrom(msg.sender, address(this), amount), "Transfer failed");

        emit RewardAdded(token, amount);
    }
}
