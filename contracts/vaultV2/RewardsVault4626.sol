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

    /// @notice Minimum time deposits must be held before being eligible for rewards (anti-frontrun)
    uint256 public constant REWARD_ELIGIBILITY_DELAY = 1 hours;

    /// @notice Hard cap on the number of distinct reward tokens to prevent
    ///         deposit/withdraw loops from exceeding the block gas limit.
    uint256 public constant MAX_REWARD_TOKENS = 50;

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

        // Anti-frontrunning: user must have held shares for minimum delay before claiming rewards
        if (block.timestamp < userInfo[user].lockTimeStart + REWARD_ELIGIBILITY_DELAY) return 0;

        uint256 amount = rewardInfo[token].amount;
        uint256 lastClaimed = userInfo[user].lastClaimedAmountPerToken[token];

        return (amount - lastClaimed).mulDivDown(balanceOf[user], 1e18);
    }

    /// @notice Get user's rewards for all reward tokens
    /// @param user Address of the user
    /// @return tokens Array of reward token addresses
    /// @return amounts Array of claimable reward amounts corresponding to each token
    function getUserReward(address user) external view returns (address[] memory tokens, uint256[] memory amounts) {
        uint256 length = rewardTokens.length;
        tokens = new address[](length);
        amounts = new uint256[](length);

        // Anti-frontrunning: user must have held shares for minimum delay before claiming rewards
        bool isEligible = block.timestamp >= userInfo[user].lockTimeStart + REWARD_ELIGIBILITY_DELAY;

        for (uint256 i = 0; i < length; i++) {
            address token = rewardTokens[i];
            tokens[i] = token;

            if (!rewardInfo[token].exists || balanceOf[user] == 0 || !isEligible) {
                amounts[i] = 0;
            } else {
                uint256 amount = rewardInfo[token].amount;
                uint256 lastClaimed = userInfo[user].lastClaimedAmountPerToken[token];
                amounts[i] = (amount - lastClaimed).mulDivDown(balanceOf[user], 1e18);
            }
        }
    }

    /*///////////////////////////////////////////////////////////////
                        ERC20 TRANSFER OVERRIDES
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfer shares with proper reward checkpoint synchronization
    /// @dev Overrides ERC20 transfer to prevent lock bypass and reward theft
    function transfer(address to, uint256 amount) public override returns (bool) {
        require(_isUnlocked(msg.sender), "Shares are locked");

        // Claim sender's rewards before transfer
        _claimAllRewards(msg.sender);

        // Sync recipient's userInfo before receiving shares
        _syncOnTransfer(msg.sender, to);

        // Perform the transfer
        balanceOf[msg.sender] -= amount;
        unchecked {
            balanceOf[to] += amount;
        }

        emit Transfer(msg.sender, to, amount);
        return true;
    }

    /// @notice Transfer shares from another address with proper reward checkpoint synchronization
    /// @dev Overrides ERC20 transferFrom to prevent lock bypass and reward theft
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        require(_isUnlocked(from), "Shares are locked");

        // Check and update allowance
        uint256 allowed = allowance[from][msg.sender];
        if (allowed != type(uint256).max) {
            allowance[from][msg.sender] = allowed - amount;
        }

        // Claim sender's rewards before transfer
        _claimAllRewards(from);

        // Sync recipient's userInfo before receiving shares
        _syncOnTransfer(from, to);

        // Perform the transfer
        balanceOf[from] -= amount;
        unchecked {
            balanceOf[to] += amount;
        }

        emit Transfer(from, to, amount);
        return true;
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

    /// @notice Synchronize recipient's userInfo on share transfer
    /// @dev Initializes reward checkpoints to current state to prevent historical reward theft
    /// @param from The sender address (used for lock time inheritance)
    /// @param to The recipient address
    function _syncOnTransfer(address from, address to) internal {
        // If recipient doesn't exist, initialize their userInfo
        if (!userInfo[to].exists) {
            userInfo[to].exists = true;
            // Inherit lock time from sender to prevent lock bypass
            // Recipient must wait until sender's original lock expires
            userInfo[to].lockTimeStart = userInfo[from].lockTimeStart;
            // Initialize reward checkpoints to current amounts (no historical rewards)
            _initializeUserRewards(to);
        } else {
            // Recipient already exists - claim their pending rewards before receiving more shares
            _claimAllRewards(to);
        }
    }

    function _claimAllRewards(address user) internal {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            _claimReward(user, rewardTokens[i]);
        }
    }

    function _claimReward(address user, address token) internal {
        if (!rewardInfo[token].exists || balanceOf[user] == 0) return;

        // Anti-frontrunning: user must have held shares for minimum delay before claiming rewards
        if (block.timestamp < userInfo[user].lockTimeStart + REWARD_ELIGIBILITY_DELAY) return;

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

        // Calculate reward per share using original Vault logic.
        // If the amount is too small relative to totalSupply, perShareRewards
        // rounds down to zero and the tokens would be transferred but never
        // distributed; reject the call instead of silently stranding funds.
        uint256 perShareRewards = amount.mulDivDown(1e18, totalSupply);
        require(perShareRewards > 0, "Reward amount too small");

        // Register token if not exists
        if (!rewardInfo[token].exists) {
            require(rewardTokens.length < MAX_REWARD_TOKENS, "Max reward tokens reached");
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
