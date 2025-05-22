// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AutoCompounder} from "../../autocompounder/AutoCompounder.sol";

struct AutoCompounderDetails {
    address uniswapV2Router;
    address vault;
    address usdc;
    string aTokenName;
    string aTokenSymbol;
    address operator;
}

library BuildingAutoCompounderLib {
    function deployAutoCompounder(AutoCompounderDetails calldata autoCompounderDetails) external returns (address) {
        bytes memory _code = type(AutoCompounder).creationCode;
        bytes memory _constructData = abi.encode(
            autoCompounderDetails.uniswapV2Router,
            autoCompounderDetails.vault,
            autoCompounderDetails.usdc,
            autoCompounderDetails.aTokenName,
            autoCompounderDetails.aTokenSymbol,
            autoCompounderDetails.operator
        );

        bytes memory deploymentData = abi.encodePacked(_code, _constructData);
        return _deploy(deploymentData);
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
