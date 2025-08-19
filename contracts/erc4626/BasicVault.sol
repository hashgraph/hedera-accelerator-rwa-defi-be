// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
pragma abicoder v2;

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {FeeConfiguration} from "../common/FeeConfiguration.sol";

import {FixedPointMathLib} from "../math/FixedPointMathLib.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {BasicVaultStorage} from "./BasicVaultStorage.sol";

/**
 * @title Basic Vault
 * @author Hashgraph
 *
 * The contract which represents a custom Vault.
 */
contract BasicVault is BasicVaultStorage, ERC20Permit, ERC4626, ERC165, FeeConfiguration, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using FixedPointMathLib for uint256;

    /**
     * @dev Initializes contract with passed parameters.
     *
     * @param underlying_ The address of the _asset token.
     * @param name_ The share token name.
     * @param symbol_ The share token symbol.
     * @param feeConfig_ The fee configuration struct.
     * @param vaultRewardController_ The Vault reward controller user.
     * @param feeConfigController_ The fee config controller user.
     * @param cliff_ The cliff date expressed in seconds.
     * @param unlockDuration_ The unlock duration expressed in seconds.
     */
    constructor(
        IERC20 underlying_,
        string memory name_,
        string memory symbol_,
        FeeConfig memory feeConfig_,
        address vaultRewardController_,
        address feeConfigController_,
        uint32 cliff_,
        uint32 unlockDuration_
    ) payable ERC20(name_, symbol_) ERC20Permit(name_) ERC4626(underlying_) Ownable(msg.sender) {
        BasicVaultData storage $ = _getBasicVaultStorage();

        __FeeConfiguration_init(feeConfig_, vaultRewardController_, feeConfigController_);

        $.cliff = cliff_;
        $.unlockDuration = unlockDuration_;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     *
     * @param assets The amount of staking token to send.
     * @param receiver The shares receiver address.
     * @return shares The amount of shares to receive.
     */
    function deposit(uint256 assets, address receiver) public override nonReentrant returns (uint256 shares) {
        require(receiver != address(0), "HederaVault: Invalid receiver address");

        uint256 maxAssets = maxDeposit(receiver);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxDeposit(receiver, assets, maxAssets);
        }

        require((shares = previewDeposit(assets)) != 0, "HederaVault: Zero shares");
        _deposit(_msgSender(), receiver, assets, shares);

        _afterDeposit(assets);
    }

    /**
     * @dev Mints shares to receiver by depositing assets of underlying tokens.
     *
     * @param shares The amount of shares to send.
     * @param receiver The receiver of tokens.
     * @return assets The amount of tokens to receive.
     */
    function mint(uint256 shares, address receiver) public override nonReentrant returns (uint256 assets) {
        require(receiver != address(0), "HederaVault: Invalid receiver address");

        uint256 maxShares = maxMint(receiver);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxMint(receiver, shares, maxShares);
        }

        require((assets = previewMint(shares)) != 0, "HederaVault: Zero shares");
        _deposit(_msgSender(), receiver, assets, shares);

        _afterDeposit(assets);
    }

    /**
     * @dev Burns shares from owner and sends assets of underlying tokens to receiver.
     *
     * @param assets The amount of assets.
     * @param receiver The staking token receiver.
     * @param owner The owner of shares.
     * @return shares The amount of shares to burn.
     */
    function withdraw(
        uint256 assets,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 shares) {
        require(receiver != address(0), "HederaVault: Invalid receiver address");

        uint256 maxAssets = maxWithdraw(owner);
        if (assets > maxAssets) {
            revert ERC4626ExceededMaxWithdraw(owner, assets, maxAssets);
        }

        _beforeWithdraw(assets);

        require((shares = previewWithdraw(assets)) != 0, "HederaVault: Zero shares");
        _withdraw(_msgSender(), receiver, owner, assets, shares);
    }

    /**
     * @dev Redeems shares for underlying assets.
     *
     * @param shares The amount of shares.
     * @param receiver The staking token receiver.
     * @param owner The shares owner.
     * @return assets The amount of shares to burn.
     */
    function redeem(
        uint256 shares,
        address receiver,
        address owner
    ) public override nonReentrant returns (uint256 assets) {
        require(receiver != address(0), "HederaVault: Invalid receiver address");

        uint256 maxShares = maxRedeem(owner);
        if (shares > maxShares) {
            revert ERC4626ExceededMaxRedeem(owner, shares, maxShares);
        }

        _beforeWithdraw(assets);

        require((assets = previewRedeem(shares)) != 0, "HederaVault: Zero assets");
        _withdraw(_msgSender(), receiver, owner, assets, shares);
    }

    /**
     * @dev Sets shares lock time.
     *
     * @param time The lock period.
     */
    function setSharesLockTime(uint32 time) external onlyOwner {
        BasicVaultData storage $ = _getBasicVaultStorage();

        $.unlockDuration = time;
        emit SetSharesLockTime(time);
    }

    /*///////////////////////////////////////////////////////////////
                         INTERNAL HOOKS LOGIC
    //////////////////////////////////////////////////////////////*/

    function _snapshotRewardAccrual(address user) internal {
        BasicVaultData storage $ = _getBasicVaultStorage();
        UserInfo storage userInfo = $.userContribution[user];

        address rewardToken;
        uint256 perShareCurrent;
        uint256 perShareClaimed;
        uint256 perShareDelta;
        uint256 pendingReward;

        for (uint256 i = 0; i < $.rewardTokens.length; ++i) {
            rewardToken = $.rewardTokens[i];
            RewardsInfo storage rewardInfo = $.tokensRewardInfo[rewardToken];

            perShareCurrent = rewardInfo.amount;
            perShareClaimed = userInfo.lastClaimedAmountT[rewardToken];
            perShareDelta = perShareCurrent > perShareClaimed ? perShareCurrent - perShareClaimed : 0;

            if (perShareDelta == 0 || userInfo.sharesAmount == 0) continue;

            // Snapshot the delta as a pending reward user can claim after exit
            pendingReward = (userInfo.sharesAmount * perShareDelta) / 1e18;

            // Save into snapshot storage
            userInfo.rewardAmountSnapshot[rewardToken] += pendingReward;

            // Mark as "claimed" from the per-share logic
            userInfo.lastClaimedAmountT[rewardToken] = perShareCurrent;
        }
    }

    /**
     * @dev Updates user state according to withdraw inputs.
     *
     * @param _amount The amount of shares.
     */
    function _beforeWithdraw(uint256 _amount) internal {
        _snapshotRewardAccrual(msg.sender);

        BasicVaultData storage $ = _getBasicVaultStorage();

        $.userContribution[msg.sender].sharesAmount -= _amount;
        $.userContribution[msg.sender].totalReleased += _amount;
    }

    /**
     * @dev Updates user state after deposit and mint calls.
     *
     * @param amount The amount of shares.
     */
    function _afterDeposit(uint256 amount) internal {
        BasicVaultData storage $ = _getBasicVaultStorage();
        if (!$.userContribution[msg.sender].exist) {
            uint256 rewardTokensSize = $.rewardTokens.length;
            address rewardToken;
            for (uint256 i; i < rewardTokensSize; i++) {
                rewardToken = $.rewardTokens[i];
                $.userContribution[msg.sender].lastClaimedAmountT[rewardToken] = $.tokensRewardInfo[rewardToken].amount;
            }
            $.userContribution[msg.sender].sharesAmount = amount;
            $.userContribution[msg.sender].totalLocked = amount;
            $.userContribution[msg.sender].depositLockCheckpoint = block.timestamp;
            $.userContribution[msg.sender].exist = true;
        } else {
            $.userContribution[msg.sender].sharesAmount += amount;
            $.userContribution[msg.sender].totalLocked += amount;
            $.userContribution[msg.sender].depositLockCheckpoint = block.timestamp;
        }
    }

    function _unlocked(address account) private view returns (uint256 unlocked) {
        BasicVaultData storage $ = _getBasicVaultStorage();

        UserInfo storage info = $.userContribution[account];

        uint256 currentlyLocked = info.totalLocked - info.totalReleased;

        uint256 lockStart = info.depositLockCheckpoint + $.cliff;

        if (block.timestamp < lockStart || currentlyLocked == 0) return 0;

        uint256 lockEnd = lockStart + $.unlockDuration;

        if (block.timestamp >= lockEnd) {
            unlocked = currentlyLocked;
        } else {
            uint256 elapsed = block.timestamp - lockStart;
            unlocked = (currentlyLocked * elapsed) / $.unlockDuration;
        }
    }

    /*///////////////////////////////////////////////////////////////
                        REWARDS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Adds reward to the Vault.
     *
     * @param _token The reward token address.
     * @param _amount The amount of reward token to add.
     */
    function addReward(address _token, uint256 _amount) external payable onlyRole(VAULT_REWARD_CONTROLLER_ROLE) {
        require(_amount != 0, "HederaVault: Amount can't be zero");
        require(_token != asset() && _token != address(this), "HederaVault: Reward and Staking tokens cannot be same");
        require(_token != address(0), "HederaVault: Invalid reward token");
        require(totalAssets() != 0, "HederaVault: No token staked yet");

        BasicVaultData storage $ = _getBasicVaultStorage();

        if ($.rewardTokens.length == 10) revert MaxRewardTokensAmount();

        uint256 perShareRewards = _amount.mulDivDown(1e18, totalAssets());
        RewardsInfo storage rewardInfo = $.tokensRewardInfo[_token];
        if (!rewardInfo.exist) {
            $.rewardTokens.push(_token);
            rewardInfo.exist = true;
            rewardInfo.amount = perShareRewards;
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        } else {
            $.tokensRewardInfo[_token].amount += perShareRewards;
            IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }
        emit RewardAdded(_token, _amount);
    }

    /**
     * @dev Claims exact reward for the caller.
     *
     * @param rewardToken The address of reward to claim.
     * @param receiver The reward receiver.
     * @param amount The amount to claim.
     */
    function claimExactReward(address rewardToken, address receiver, uint256 amount) public {
        BasicVaultData storage $ = _getBasicVaultStorage();

        address sender = _msgSender();

        require($.tokensRewardInfo[rewardToken].exist, "HederaVault: Incorrect reward token");

        uint256 reward = getUserReward(sender, rewardToken);

        require(reward >= amount, "HederaVault: Actual reward is less than passed");

        uint256 shares = $.userContribution[sender].sharesAmount;

        if (shares > 0) {
            uint256 perShareClaimed = amount.mulDivDown(1e18, shares);
            $.userContribution[sender].lastClaimedAmountT[rewardToken] += perShareClaimed;
        }

        // Reduce claimed from snapshot
        uint256 snapshotAmount = $.userContribution[sender].rewardAmountSnapshot[rewardToken];
        if (snapshotAmount > 0) {
            if (snapshotAmount >= amount) {
                $.userContribution[sender].rewardAmountSnapshot[rewardToken] -= amount;
            } else {
                $.userContribution[sender].rewardAmountSnapshot[rewardToken] = 0;
            }
        }

        // Fee management
        if (feeConfig.token != address(0)) amount = _deductFee(amount);

        IERC20(rewardToken).safeTransfer(receiver, amount);

        emit RewardClaimed(rewardToken, receiver, amount);
    }

    /**
     * @dev Claims all pending reward tokens for the caller.
     *
     * @param _startPosition The starting index in the reward token list from which to begin claiming rewards.
     * @return The index of the start position after the last claimed reward and the total number of reward tokens.
     */
    function claimAllReward(uint256 _startPosition, address receiver) public returns (uint256, uint256) {
        BasicVaultData storage $ = _getBasicVaultStorage();

        uint256 _rewardTokensSize = $.rewardTokens.length;
        address _feeToken = feeConfig.token;
        address _rewardToken;
        uint256 _reward;

        require(_rewardTokensSize != 0, "HederaVault: No reward tokens exist");

        uint256 shares = $.userContribution[msg.sender].sharesAmount;

        for (uint256 i = _startPosition; i < _rewardTokensSize; i++) {
            _rewardToken = $.rewardTokens[i];

            _reward = getUserReward(msg.sender, _rewardToken);

            if (_reward == 0) continue;

            if (shares > 0) {
                uint256 perShareClaimed = _reward.mulDivDown(1e18, shares);
                $.userContribution[msg.sender].lastClaimedAmountT[_rewardToken] += perShareClaimed;
            }

            uint256 snapshotAmount = $.userContribution[msg.sender].rewardAmountSnapshot[_rewardToken];
            if (snapshotAmount > 0) {
                if (snapshotAmount >= _reward) {
                    $.userContribution[msg.sender].rewardAmountSnapshot[_rewardToken] -= _reward;
                } else {
                    $.userContribution[msg.sender].rewardAmountSnapshot[_rewardToken] = 0;
                }
            }

            // Fee management
            if (_feeToken != address(0)) {
                _reward = _deductFee(_reward);
            }

            IERC20(_rewardToken).safeTransfer(receiver, _reward);

            emit RewardClaimed(_rewardToken, receiver, _reward);
        }
        return (_startPosition, _rewardTokensSize);
    }

    /**
     * @dev Returns rewards for a user with fee considering.
     *
     * @param _user The user address.
     * @param _rewardToken The reward address.
     * @return unclaimedAmount The calculated rewards.
     */
    function getUserReward(address _user, address _rewardToken) public view returns (uint256 unclaimedAmount) {
        BasicVaultData storage $ = _getBasicVaultStorage();

        RewardsInfo storage _rewardInfo = $.tokensRewardInfo[_rewardToken];
        uint256 perShareAmount = _rewardInfo.amount;

        UserInfo storage cInfo = $.userContribution[_user];
        uint256 userStakingTokenTotal = cInfo.sharesAmount;

        // Get reward snapshot
        uint256 rewardSnapshot = cInfo.rewardAmountSnapshot[_rewardToken];

        // No pending or snapshot reward
        if (userStakingTokenTotal == 0 && rewardSnapshot == 0) return 0;

        if (userStakingTokenTotal == 0) {
            // Only snapshot reward remains
            unclaimedAmount = rewardSnapshot;
        } else {
            uint256 perShareClaimedAmount = cInfo.lastClaimedAmountT[_rewardToken];

            // Prevent underflow
            if (perShareClaimedAmount > perShareAmount) perShareClaimedAmount = perShareAmount;

            uint256 perShareUnclaimedAmount = perShareAmount - perShareClaimedAmount;
            uint256 currentUnclaimed = perShareUnclaimedAmount.mulDivDown(userStakingTokenTotal, 1e18);

            // Add pending snapshot reward (from past withdrawals)
            unclaimedAmount = currentUnclaimed + rewardSnapshot;
        }

        // Apply min threshold (e.g., 1 wei reward)
        if (unclaimedAmount == 0) unclaimedAmount = MIN_REWARD;

        // Fee deduction
        if (feeConfig.feePercentage > 0) {
            uint256 currentFee = _calculateFee(unclaimedAmount, feeConfig.feePercentage);
            unclaimedAmount -= currentFee;
        }

        // Cap the reward at the actual vault balance
        uint256 vaultBalance = IERC20(_rewardToken).balanceOf(address(this));
        if (unclaimedAmount > vaultBalance) {
            unclaimedAmount = vaultBalance;
        }
    }

    /**
     * @dev Returns the amount of locked shares.
     *
     * @param account The user address.
     * @return The amount of locked shares.
     */
    function lockedOf(address account) public view returns (uint256) {
        BasicVaultData storage $ = _getBasicVaultStorage();
        return
            $.userContribution[account].totalLocked - $.userContribution[account].totalReleased - unlockedOf(account);
    }

    /**
     * @dev Returns the amount of unlocked shares.
     *
     * @param account The user address.
     * @return The amount of unlocked shares.
     */
    function unlockedOf(address account) public view returns (uint256) {
        return _unlocked(account);
    }

    /**
     * @dev Returns all rewards for a user with fee considering.
     *
     * @param _user The user address.
     * @return _rewards The rewards array.
     */
    function getAllRewards(address _user) public view returns (uint256[] memory _rewards) {
        BasicVaultData storage $ = _getBasicVaultStorage();

        uint256 rewardsSize = $.rewardTokens.length;
        _rewards = new uint256[](rewardsSize);

        for (uint256 i = 0; i < rewardsSize; i++) {
            _rewards[i] = getUserReward(_user, $.rewardTokens[i]);
        }
    }

    /** @dev See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address owner) public view virtual override returns (uint256) {
        return _convertToAssets(unlockedOf(owner), Math.Rounding.Floor);
    }

    /** @dev See {IERC4626-maxRedeem}. */
    function maxRedeem(address owner) public view virtual override returns (uint256) {
        return unlockedOf(owner);
    }

    /**
     * @return The cliff time of the token vesting.
     */
    function cliff() external view returns (uint32) {
        BasicVaultData storage $ = _getBasicVaultStorage();
        return $.cliff;
    }

    /**
     * @return The unlock duration of the token vesting.
     */
    function unlockDuration() external view returns (uint32) {
        BasicVaultData storage $ = _getBasicVaultStorage();
        return $.unlockDuration;
    }

    /**
     * @dev Returns reward tokens addresses.
     *
     * @return Reward tokens.
     */
    function getRewardTokens() public view returns (address[] memory) {
        BasicVaultData storage $ = _getBasicVaultStorage();
        return $.rewardTokens;
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override(AccessControl, ERC165) returns (bool) {
        return interfaceId == type(IERC4626).interfaceId || super.supportsInterface(interfaceId);
    }

    /**
     * necessary override
     */
    function decimals() public view override(ERC20, ERC4626) returns (uint8) {
        return super.decimals();
    }
}
