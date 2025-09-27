//SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IUniswapV2Router02} from "../uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";
import {ERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20Permit, ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {FixedPointMathLib} from "../math/FixedPointMathLib.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC7540} from "../erc7540/interfaces/IERC7540.sol";
import {IRewardsVaultAutoCompounder} from "../vaultV2/interfaces/IRewardsVaultAutoCompounder.sol";
import {ISlice} from "./interfaces/ISlice.sol";
import {IRewardsVault4626} from "../vaultV2/interfaces/IRewardsVault4626.sol";

/**
 * @title SliceV2
 * @author Hashgraph
 *
 * Simplified and robust derivatives fund on tokenized assets.
 * Maintains the same public interface as Slice but with cleaner implementation.
 */
contract SliceV2 is ISlice, ERC20, ERC20Permit, Ownable, ERC165 {
    using SafeERC20 for IERC20;
    using FixedPointMathLib for uint256;

    // Constants
    uint256 private constant PRECISION = 1e18;
    uint256 private constant BASIS_POINTS = 10000;
    uint256 private constant MAX_TOKENS_AMOUNT = 10;

    // State variables
    string private _metadataUri;
    Allocation[] private _allocations;
    uint256 private _allocated;
    IUniswapV2Router02 private _uniswapRouter;
    address private _baseToken;
    mapping(address => AggregatorV3Interface) private _priceFeeds;

    // Rebalance state for gas optimization
    struct RebalanceState {
        uint256 totalValue;
        uint256[] targetValues;
        uint256[] currentValues;
        uint256[] excessAmounts;
        uint256[] deficitAmounts;
    }

    constructor(
        address uniswapRouter_,
        address baseToken_,
        string memory name_,
        string memory symbol_,
        string memory metadataUri_
    ) ERC20(name_, symbol_) ERC20Permit(name_) Ownable(msg.sender) {
        require(uniswapRouter_ != address(0), "Slice: Invalid Uniswap router address");
        require(baseToken_ != address(0), "Slice: Invalid USDC token address");
        require(bytes(metadataUri_).length != 0, "Slice: Invalid metadata URI");

        _uniswapRouter = IUniswapV2Router02(uniswapRouter_);
        _baseToken = baseToken_;
        _metadataUri = metadataUri_;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPOSIT/WITHDRAWAL LOGIC
    //////////////////////////////////////////////////////////////*/

    function deposit(address aToken, uint256 amount) external returns (uint256 aTokenAmount) {
        require(amount > 0, "Slice: Invalid amount");

        Allocation memory allocation = getTokenAllocation(aToken);
        if (allocation.aToken == address(0)) revert AllocationNotFound(aToken);

        return _deposit(msg.sender, aToken, allocation.asset, amount);
    }

    function depositWithSignature(
        address aToken,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 aTokenAmount) {
        require(amount > 0, "Slice: Invalid amount");
        require(aToken != address(0), "Slice: Invalid aToken address");
        require(deadline >= block.timestamp, "Slice: Invalid deadline");

        Allocation memory allocation = getTokenAllocation(aToken);
        if (allocation.aToken == address(0)) revert AllocationNotFound(aToken);

        IERC20Permit(allocation.asset).permit(msg.sender, address(this), amount, deadline, v, r, s);
        return _deposit(msg.sender, aToken, allocation.asset, amount);
    }

    function depositBatchWithSignatures(
        address[] memory aTokens,
        uint256[] memory amounts,
        uint256[] memory deadlines,
        uint8[] memory v,
        bytes32[] memory r,
        bytes32[] memory s
    ) external returns (uint256[] memory) {
        require(
            aTokens.length == amounts.length &&
                aTokens.length == deadlines.length &&
                aTokens.length == v.length &&
                aTokens.length == r.length &&
                aTokens.length == s.length,
            "Slice: different array lengths"
        );

        uint256[] memory aTokenAmounts = new uint256[](aTokens.length);

        for (uint256 i = 0; i < aTokens.length; i++) {
            require(amounts[i] > 0, "Slice: Invalid amount");
            require(aTokens[i] != address(0), "Slice: Invalid aToken address");
            require(deadlines[i] >= block.timestamp, "Slice: Invalid deadline");

            Allocation memory allocation = getTokenAllocation(aTokens[i]);
            if (allocation.aToken == address(0)) revert AllocationNotFound(aTokens[i]);

            IERC20Permit(allocation.asset).permit(
                msg.sender,
                address(this),
                amounts[i],
                deadlines[i],
                v[i],
                r[i],
                s[i]
            );
            aTokenAmounts[i] = _deposit(msg.sender, aTokens[i], allocation.asset, amounts[i]);
        }

        return aTokenAmounts;
    }

    function _deposit(
        address sender,
        address aToken,
        address asset,
        uint256 amount
    ) internal returns (uint256 aTokenAmount) {
        // Transfer underlying token from user to contract
        IERC20(asset).safeTransferFrom(sender, address(this), amount);

        // Deposit to AutoCompounder
        IERC20(asset).approve(aToken, amount);
        aTokenAmount = IRewardsVaultAutoCompounder(aToken).deposit(amount, address(this));

        // Mint sTokens to sender
        _mint(sender, aTokenAmount);

        emit Deposit(aToken, sender, amount);
    }

    function withdraw(uint256 sTokenAmount) external returns (uint256[] memory amounts) {
        require(sTokenAmount > 0, "Slice: Invalid amount");
        require(sTokenAmount <= balanceOf(msg.sender), "Slice: Insufficient balance");

        // Burn sTokens
        _burn(msg.sender, sTokenAmount);

        amounts = new uint256[](_allocations.length);
        uint256 totalSupply_ = totalSupply();

        if (totalSupply_ == 0) {
            // If no total supply, return all aTokens proportionally
            for (uint256 i = 0; i < _allocations.length; i++) {
                address aToken = _allocations[i].aToken;
                uint256 balance = IERC20(aToken).balanceOf(address(this));
                amounts[i] = balance;
                if (amounts[i] > 0) {
                    IERC20(aToken).safeTransfer(msg.sender, amounts[i]);
                    emit Withdraw(aToken, msg.sender, amounts[i]);
                }
            }
        } else {
            // Calculate proportional withdrawal
            for (uint256 i = 0; i < _allocations.length; i++) {
                address aToken = _allocations[i].aToken;
                uint256 balance = IERC20(aToken).balanceOf(address(this));
                amounts[i] = (balance * sTokenAmount) / totalSupply_;

                if (amounts[i] > 0) {
                    IERC20(aToken).safeTransfer(msg.sender, amounts[i]);
                    emit Withdraw(aToken, msg.sender, amounts[i]);
                }
            }
        }
    }

    /*///////////////////////////////////////////////////////////////
                        ALLOCATION LOGIC
    //////////////////////////////////////////////////////////////*/

    function addAllocation(address aToken, address priceFeedAddress, uint16 percentage) external {
        require(aToken != address(0), "Slice: Invalid aToken address");
        require(priceFeedAddress != address(0), "Slice: Invalid price feed address");
        require(percentage > 0 && percentage < BASIS_POINTS, "Slice: Invalid allocation percentage");
        require(_allocated + percentage <= BASIS_POINTS, "Slice: Total allocation exceeds 100%");
        require(_allocations.length < MAX_TOKENS_AMOUNT, "Slice: Allocations limit reached");

        // Check for existing allocation
        if (getTokenAllocation(aToken).aToken != address(0)) revert AssociatedAllocationExists(aToken);

        // Verify aToken implements required interface
        if (!ERC165Checker.supportsInterface(aToken, type(IRewardsVaultAutoCompounder).interfaceId)) {
            revert UnsupportedAToken(aToken);
        }

        // Get underlying asset
        address asset = IRewardsVaultAutoCompounder(aToken).asset();

        _allocations.push(Allocation({aToken: aToken, asset: asset, targetPercentage: percentage}));
        _allocated += percentage;
        _priceFeeds[asset] = AggregatorV3Interface(priceFeedAddress);

        emit AllocationAdded(aToken, asset, priceFeedAddress, percentage);
    }

    function setAllocationPercentage(address aToken, uint16 newPercentage) external {
        require(aToken != address(0), "Slice: Invalid aToken address");
        require(newPercentage > 0 && newPercentage < BASIS_POINTS, "Slice: Invalid percentage");

        bool found = false;
        for (uint256 i = 0; i < _allocations.length; i++) {
            if (_allocations[i].aToken == aToken) {
                _allocations[i].targetPercentage = newPercentage;
                found = true;
                break;
            }
        }
        if (!found) revert AllocationNotFound(aToken);

        emit AllocationPercentageChanged(aToken, newPercentage);
    }

    /*///////////////////////////////////////////////////////////////
                        REBALANCE LOGIC
    //////////////////////////////////////////////////////////////*/

    function rebalance() external {
        if (_allocations.length == 0) return;

        RebalanceState memory state = _calculateRebalanceState();
        if (state.totalValue == 0) return;

        // Process excess tokens (sell)
        for (uint256 i = 0; i < _allocations.length; i++) {
            if (state.excessAmounts[i] > 0) {
                _processExcessToken(i, state.excessAmounts[i]);
            }
        }

        // Process deficit tokens (buy)
        for (uint256 i = 0; i < _allocations.length; i++) {
            if (state.deficitAmounts[i] > 0) {
                _processDeficitToken(i, state.deficitAmounts[i]);
            }
        }
    }

    function _calculateRebalanceState() internal view returns (RebalanceState memory state) {
        state.totalValue = _getTotalValue();
        if (state.totalValue == 0) return state;

        state.targetValues = new uint256[](_allocations.length);
        state.currentValues = new uint256[](_allocations.length);
        state.excessAmounts = new uint256[](_allocations.length);
        state.deficitAmounts = new uint256[](_allocations.length);

        for (uint256 i = 0; i < _allocations.length; i++) {
            address aToken = _allocations[i].aToken;
            address asset = _allocations[i].asset;

            // Calculate target value
            state.targetValues[i] = (state.totalValue * _allocations[i].targetPercentage) / BASIS_POINTS;

            // Calculate current value
            state.currentValues[i] = _getTokenValue(aToken, asset);

            if (state.currentValues[i] > state.targetValues[i]) {
                state.excessAmounts[i] = state.currentValues[i] - state.targetValues[i];
            } else if (state.targetValues[i] > state.currentValues[i]) {
                state.deficitAmounts[i] = state.targetValues[i] - state.currentValues[i];
            }
        }
    }

    function _processExcessToken(uint256 index, uint256 excessValue) internal {
        address aToken = _allocations[index].aToken;
        address asset = _allocations[index].asset;

        // Calculate how much aToken to withdraw
        uint256 exchangeRate = IRewardsVaultAutoCompounder(aToken).exchangeRate();
        uint256 aTokenToWithdraw = (excessValue * PRECISION) / exchangeRate;

        // Withdraw from autocompounder
        uint256 withdrawnAmount = _withdrawFromAutocompounder(aToken, aTokenToWithdraw);
        if (withdrawnAmount == 0) return;

        // Swap to base token
        _swapToken(asset, _baseToken, withdrawnAmount);
    }

    function _processDeficitToken(uint256 index, uint256 deficitValue) internal {
        address aToken = _allocations[index].aToken;
        address asset = _allocations[index].asset;

        // Check if we have enough base token
        uint256 baseTokenBalance = IERC20(_baseToken).balanceOf(address(this));
        if (baseTokenBalance == 0) return;

        // Calculate how much base token to use
        uint256 baseTokenToUse = _getSwapAmount(_baseToken, asset, deficitValue);
        if (baseTokenToUse > baseTokenBalance) {
            baseTokenToUse = baseTokenBalance;
        }

        // Swap base token to asset
        uint256 assetAmount = _swapToken(_baseToken, asset, baseTokenToUse);
        if (assetAmount == 0) return;

        // Deposit to autocompounder
        IERC20(asset).approve(aToken, assetAmount);
        IRewardsVaultAutoCompounder(aToken).deposit(assetAmount, address(this));
    }

    function _withdrawFromAutocompounder(address aToken, uint256 amount) internal returns (uint256) {
        try IRewardsVaultAutoCompounder(aToken).withdraw(amount, address(this)) returns (uint256 withdrawn) {
            return withdrawn;
        } catch {
            // If withdrawal fails, try to withdraw maximum available
            address vault = IRewardsVaultAutoCompounder(aToken).vault();
            uint256 maxWithdraw = IERC4626(vault).maxWithdraw(address(this));
            if (maxWithdraw > 0) {
                try IRewardsVaultAutoCompounder(aToken).withdraw(maxWithdraw, address(this)) returns (
                    uint256 withdrawn
                ) {
                    return withdrawn;
                } catch {
                    return 0;
                }
            }
            return 0;
        }
    }

    function _swapToken(address tokenIn, address tokenOut, uint256 amountIn) internal returns (uint256 amountOut) {
        if (amountIn == 0 || tokenIn == tokenOut) return amountIn;

        uint256 balance = IERC20(tokenIn).balanceOf(address(this));
        if (balance < amountIn) amountIn = balance;
        if (amountIn == 0) return 0;

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        IERC20(tokenIn).approve(address(_uniswapRouter), amountIn);

        try
            _uniswapRouter.swapExactTokensForTokens(
                amountIn,
                0, // Accept any amount out
                path,
                address(this),
                block.timestamp
            )
        returns (uint256[] memory amounts) {
            return amounts[1];
        } catch {
            return 0;
        }
    }

    function _getSwapAmount(address tokenIn, address tokenOut, uint256 amountOut) internal view returns (uint256) {
        if (tokenIn == tokenOut) return amountOut;

        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = tokenOut;

        try _uniswapRouter.getAmountsIn(amountOut, path) returns (uint256[] memory amounts) {
            return amounts[0];
        } catch {
            return amountOut; // Fallback to 1:1 ratio
        }
    }

    /*///////////////////////////////////////////////////////////////
                        INTERNAL VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function _getTotalValue() internal view returns (uint256 totalValue) {
        for (uint256 i = 0; i < _allocations.length; i++) {
            totalValue += _getTokenValue(_allocations[i].aToken, _allocations[i].asset);
        }
    }

    function _getTokenValue(address aToken, address asset) internal view returns (uint256) {
        uint256 balance = IERC20(aToken).balanceOf(address(this));
        if (balance == 0) return 0;

        uint256 exchangeRate = IRewardsVaultAutoCompounder(aToken).exchangeRate();
        uint256 underlyingValue = (balance * exchangeRate) / PRECISION;

        uint256 price = uint256(getChainlinkDataFeedLatestAnswer(asset));
        require(price > 0, "Slice: Invalid price feed");

        return (underlyingValue * price) / (10 ** IERC20Metadata(asset).decimals());
    }

    /*///////////////////////////////////////////////////////////////
                        PRICE FEED FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getChainlinkDataFeedLatestAnswer(address token) public view returns (int) {
        (, int answer, , , ) = _priceFeeds[token].latestRoundData();
        return answer;
    }

    /*///////////////////////////////////////////////////////////////
                        VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    function getTokenAllocation(address aToken) public view returns (Allocation memory) {
        for (uint256 i = 0; i < _allocations.length; i++) {
            if (_allocations[i].aToken == aToken) {
                return _allocations[i];
            }
        }
        return Allocation(address(0), address(0), 0);
    }

    function allocations() external view returns (Allocation[] memory) {
        return _allocations;
    }

    function priceFeed(address token) public view returns (address) {
        return address(_priceFeeds[token]);
    }

    function uniswapV2Router() public view returns (address) {
        return address(_uniswapRouter);
    }

    function baseToken() public view returns (address) {
        return _baseToken;
    }

    function metadataUri() external view returns (string memory) {
        return _metadataUri;
    }

    function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
        return interfaceId == type(ISlice).interfaceId || super.supportsInterface(interfaceId);
    }
}
