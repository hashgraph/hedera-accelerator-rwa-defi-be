// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;
pragma abicoder v2;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {FixedPointMathLib} from "../math/FixedPointMathLib.sol";

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC7540} from "../erc7540/interfaces/IERC7540.sol";

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {IUniswapV2Router02} from "../uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";

import {IAutoCompounder} from "./interfaces/IAutoCompounder.sol";
import {IRewards} from "../erc4626/interfaces/IRewards.sol";

/**
 * @title AutoCompounder
 * @author Hashgraph
 *
 * The contract represents a simple AutoCompounder, that allows to reinvest vault rewards.
 */
contract AutoCompounder is IAutoCompounder, ERC20, ERC20Permit, Ownable, ERC165 {
    using SafeERC20 for IERC20;
    using FixedPointMathLib for uint256;

    // Precision factor
    uint256 private constant PRECISION = 1e18;

    // Min reward to perform claim & reinvest
    uint256 internal constant MIN_REWARD = 10e6; // 10$

    // Vault
    IERC4626 private immutable _vault;

    // Cached vault type IERC4626/IERC7540
    bool private immutable isAsync;

    // Underlying token
    address private immutable _underlying;

    // Uniswap V2 Router
    IUniswapV2Router02 private _uniswapV2Router;

    // USDC token
    address private _usdc;

    // Uniswap swap path to convert from USDC to underlying asset
    address[] internal _path;

    // Per-share cumulative reward distributed to AC holders, scaled by 1e18.
    // Monotonically increasing each time `_harvestVaultRewards` pulls USDC
    // from the vault and credits it to the holder pool.
    uint256 internal _accRewardPerShare;

    // The value of `_accRewardPerShare` the user was last charged against.
    mapping(address => uint256) internal _userRewardPerSharePaid;

    // Settled-but-unclaimed reward owed to a user, denominated in USDC.
    mapping(address => uint256) internal _userPendingReward;

    /**
     * @dev Initializes contract with passed parameters.
     *
     * @param uniswapV2Router_ The address of the Uniswap Router contract.
     * @param vault_ The Vault contract address.
     * @param usdc_ The address of the USDC token.
     * @param name_ The aToken name.
     * @param symbol_ The aToken symbol.
     * @param operator_ The operator address used in case of Async Vault, e.g. Slice.
     */
    constructor(
        address uniswapV2Router_,
        address vault_,
        address usdc_,
        string memory name_,
        string memory symbol_,
        address operator_
    ) payable ERC20(name_, symbol_) ERC20Permit(name_) Ownable(msg.sender) {
        require(uniswapV2Router_ != address(0), "AutoCompounder: Invalid Uniswap Router address");
        require(vault_ != address(0), "AutoCompounder: Invalid Vault address");
        require(usdc_ != address(0), "AutoCompounder: Invalid USDC token address");

        isAsync = ERC165Checker.supportsInterface(vault_, type(IERC7540).interfaceId);
        require(
            isAsync || ERC165Checker.supportsInterface(vault_, type(IERC4626).interfaceId),
            "AutoCompounder: Unsupported vault interface ID"
        );

        _uniswapV2Router = IUniswapV2Router02(uniswapV2Router_);
        _underlying = IERC4626(vault_).asset();
        _vault = IERC4626(vault_);
        _usdc = usdc_;

        _path = new address[](2);
        (_path[0], _path[1]) = (usdc(), asset());

        if (isAsync) {
            IERC7540(vault()).setOperator(operator_, true);
        }
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     * @inheritdoc IAutoCompounder
     */
    function deposit(uint256 assets, address receiver) external override returns (uint256 amountToMint) {
        require(assets != 0, "AutoCompounder: Invalid assets amount");
        require(receiver != address(0), "AutoCompounder: Invalid receiver address");

        address sender = _msgSender();

        // Calculate aToken amount to mint using exchange rate
        amountToMint = assets.mulDivDown(exchangeRate(), PRECISION);

        IERC20(asset()).safeTransferFrom(sender, address(this), assets);

        IERC20(asset()).approve(vault(), assets);

        // Perform deposit request at first if it's ERC7540
        if (isAsync) IERC7540(vault()).requestDeposit(assets, address(this), address(this));

        // Deposit underlying
        _vault.deposit(assets, address(this));

        // Mint and transfer aToken
        _mint(receiver, amountToMint);

        emit Deposit(sender, receiver, assets, amountToMint);
    }

    /**
     * @dev Withdraws underlying asset from the Vault.
     * @inheritdoc IAutoCompounder
     */
    function withdraw(uint256 aTokenAmount, address receiver) external override returns (uint256 underlyingAmount) {
        require(aTokenAmount > 0, "AutoCompounder: Invalid aToken amount");
        require(receiver != address(0), "AutoCompounder: Invalid receiver address");

        address sender = _msgSender();

        // Calculate underlying amount to withdraw using exchange rate
        underlyingAmount = aTokenAmount.mulDivDown(PRECISION, exchangeRate());

        // Claim reward before burn
        claimExactUserReward(receiver);

        // Burn aToken
        _burn(sender, aTokenAmount);

        // Withdraw underlying
        _vault.approve(vault(), underlyingAmount);
        _vault.withdraw(underlyingAmount, receiver, address(this));

        emit Withdraw(sender, aTokenAmount, underlyingAmount);
    }

    /**
     * @dev Claims all reward tokens from the Vault, swaps every non-asset
     *      reward to the underlying asset, and deposits the total back into the vault.
     *      Iterating over every reward token (rather than only USDC) prevents
     *      non-USDC rewards from being permanently stranded in this contract.
     * @inheritdoc IAutoCompounder
     */
    function claim() external {
        IRewards vaultRewards = IRewards(vault());
        address[] memory rewardTokens = vaultRewards.getRewardTokens();
        require(rewardTokens.length != 0, "AutoCompounder: No reward tokens");

        // Claim every reward token registered in the vault
        vaultRewards.claimAllReward(0, address(this));

        address _asset = asset();
        address _usdcAddr = usdc();
        uint256 totalAssetsToReinvest;

        for (uint256 i = 0; i < rewardTokens.length; i++) {
            address rewardToken = rewardTokens[i];
            uint256 balance = IERC20(rewardToken).balanceOf(address(this));

            if (balance == 0) continue;

            if (rewardToken == _asset) {
                totalAssetsToReinvest += balance;
                continue;
            }

            // Build a swap path. USDC has a direct path; other tokens route via USDC.
            address[] memory path;
            if (rewardToken == _usdcAddr) {
                path = _path;
            } else {
                path = new address[](3);
                path[0] = rewardToken;
                path[1] = _usdcAddr;
                path[2] = _asset;
            }

            IERC20(rewardToken).approve(uniswapV2Router(), balance);
            try
                _uniswapV2Router.swapExactTokensForTokens(
                    balance,
                    0,
                    path,
                    address(this),
                    block.timestamp + 300
                )
            returns (uint256[] memory amounts) {
                totalAssetsToReinvest += amounts[amounts.length - 1];
            } catch {
                // Revoke approval and skip; tokens stay claimable on next attempt
                IERC20(rewardToken).approve(uniswapV2Router(), 0);
            }
        }

        if (totalAssetsToReinvest < MIN_REWARD) revert InsufficientReward(totalAssetsToReinvest);

        IERC20(_asset).approve(vault(), totalAssetsToReinvest);
        _vault.deposit(totalAssetsToReinvest, address(this));

        emit Claim(totalAssetsToReinvest);
    }

    /*///////////////////////////////////////////////////////////////
                        REWARDS LOGIC
    //////////////////////////////////////////////////////////////*/

    /**
     * @dev Pulls all USDC the AutoCompounder is entitled to from the underlying
     *      vault and credits it to the holder pool by bumping
     *      `_accRewardPerShare`. Using a monotonic per-share accumulator
     *      replaces the previous `_userClaimedRewards` model, which broke when
     *      the vault's pending balance dropped below a user's lifetime
     *      claimed amount and locked the user out of future rewards.
     */
    function _harvestVaultRewards() internal {
        uint256 supply = totalSupply();
        if (supply == 0) return;

        uint256 vaultPending = IRewards(vault()).getUserReward(address(this), usdc());
        if (vaultPending == 0) return;

        uint256 balanceBefore = IERC20(usdc()).balanceOf(address(this));
        IRewards(vault()).claimExactReward(usdc(), address(this), vaultPending);
        uint256 received = IERC20(usdc()).balanceOf(address(this)) - balanceBefore;

        if (received > 0) {
            _accRewardPerShare += (received * PRECISION) / supply;
        }
    }

    /**
     * @dev Captures the user's per-share earnings since their last checkpoint
     *      into `_userPendingReward` and snapshots the latest accumulator.
     *      Called before any balance change (mint/burn/transfer) so reward
     *      credit is always evaluated against the balance that earned it.
     */
    function _settleUserReward(address user) internal {
        uint256 acc = _accRewardPerShare;
        uint256 paid = _userRewardPerSharePaid[user];
        if (acc != paid) {
            uint256 bal = balanceOf(user);
            if (bal > 0 && acc > paid) {
                _userPendingReward[user] += (bal * (acc - paid)) / PRECISION;
            }
            _userRewardPerSharePaid[user] = acc;
        }
    }

    /**
     * @dev Claims any pending USDC reward for the caller and forwards it to `receiver`.
     */
    function claimExactUserReward(address receiver) public {
        require(receiver != address(0), "AutoCompounder: Invalid reward receiver address");

        address sender = _msgSender();
        _harvestVaultRewards();
        _settleUserReward(sender);

        uint256 userReward = _userPendingReward[sender];
        if (userReward == 0) return;

        _userPendingReward[sender] = 0;
        IERC20(usdc()).safeTransfer(receiver, userReward);

        emit UserClaimedReward(sender, receiver, userReward);
    }

    /**
     * @dev View helper: includes both already-settled pending reward and the
     *      portion that would be settled if the user interacted right now,
     *      including any USDC still held at the vault for this contract.
     */
    function getPendingReward(address user) public view returns (uint256 pendingReward) {
        require(user != address(0), "AutoCompounder: Invalid user address");

        uint256 supply = totalSupply();
        uint256 acc = _accRewardPerShare;
        if (supply > 0) {
            uint256 vaultPending = IRewards(vault()).getUserReward(address(this), usdc());
            if (vaultPending > 0) {
                acc += (vaultPending * PRECISION) / supply;
            }
        }

        uint256 paid = _userRewardPerSharePaid[user];
        pendingReward = _userPendingReward[user];

        uint256 bal = balanceOf(user);
        if (bal > 0 && acc > paid) {
            pendingReward += (bal * (acc - paid)) / PRECISION;
        }
    }

    /// @dev Settle reward for both sides of any balance change so the
    ///      reward credit always reflects the balance that earned it.
    ///      Replaces the prior `_userClaimedRewards` debt-transfer override.
    function _update(address from, address to, uint256 value) internal virtual override {
        if (from != address(0)) _settleUserReward(from);
        if (to != address(0)) _settleUserReward(to);
        super._update(from, to, value);
    }

    /**
     * @dev Returns the exchange rate for token.
     * @inheritdoc IAutoCompounder
     */
    function exchangeRate() public view override returns (uint256) {
        uint256 vTotalSupply = _vault.totalSupply();
        uint256 aTotalSupply = totalSupply();

        return aTotalSupply == 0 ? PRECISION : aTotalSupply.mulDivDown(PRECISION, vTotalSupply);
    }

    /**
     * @dev Returns the underlying asset address.
     */
    function asset() public view override returns (address) {
        return _underlying;
    }

    /**
     * @dev Returns the USDC token address.
     */
    function usdc() public view returns (address) {
        return _usdc;
    }

    /**
     * @dev Returns the Uniswap V2 router address.
     */
    function uniswapV2Router() public view returns (address) {
        return address(_uniswapV2Router);
    }

    /**
     * @dev Returns the corresponding Vault address.
     */
    function vault() public view override returns (address) {
        return address(_vault);
    }

    /**
     * @dev See {IERC165-supportsInterface}.
     */
    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(IAutoCompounder).interfaceId || super.supportsInterface(interfaceId);
    }
}
