// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControlUpgradeable} from "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import {TreasuryStorage} from "./TreasuryStorage.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ITreasury} from "./interfaces/ITreasury.sol";
import {IRewards} from "../erc4626/interfaces/IRewards.sol";

/**
 * @title Treasury
 * @author Hashgraph
 * @notice This contract manages the Treasury
 */

contract Treasury is AccessControlUpgradeable, TreasuryStorage, ITreasury {
    using SafeERC20 for IERC20;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant FACTORY_ROLE = keccak256("FACTORY_ROLE");

    /// @notice When true, `_forwardExcessFunds` is a no-op so excess balances
    ///         accumulate in the Treasury instead of being pushed to the vault.
    ///         Useful while the vault is being upgraded or is otherwise unable
    ///         to accept rewards.
    bool public vaultForwardingPaused;

    event VaultForwardingPaused();
    event VaultForwardingUnpaused();
    event VaultRemoved(address indexed previousVault);
    event VaultManaged(address indexed vaultAddr, bytes data);
    event ReserveAmountUpdated(address indexed admin, uint256 oldAmount, uint256 newAmount);
    event VaultAdded(address indexed admin, address indexed vault);
    event BusinessAddressUpdated(address indexed previousAddress, address indexed newAddress);

    function initialize(
        address _usdcAddress,
        uint256 _reserveAmount,
        uint256 _nPercentage,
        address _initialOwner,
        address _businessAddress,
        address _buildingFactory
    ) public initializer {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_initialOwner != address(0), "Invalid governance address");
        require(_businessAddress != address(0), "Invalid business address");
        require(_buildingFactory != address(0), "Invalid factory address");
        require(_nPercentage <= 10000, "Invalid N percentage"); // Basis points
        require(_reserveAmount > 0, "Reserve amount must be greater than zero");

        TreasuryData storage $ = _getTreasuryStorage();
        $.usdc = _usdcAddress;
        $.reserveAmount = _reserveAmount;
        $.nPercentage = _nPercentage;
        $.mPercentage = 10000 - _nPercentage; // N + M = 100% (in basis points)
        $.businessAddress = _businessAddress;

        _grantRole(DEFAULT_ADMIN_ROLE, _initialOwner);
        _grantRole(FACTORY_ROLE, _buildingFactory);
        _grantRole(FACTORY_ROLE, _initialOwner);
        _grantRole(GOVERNANCE_ROLE, _initialOwner);
    }

    // return usdc address
    function usdc() public view returns (address) {
        TreasuryData storage $ = _getTreasuryStorage();
        return $.usdc;
    }

    // return vault
    function vault() public view returns (address) {
        TreasuryData storage $ = _getTreasuryStorage();
        return $.vault;
    }

    // return reserve
    function reserve() public view returns (uint256) {
        TreasuryData storage $ = _getTreasuryStorage();
        return $.reserveAmount;
    }

    function nPercentage() public view returns (uint256) {
        TreasuryData storage $ = _getTreasuryStorage();
        return $.nPercentage;
    }

    function mPercentage() public view returns (uint256) {
        TreasuryData storage $ = _getTreasuryStorage();
        return $.mPercentage;
    }

    function businessAddress() public view returns (address) {
        TreasuryData storage $ = _getTreasuryStorage();
        return $.businessAddress;
    }

    // deposit USDC into treasury
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        TreasuryData storage $ = _getTreasuryStorage();

        IERC20($.usdc).safeTransferFrom(msg.sender, address(this), amount);
        emit Deposit(msg.sender, amount);

        _distributeFunds(amount);
    }

    // governance-controlled function to make payments
    function makePayment(address to, uint256 amount) external onlyRole(GOVERNANCE_ROLE) {
        require(to != address(0), "Invalid recipient address");
        require(amount > 0, "Amount must be greater than zero");

        TreasuryData storage $ = _getTreasuryStorage();

        uint256 balance = IERC20($.usdc).balanceOf(address(this));
        require(balance >= amount, "Insufficient funds");
        require(balance - amount >= $.reserveAmount, "Treasury: payment violates reserve");

        IERC20($.usdc).safeTransfer(to, amount);
        emit Payment(to, amount);

        _forwardExcessFunds();
    }

    // update reserve amount (governance role)
    function setReserveAmount(uint256 newReserveAmount) external onlyRole(GOVERNANCE_ROLE) {
        require(newReserveAmount > 0, "Reserve amount must be greater than zero");

        TreasuryData storage $ = _getTreasuryStorage();

        emit ReserveAmountUpdated(msg.sender, $.reserveAmount, newReserveAmount);
        $.reserveAmount = newReserveAmount;
        _forwardExcessFunds();
    }

    // add vault to handle excess funds
    function addVault(address _vault) public onlyRole(FACTORY_ROLE) {
        require(_vault != address(0), "Treasury: invalid vault address");
        TreasuryData storage $ = _getTreasuryStorage();
        $.vault = _vault;
        emit VaultAdded(msg.sender, _vault);
    }

    /// @notice Updates the business address that receives the N% share of
    ///         deposits. Restricted to GOVERNANCE_ROLE because misconfiguring
    ///         this value would permanently misroute future deposits.
    function setBusinessAddress(address newBusinessAddress) external onlyRole(GOVERNANCE_ROLE) {
        require(newBusinessAddress != address(0), "Invalid business address");
        TreasuryData storage $ = _getTreasuryStorage();
        emit BusinessAddressUpdated($.businessAddress, newBusinessAddress);
        $.businessAddress = newBusinessAddress;
    }

    /// @notice Removes the configured vault. Excess funds will accumulate in
    ///         the Treasury until a new vault is set.
    function removeVault() external onlyRole(GOVERNANCE_ROLE) {
        TreasuryData storage $ = _getTreasuryStorage();
        address previousVault = $.vault;
        require(previousVault != address(0), "Treasury: no vault set");
        $.vault = address(0);
        emit VaultRemoved(previousVault);
    }

    /// @notice Pauses automatic forwarding of excess funds to the vault.
    function pauseVaultForwarding() external onlyRole(GOVERNANCE_ROLE) {
        vaultForwardingPaused = true;
        emit VaultForwardingPaused();
    }

    /// @notice Resumes automatic forwarding of excess funds to the vault.
    function unpauseVaultForwarding() external onlyRole(GOVERNANCE_ROLE) {
        vaultForwardingPaused = false;
        emit VaultForwardingUnpaused();
    }

    /// @notice Allows governance to call administrative methods on the vault
    ///         (e.g. addReward for a new token, setSharesLockTime,
    ///         recoverTokens). This is required because the vault was
    ///         deployed with the Treasury as its owner, otherwise vault
    ///         configuration would be permanently frozen.
    /// @param data ABI-encoded calldata to forward to the vault.
    function manageVault(bytes calldata data) external onlyRole(GOVERNANCE_ROLE) returns (bytes memory) {
        TreasuryData storage $ = _getTreasuryStorage();
        require($.vault != address(0), "Treasury: missing vault");
        (bool ok, bytes memory result) = $.vault.call(data);
        require(ok, "Treasury: vault call failed");
        emit VaultManaged($.vault, data);
        return result;
    }

    // grant governance role - callable by FACTORY_ROLE during setup, or by an
    // existing GOVERNANCE_ROLE caller (e.g. the Governance contract when
    // wiring a multisig Safe in via setSafeAddress).
    function grantGovernanceRole(address governance) external {
        require(
            hasRole(FACTORY_ROLE, msg.sender) || hasRole(GOVERNANCE_ROLE, msg.sender),
            "Treasury: caller missing role"
        );
        require(governance != address(0), "Invalid governance address");
        _grantRole(GOVERNANCE_ROLE, governance);
    }

    // grant factory role
    function grantFactoryRole(address factory) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(factory != address(0), "Invalid factory address");
        _grantRole(FACTORY_ROLE, factory);
    }

    function _distributeFunds(uint256 amount) internal {
        TreasuryData storage $ = _getTreasuryStorage();

        uint256 toBusiness = (amount * $.nPercentage) / 10000;
        uint256 toTreasury = amount - toBusiness;

        // N% to business
        IERC20($.usdc).safeTransfer($.businessAddress, toBusiness);

        emit FundsDistributed(toBusiness, toTreasury);

        _forwardExcessFunds();
    }

    function _forwardExcessFunds() internal {
        TreasuryData storage $ = _getTreasuryStorage();

        // No vault set, forwarding paused, or excess will be forwarded later;
        // accumulate in the Treasury rather than reverting the caller.
        if ($.vault == address(0) || vaultForwardingPaused) return;

        uint256 balance = IERC20($.usdc).balanceOf(address(this));
        if (balance <= $.reserveAmount) return;

        uint256 excessAmount = balance - $.reserveAmount;
        IERC20($.usdc).safeIncreaseAllowance($.vault, excessAmount);

        // The vault rejects addReward when totalSupply == 0. Try/catch the
        // call so an empty vault (or any other transient vault failure) does
        // not deadlock Treasury.deposit during initialization.
        try IRewards($.vault).addReward($.usdc, excessAmount) {
            emit ExcessFundsForwarded(excessAmount);
        } catch {
            // Reset the dangling allowance so it does not linger between attempts.
            IERC20($.usdc).safeDecreaseAllowance($.vault, excessAmount);
        }
    }
}
