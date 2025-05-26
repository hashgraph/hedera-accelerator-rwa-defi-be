// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC7540_FilledRequest, ERC7540_Request} from "./types/ERC7540Types.sol";

/**
 * @title Async Vault Storage
 * @author Hashgraph
 *
 * The contract which represents a erc7201 Async Vault Storage.
 */
abstract contract AsyncVaultStorage {
    // Min reward amount considired in case of small reward
    uint256 internal constant MIN_REWARD = 1;

    /// @custom:storage-location erc7201:hashgraph.vault.BasicVaultStorage
    struct AsyncVaultData {
        // Saves the ERC7540 deposit requests when calling `requestDeposit`
        mapping(address => ERC7540_Request) pendingDepositRequest;
        // Saves the ERC7540 redeem requests when calling `requestRedeem`
        mapping(address => ERC7540_Request) pendingRedeemRequest;
        // Saves the result of the deposit after the request has been processed
        mapping(address => ERC7540_FilledRequest) claimableDepositRequest;
        // Saves the result of the redeem after the request has been processed
        mapping(address => ERC7540_FilledRequest) claimableRedeemRequest;
        // ERC7540 operator approvals
        mapping(address controller => mapping(address operator => bool)) isOperator;
        // Total duration of vesting (after cliff date) expressed in seconds
        uint32 unlockDuration;
        // Cliff date expressed in seconds
        uint32 cliff;
        // Reward tokens
        address[] rewardTokens;
        // Info by user
        mapping(address => UserInfo) userContribution;
        // Reward info by user
        mapping(address => RewardsInfo) tokensRewardInfo;
    }

    // User Info struct
    struct UserInfo {
        uint256 sharesAmount;
        uint256 totalLocked;
        uint256 totalReleased;
        uint256 depositLockCheckpoint;
        mapping(address => uint256) lastClaimedAmountT;
        bool exist;
    }

    // Rewards Info struct
    struct RewardsInfo {
        uint256 amount;
        bool exist;
    }

    // keccak256(abi.encode(uint256(keccak256("hashgraph.vault.AsyncVaultStorage")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant AsyncVaultStorageLocation =
        0x66edf448d5bf7be6b4d59d8e281e5b0790ba1fdc49329b14b394277e05474300;

    function _getAsyncVaultStorage() internal pure returns (AsyncVaultData storage $) {
        assembly {
            $.slot := AsyncVaultStorageLocation
        }
    }

    /**
     * @notice RewardAdded event.
     * @dev Emitted when permissioned user adds reward to the Vault.
     *
     * @param rewardToken The address of reward token.
     * @param amount The added reward token amount.
     */
    event RewardAdded(address indexed rewardToken, uint256 amount);

    /**
     * @notice RewardClaimed event.
     * @dev Emitted when permissioned user claims reward from the Vault.
     *
     * @param rewardToken The address of reward token.
     * @param receiver The receiver address.
     * @param amount The added reward token amount.
     */
    event RewardClaimed(address indexed rewardToken, address indexed receiver, uint256 amount);

    /**
     * @notice SetSharesLockTime event.
     * @dev Emitted when permissioned user updates shares lock time.
     *
     * @param time The shares lock period.
     */
    event SetSharesLockTime(uint32 time);

    // Using if owner adds reward which exceeds max token amount
    error MaxRewardTokensAmount();
}
