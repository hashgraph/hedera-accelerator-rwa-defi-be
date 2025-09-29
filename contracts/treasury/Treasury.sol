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

        IERC20($.usdc).safeTransfer(to, amount);
        emit Payment(to, amount);

        _forwardExcessFunds();
    }

    // update reserve amount (governance role)
    function setReserveAmount(uint256 newReserveAmount) external onlyRole(GOVERNANCE_ROLE) {
        require(newReserveAmount > 0, "Reserve amount must be greater than zero");

        TreasuryData storage $ = _getTreasuryStorage();

        $.reserveAmount = newReserveAmount;
        _forwardExcessFunds();
    }

    // add vault to handle excess funds
    function addVault(address _vault) public onlyRole(FACTORY_ROLE) {
        TreasuryData storage $ = _getTreasuryStorage();
        $.vault = _vault;
    }

    // grant governance role
    function grantGovernanceRole(address governance) external onlyRole(FACTORY_ROLE) {
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

        require($.vault != address(0), "Treasury: missing vault");

        uint256 balance = IERC20($.usdc).balanceOf(address(this));
        if (balance > $.reserveAmount) {
            uint256 excessAmount = balance - $.reserveAmount;
            IERC20($.usdc).safeIncreaseAllowance($.vault, excessAmount);
            IRewards($.vault).addReward($.usdc, excessAmount);
            emit ExcessFundsForwarded(excessAmount);
        }
    }
}
