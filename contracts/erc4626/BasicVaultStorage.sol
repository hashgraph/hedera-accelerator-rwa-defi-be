// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Basic Vault Storage
 * @author Hashgraph
 *
 * The contract which represents a erc7201 Vault Storage.
 */
abstract contract BasicVaultStorage {
    // Min reward amount considired in case of small reward
    uint256 internal constant MIN_REWARD = 1;

    /// @custom:storage-location erc7201:hashgraph.vault.BasicVaultStorage
    struct BasicVaultData {
        uint32 unlockDuration;
        uint32 cliff;
        address[] rewardTokens;
        mapping(address => UserInfo) userContribution;
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

    // keccak256(abi.encode(uint256(keccak256("hashgraph.vault.BasicVaultStorage")) - 1)) & ~bytes32(uint256(0xff));
    bytes32 private constant BasicVaultStorageLocation =
        0xb5311d7a8ac81ee4993288bc4c98b414fbe1c746351a804bd1a32db330eae700;

    function _getBasicVaultStorage() internal pure returns (BasicVaultData storage $) {
        assembly {
            $.slot := BasicVaultStorageLocation
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
