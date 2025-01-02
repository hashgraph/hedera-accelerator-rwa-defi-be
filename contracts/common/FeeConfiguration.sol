//SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Address} from "@openzeppelin/contracts/utils/Address.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import "../common/safe-HTS/SafeHTS.sol";

/**
 * @title Fee Configuration
 *
 * The contract that helps to consider fee during any Vault token operation.
 */
abstract contract FeeConfiguration is AccessControl {
    using SafeERC20 for IERC20;
    /**
     * @notice FeeConfigUpdated event.
     * @dev Emitted when admin changes fee configuration.
     *
     * @param feeConfig The fee configuration properties.
     */
    event FeeConfigUpdated(FeeConfig feeConfig);

    // Current fee configuration.
    FeeConfig public feeConfig;

    // Basis points for calculating percentages.
    uint256 internal constant BASIS_POINTS = 10_000;

    // Vault add reward role hash.
    bytes32 public constant VAULT_REWARD_CONTROLLER_ROLE = keccak256("VAULT_REWARD_CONTROLLER_ROLE");

    // Fee config controller role hash.
    bytes32 public constant FEE_CONFIG_CONTROLLER_ROLE = keccak256("FEE_CONFIG_CONTROLLER_ROLE");

    // Fee Config Struct.
    struct FeeConfig {
        address receiver;
        address token;
        uint256 feePercentage;
    }

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _feeConfig The fee configuration.
     */
    function __FeeConfiguration_init(
        FeeConfig memory _feeConfig,
        address vaultRewardController,
        address feeConfigController
    ) internal {
        _updateFeeConfigInternally(_feeConfig.receiver, _feeConfig.token, _feeConfig.feePercentage);
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(VAULT_REWARD_CONTROLLER_ROLE, vaultRewardController);
        _grantRole(FEE_CONFIG_CONTROLLER_ROLE, feeConfigController);
    }

    /**
     * @dev Initializes the contract with the required parameters.
     *
     * @param _feeConfig The fee configuration.
     */
    function updateFeeConfig(FeeConfig memory _feeConfig) external onlyRole(FEE_CONFIG_CONTROLLER_ROLE) {
        _updateFeeConfigInternally(_feeConfig.receiver, _feeConfig.token, _feeConfig.feePercentage);
    }

    /**
     * @dev Distributes fee according to the configuration.
     *
     * @param _amount The amount of the claim.
     */
    function _deductFee(uint256 _amount) internal returns (uint256) {
        address _token = feeConfig.token;
        uint256 fee = _calculateFee(_amount, feeConfig.feePercentage);

        require(IERC20(_token).balanceOf(address(this)) >= fee, "FC: Insufficient token balance");
        IERC20(_token).safeTransfer(feeConfig.receiver, fee);

        return _amount - fee;
    }

    /**
     * @dev Updates current fee configuration.
     *
     * @param _receiver The address of fee receiver.
     * @param _token The address of fee token.
     * @param _feePercentage The fee percentage.
     */
    function _updateFeeConfigInternally(address _receiver, address _token, uint256 _feePercentage) private {
        require(_feePercentage < BASIS_POINTS, "FC: Invalid fee");
        feeConfig.receiver = _receiver;
        feeConfig.token = _token;
        feeConfig.feePercentage = _feePercentage;
        emit FeeConfigUpdated(feeConfig);
    }

    /**
     * @dev Calculates fee amount of the claim.
     *
     * @param _amount The amount of the transfer.
     * @param _feePercentage The fee percentage.
     */
    function _calculateFee(uint256 _amount, uint256 _feePercentage) internal pure returns (uint256) {
        require(_amount * _feePercentage >= BASIS_POINTS, "FC: Too small amount to consider fee");
        return (_amount * _feePercentage) / BASIS_POINTS;
    }
}
