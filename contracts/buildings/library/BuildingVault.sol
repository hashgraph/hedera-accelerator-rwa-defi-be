// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {FeeConfiguration} from "../../common/FeeConfiguration.sol";
import {BasicVault} from "../../erc4626/BasicVault.sol";
import {VaultFactory} from "../../erc4626/factory/VaultFactory.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

struct VaultDetails {
    address stakeToken;
    string shareTokenName;
    string shareTokenSymbol;
    address feeReceiver;
    address feeToken;
    uint256 feePercentage;
    address rewardController;
    address feeConfigController;
    uint32 cliff;
    uint32 unlockDuration;
}

library BuildingVaultLib {
     function deployVault(VaultDetails memory details) external returns (address vault) {
        bytes memory _constructData = abi.encode(
            details.stakeToken,
            details.shareTokenName,
            details.shareTokenSymbol,
            details.feeReceiver,
            details.feeToken,
            details.feePercentage,
            details.rewardController, 
            details.feeConfigController, 
            details.cliff,
            details.unlockDuration
        );
        
        vault = _deploy(
            abi.encodePacked(type(BasicVault).creationCode, _constructData)
        );
    }

    function _deploy(bytes memory bytecode) private returns (address) {
        bytes32 saltBytes = bytes32(keccak256(abi.encodePacked(bytecode, msg.sender, block.number)));
        address addr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let encoded_data := add(0x20, bytecode) // load initialization code.
            let encoded_size := mload(bytecode) // load init code's length.
            addr := create2(callvalue(), encoded_data, encoded_size, saltBytes)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        return addr;
    }
}
