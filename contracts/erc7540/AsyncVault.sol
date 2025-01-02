// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
pragma abicoder v2;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {IERC7540} from "./interfaces/IERC7540.sol";

import {ERC20} from "../erc4626/ERC20.sol";
import {FeeConfiguration} from "../common/FeeConfiguration.sol";

import {FixedPointMathLib} from "../erc4626/FixedPointMathLib.sol";
import {SafeTransferLib} from "../erc4626/SafeTransferLib.sol";

/**
 * @title Async Vault
 *
 * The contract which represents a custom Vault with Hedera HTS support
 * and async deposit/redeem functionality.
 */
contract AsyncVault is IERC7540, ERC20, FeeConfiguration, ReentrancyGuard, Ownable {
    using SafeTransferLib for ERC20;
    using FixedPointMathLib for uint256;
    using Bits for uint256;

    // Staking token
    ERC20 private immutable _asset;

    // Staked amount
    uint256 public assetTotalSupply;

    // Reward tokens
    address[] public rewardTokens;

    mapping(address => uint256) public deposits;

    mapping(address => uint256) public redeems;

    mapping(address => UserInfo) public userContribution;

    mapping(address => RewardsInfo) public tokensRewardInfo;

    struct RewardsInfo {
        uint256 amount;
        bool exist;
    }

    struct UserInfo {
        uint256 sharesAmount;
        mapping(address => uint256) lastClaimedAmountT;
        bool exist;
    }

    /**
     * @notice CreatedToken event.
     * @dev Emitted after contract initialization, when share token was deployed.
     *
     * @param createdToken The address of share token.
     */
    event CreatedToken(address indexed createdToken);

    /**
     * @notice ClaimDeposit event.
     * @dev Emitted after user claims the requested deposit amount.
     *
     * @param owner The owner address.
     * @param operator The operator address.
     * @param assets The deposited asset amount.
     * @param shares The claimed share amount.
     */
    event ClaimDeposit(address indexed owner, address indexed operator, uint256 assets, uint256 shares);

    /**
     * @notice ClaimDeposit event.
     * @dev Emitted after user claims the requested redeem amount.
     *
     * @param owner The owner address.
     * @param operator The operator address.
     * @param assets The redeemed asset amount.
     * @param shares The share amount.
     */
    event ClaimRedeem(address indexed owner, address indexed operator, uint256 assets, uint256 shares);

    /**
     * @notice DecreaseDepositRequest event.
     * @dev Emitted after user decreases the requested deposit amount.
     *
     * @param owner The owner address.
     * @param previousRequestedAssets The previous request amount.
     * @param newRequestedAssets The new request amount.
     */
    event DecreaseDepositRequest(
        address indexed owner,
        uint256 indexed previousRequestedAssets,
        uint256 newRequestedAssets
    );

    /**
     * @notice RewardAdded event.
     * @dev Emitted when permissioned user adds reward to the Vault.
     *
     * @param rewardToken The address of reward token.
     * @param amount The added reward token amount.
     */
    event RewardAdded(address indexed rewardToken, uint256 amount);

    /**
     * @notice The error is emitted when a user try to make a new redeem request
     * but there is lack of shares.
     */
    error MaxRedeemRequestExceeded(address controller, uint256 shares, uint256 maxShares);

    /**
     * @notice The error is emitted when a user try to make a new deposit request
     * and the deposited amount is grater than deposit limit.
     */
    error MaxDepositRequestExceeded(address controller, uint256 assets, uint256 maxDeposit);

    /**
     * @notice The error is emitted when a user try to make a new request
     * on behalf of someone else.
     */
    error ERC7540CantRequestDepositOnBehalfOf();

    /**
     * @notice The error is emitted when owner reaches the max reward tokens limit
     * during adding new one.
     */
    error MaxRewardTokensAmount();

    /**
     * @dev Initializes contract with passed parameters.
     *
     * @param _underlying The address of the asset token.
     * @param _name The share token name.
     * @param _symbol The share token symbol.
     * @param _feeConfig The fee configuration struct.
     * @param _vaultRewardController The Vault reward controller user.
     * @param _feeConfigController The fee config controller user.
     */
    constructor(
        ERC20 _underlying,
        string memory _name,
        string memory _symbol,
        FeeConfig memory _feeConfig,
        address _vaultRewardController,
        address _feeConfigController
    ) payable ERC20(_name, _symbol, _underlying.decimals()) Ownable(msg.sender) {
        __FeeConfiguration_init(_feeConfig, _vaultRewardController, _feeConfigController);

        _asset = _underlying;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/REDEEM ASYNC LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Updates state for tracking rewards data.
     *
     * @param shares The minted amount of shares.
     */
    function _afterClaimDeposit(uint256 shares) internal {
        if (!userContribution[msg.sender].exist) {
            userContribution[msg.sender].sharesAmount = shares;
            userContribution[msg.sender].exist = true;
            claimAllReward(0);
        } else {
            claimAllReward(0);
            userContribution[msg.sender].sharesAmount += shares;
        }
    }

    /**
     * @dev Updates state according to the validated redeem request.
     *
     * @param shares The amount of shares to redeem.
     * @param operator The operator address.
     * @param owner The owner address.
     */
    function _createRedeemRequest(uint256 shares, address operator, address owner) internal {
        redeems[owner] += shares;

        emit RedeemRequested(operator, owner, msg.sender, shares);
    }

    /**
     * @dev Burns shares and transfers assets to the owner.
     *
     * @param owner The request creator.
     * @param receiver The receiver address.
     */
    function _claimRedeem(address owner, address receiver) internal returns (uint256 assets) {
        uint256 amountToRedeem = redeems[owner];
        assets = previewClaimRedeem(owner);

        redeems[owner] = 0;
        userContribution[owner].sharesAmount -= amountToRedeem;

        assetTotalSupply -= assets;

        // Burn shares
        _burn(address(this), amountToRedeem);

        _asset.safeTransfer(owner, assets);

        emit ClaimRedeem(owner, receiver, assets, amountToRedeem);
    }

    /**
     * @dev Mints shares and transfers to the owner.
     *
     * @param owner The request creator.
     * @param receiver The receiver address.
     */
    function _claimDeposit(address owner, address receiver) internal returns (uint256 shares) {
        uint256 assets = deposits[owner];
        shares = previewClaimDeposit(owner);

        deposits[owner] = 0;

        _mint(receiver, shares);
        _afterClaimDeposit(shares);

        emit ClaimDeposit(owner, receiver, assets, shares);
    }

    /**
     * @dev Updates state according to the validated deposit request.
     *
     * @param assets The amount of assets to deposit.
     * @param operator The operator address.
     * @param owner The owner address.
     */
    function _createDepositRequest(uint256 assets, address operator, address owner) internal {
        deposits[owner] += assets;
        assetTotalSupply += assets;

        emit DepositRequested(operator, owner, msg.sender, assets);
    }

    /**
     * @inheritdoc IERC7540
     */
    function requestDeposit(uint256 assets, address operator, address owner) external override {
        require(assets != 0, "AsyncVault: Invalid asset amount");
        require(operator != address(0) && owner != address(0), "AsyncVault: Invalid owner address");

        if (msg.sender != owner) {
            revert ERC7540CantRequestDepositOnBehalfOf();
        }

        if (previewClaimDeposit(owner) > 0) {
            _claimDeposit(owner, owner);
        }

        if (assets > maxDepositRequest(owner)) {
            revert MaxDepositRequestExceeded(operator, assets, maxDepositRequest(owner));
        }

        _createDepositRequest(assets, operator, owner);

        _asset.safeTransferFrom(owner, address(this), assets);
    }

    /**
     * @inheritdoc IERC7540
     */
    function requestRedeem(uint256 shares, address operator, address owner) external override {
        require(shares != 0, "AsyncVault: Invalid share amount");
        require(operator != address(0) && owner != address(0), "AsyncVault: Invalid owner address");

        if (shares > maxRedeemRequest(owner)) {
            revert MaxRedeemRequestExceeded(operator, shares, maxRedeemRequest(owner));
        }

        if (previewClaimRedeem(owner) > 0) {
            _claimRedeem(owner, owner);
        }

        ERC20(address(this)).safeTransferFrom(owner, address(this), shares);

        // Create a new request
        _createRedeemRequest(shares, operator, owner);
    }

    /**
     * @dev Adds reward to the Vault.
     *
     * @param _token The reward token address.
     * @param _amount The amount of reward token to add.
     */
    function addReward(address _token, uint256 _amount) external payable onlyRole(VAULT_REWARD_CONTROLLER_ROLE) {
        require(_amount != 0, "AsyncVault: Amount can't be zero");
        require(
            _token != address(_asset) && _token != address(this),
            "AsyncVault: Reward and Staking tokens cannot be same"
        );
        require(_token != address(0), "AsyncVault: Invalid reward token");
        require(assetTotalSupply != 0, "AsyncVault: No token staked yet");

        if (rewardTokens.length == 10) revert MaxRewardTokensAmount();

        uint256 perShareRewards = _amount.mulDivDown(totalSupply + 1, totalAssets() + 1);
        RewardsInfo storage rewardInfo = tokensRewardInfo[_token];
        if (!rewardInfo.exist) {
            rewardTokens.push(_token);
            rewardInfo.exist = true;
            rewardInfo.amount = perShareRewards;
            ERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        } else {
            tokensRewardInfo[_token].amount += perShareRewards;
            ERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
        }
        emit RewardAdded(_token, _amount);
    }

    /**
     * @dev Claims all pending reward tokens for the caller.
     *
     * @param _startPosition The starting index in the reward token list from which to begin claiming rewards.
     * @return The index of the start position after the last claimed reward and the total number of reward tokens.
     */
    function claimAllReward(uint256 _startPosition) public payable returns (uint256, uint256) {
        uint256 rewardTokensSize = rewardTokens.length;
        address _feeToken = feeConfig.token;
        address _rewardToken;
        uint256 reward;

        require(rewardTokensSize != 0, "AsyncVault: No reward tokens exist");

        for (uint256 i = _startPosition; i < rewardTokensSize; i++) {
            _rewardToken = rewardTokens[i];

            reward = getUserReward(msg.sender, _rewardToken);
            userContribution[msg.sender].lastClaimedAmountT[_rewardToken] = tokensRewardInfo[_rewardToken].amount;

            // Fee management
            if (_feeToken != address(0)) {
                ERC20(_rewardToken).safeTransfer(msg.sender, _deductFee(reward));
            } else {
                ERC20(_rewardToken).safeTransfer(msg.sender, reward);
            }
        }
        return (_startPosition, rewardTokensSize);
    }

    /**
     * @dev Returns rewards for a user with fee considering.
     *
     * @param _user The user address.
     * @param _rewardToken The reward address.
     * @return unclaimedAmount The calculated rewards.
     */
    function getUserReward(address _user, address _rewardToken) public view returns (uint256 unclaimedAmount) {
        RewardsInfo storage _rewardInfo = tokensRewardInfo[_rewardToken];

        uint256 perShareAmount = _rewardInfo.amount;
        UserInfo storage cInfo = userContribution[_user];
        uint256 userStakingTokenTotal = cInfo.sharesAmount;
        uint256 perShareClaimedAmount = cInfo.lastClaimedAmountT[_rewardToken];
        uint256 perShareUnclaimedAmount = perShareAmount - perShareClaimedAmount;

        require(userStakingTokenTotal != 0, "AsyncVault: No staked tokens");

        unclaimedAmount = perShareUnclaimedAmount.mulDivDown(1, userStakingTokenTotal);

        if (feeConfig.feePercentage > 0) {
            uint256 currentFee = _calculateFee(unclaimedAmount, feeConfig.feePercentage);
            unclaimedAmount -= currentFee;
        }
    }

    /**
     * @dev Returns all rewards for a user with fee considering.
     *
     * @param _user The user address.
     * @return _rewards The rewards array.
     */
    function getAllRewards(address _user) public view returns (uint256[] memory _rewards) {
        uint256 rewardsSize = rewardTokens.length;
        _rewards = new uint256[](rewardsSize);

        for (uint256 i = 0; i < rewardsSize; i++) {
            _rewards[i] = getUserReward(_user, rewardTokens[i]);
        }
    }

    /**
     * @dev Shows user how many shares he'll get after claim the request.
     *
     * @param _owner The owner of the deposit request.
     * @return The amount of shares to get.
     */
    function previewClaimDeposit(address _owner) public view returns (uint256) {
        return _convertToShares(deposits[_owner]);
    }

    /**
     * @dev Shows user how many assets he'll get after claim the request.
     * @param owner The owner of redeem request.
     * @return The amount of assets to get.
     */
    function previewClaimRedeem(address owner) public view returns (uint256) {
        return _convertToAssets(redeems[owner]);
    }

    /**
     * @dev Claims the pending deposit request.
     *
     * @param receiver The address of the request creator.
     * @return shares The amount of claimed shares.
     */
    function claimDeposit(address receiver) external returns (uint256 shares) {
        require(receiver != address(0), "AsyncVault: Invalid receiver address");
        return _claimDeposit(msg.sender, receiver);
    }

    /**
     * @dev Claims the pending redeem request.
     *
     * @param receiver The address of the request creator.
     * @return assets The amount of claimed assets.
     */
    function claimRedeem(address receiver) external returns (uint256 assets) {
        require(receiver != address(0), "AsyncVault: Invalid receiver address");
        return _claimRedeem(_msgSender(), receiver);
    }

    /**
     * @dev Decreases the requested deposit amount.
     *
     * @param assets The amount of assets to decrease.
     */
    function decreaseDepositRequest(uint256 assets) external {
        uint256 oldBalance = deposits[msg.sender];

        require(assets <= oldBalance && assets != 0, "AsyncVault: Invalid amount to decrease requested amount");

        deposits[msg.sender] -= assets;

        _asset.safeTransfer(msg.sender, assets);

        emit DecreaseDepositRequest(msg.sender, oldBalance, deposits[msg.sender]);
    }

    /**
     * @dev Converts the assets into shares.
     *
     * @param assets The amount of assets to convert.
     * @return The amount of shares.
     */
    function _convertToShares(uint256 assets) internal view returns (uint256) {
        return totalSupply == 0 ? assets : assets.mulDivDown(1, totalAssets());
    }

    /**
     * @dev Converts the shares into assets.
     *
     * @param shares The amount of shares to convert.
     * @return The amount of shares.
     */
    function _convertToAssets(uint256 shares) internal view returns (uint256) {
        return shares.mulDivDown(totalAssets() + 1, totalSupply + 1);
    }

    /**
     * @dev Returns amount of assets on the contract balance.
     *
     * @return Asset balance of this contract.
     */
    function totalAssets() public view returns (uint256) {
        return _asset.balanceOf(address(this));
    }

    /**
     * @dev Returns the max possible amount of assets to deposit.
     */
    function maxDepositRequest(address) public pure returns (uint256) {
        return type(uint256).max;
    }

    /**
     * @dev Returns the max possible amount of shares to redeem.
     */
    function maxRedeemRequest(address owner) public view returns (uint256) {
        return balanceOf[owner];
    }

    /**
     * @inheritdoc IERC7540
     */
    function pendingDepositRequest(address owner) external view override returns (uint256 assets) {
        return deposits[owner];
    }

    /**
     * @inheritdoc IERC7540
     */
    function pendingRedeemRequest(address owner) external view override returns (uint256 shares) {
        return redeems[owner];
    }

    /**
     * @dev Returns reward tokens addresses.
     *
     * @return Reward tokens.
     */
    function getRewardTokens() public view returns (address[] memory) {
        return rewardTokens;
    }

    /**
     * @dev Returns Share token address.
     */
    function share() public view override returns (address) {
        return address(this);
    }

    /**
     * @dev Returns Asset token address.
     */
    function asset() public view override returns (address) {
        return address(_asset);
    }
}

library Bits {
    uint256 internal constant ONE = uint256(1);

    /**
     * @dev Sets the bit at the given 'index' in 'self' to '1'.
     *
     * @return Returns the modified value.
     */
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
