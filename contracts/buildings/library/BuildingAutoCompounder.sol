// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {RewardsVaultAutoCompounder} from "../../vaultV2/RewardsVaultAutoCompounder.sol";
import {RewardsVault4626} from "../../vaultV2/RewardsVault4626.sol";
import {IUniswapV2Router02} from "../../uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";

struct AutoCompounderDetails {
    address vault;
    string aTokenName;
    string aTokenSymbol;
    uint256 minimumClaimThreshold;
    address uniswapRouter;
    address intermediateToken;
    uint256 maxSlippage;
}

library BuildingAutoCompounderLib {
    /// @notice Deploy a RewardsVaultAutoCompounder directly
    /// @param autoCompounderDetails AutoCompounder configuration details
    /// @return autoCompounder Address of the deployed autocompounder
    function deployAutoCompounder(
        AutoCompounderDetails calldata autoCompounderDetails
    ) external returns (address autoCompounder) {
        require(autoCompounderDetails.vault != address(0), "BuildingAutoCompounderLib: Invalid vault address");
        require(bytes(autoCompounderDetails.aTokenName).length > 0, "BuildingAutoCompounderLib: Empty name");
        require(bytes(autoCompounderDetails.aTokenSymbol).length > 0, "BuildingAutoCompounderLib: Empty symbol");
        require(autoCompounderDetails.uniswapRouter != address(0), "BuildingAutoCompounderLib: Invalid router address");
        require(
            autoCompounderDetails.intermediateToken != address(0),
            "BuildingAutoCompounderLib: Invalid intermediate token"
        );
        require(autoCompounderDetails.maxSlippage <= 5000, "BuildingAutoCompounderLib: Invalid slippage");

        autoCompounder = address(
            new RewardsVaultAutoCompounder(
                RewardsVault4626(autoCompounderDetails.vault),
                autoCompounderDetails.aTokenName,
                autoCompounderDetails.aTokenSymbol,
                autoCompounderDetails.minimumClaimThreshold,
                IUniswapV2Router02(autoCompounderDetails.uniswapRouter),
                autoCompounderDetails.intermediateToken,
                autoCompounderDetails.maxSlippage
            )
        );
    }
}
