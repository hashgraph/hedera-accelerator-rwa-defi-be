// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {RewardsVault4626} from "../../vaultV2/RewardsVault4626.sol";
import {IERC20} from "../../vaultV2/IERC20.sol";

struct VaultDetails {
    address initialOwner;
    address stakeToken;
    string shareTokenName;
    string shareTokenSymbol;
    uint8 decimals;
    uint256 lockPeriod;
}

library BuildingVaultLib {
    /// @notice Deploy a RewardsVault4626 directly
    /// @param details Vault configuration details
    /// @return vault Address of the deployed vault
    function deployVault(VaultDetails memory details) external returns (address vault) {
        require(details.initialOwner != address(0), "BuildingVaultLib: Invalid initial owner");
        require(details.stakeToken != address(0), "BuildingVaultLib: Invalid stake token");
        require(bytes(details.shareTokenName).length > 0, "BuildingVaultLib: Empty name");
        require(bytes(details.shareTokenSymbol).length > 0, "BuildingVaultLib: Empty symbol");
        require(details.decimals > 0, "BuildingVaultLib: Invalid decimals");

        vault = address(
            new RewardsVault4626(
                IERC20(details.stakeToken),
                details.shareTokenName,
                details.shareTokenSymbol,
                details.decimals,
                details.lockPeriod,
                details.initialOwner
            )
        );
    }
}
