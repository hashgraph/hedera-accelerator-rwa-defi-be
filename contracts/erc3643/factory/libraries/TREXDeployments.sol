// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {TrustedIssuersRegistryProxy} from "../../proxy/TrustedIssuersRegistryProxy.sol";
import {ClaimTopicsRegistryProxy} from "../../proxy/ClaimTopicsRegistryProxy.sol";
import {ModularComplianceProxy} from "../../proxy/ModularComplianceProxy.sol";
import {IdentityRegistryStorageProxy} from "../../proxy/IdentityRegistryStorageProxy.sol";
import {IdentityRegistryProxy} from "../../proxy/IdentityRegistryProxy.sol";
import {TokenProxy} from "../../proxy/TokenProxy.sol";
import {ITREXFactory} from "../ITREXFactory.sol";

library TREXDeployments {
    function _deployTIR
    (
        string memory _salt,
        address implementationAuthority_
    ) external returns (address){
        bytes memory _code = type(TrustedIssuersRegistryProxy).creationCode;
        bytes memory _constructData = abi.encode(implementationAuthority_);
        bytes memory bytecode = abi.encodePacked(_code, _constructData);
        return _deploy(_salt, bytecode);
    }

     function  _deployCTR
    (
        string memory _salt,
        address implementationAuthority_
    ) external returns (address) {
        bytes memory _code = type(ClaimTopicsRegistryProxy).creationCode;
        bytes memory _constructData = abi.encode(implementationAuthority_);
        bytes memory bytecode = abi.encodePacked(_code, _constructData);
        return _deploy(_salt, bytecode);
    }

    function  _deployMC
    (
        string memory _salt,
        address implementationAuthority_
    ) external returns (address) {
        bytes memory _code = type(ModularComplianceProxy).creationCode;
        bytes memory _constructData = abi.encode(implementationAuthority_);
        bytes memory bytecode = abi.encodePacked(_code, _constructData);
        return _deploy(_salt, bytecode);
    }

    /// function used to deploy an identity registry storage using CREATE2
    function _deployIRS
    (
        string memory _salt,
        address implementationAuthority_
    ) external returns (address) {
        bytes memory _code = type(IdentityRegistryStorageProxy).creationCode;
        bytes memory _constructData = abi.encode(implementationAuthority_);
        bytes memory bytecode = abi.encodePacked(_code, _constructData);
        return _deploy(_salt, bytecode);
    }

    /// function used to deploy an identity registry using CREATE2
    function _deployIR
    (
        string memory _salt,
        address implementationAuthority_,
        address _trustedIssuersRegistry,
        address _claimTopicsRegistry,
        address _identityStorage
    ) external returns (address) {
        bytes memory _code = type(IdentityRegistryProxy).creationCode;
        bytes memory _constructData = abi.encode
        (
            implementationAuthority_,
            _trustedIssuersRegistry,
            _claimTopicsRegistry,
            _identityStorage
        );
        bytes memory bytecode = abi.encodePacked(_code, _constructData);
        return _deploy(_salt, bytecode);
    }

    /// function used to deploy a token using CREATE2
    function _deployToken
    (
        string memory _salt,
        address implementationAuthority_,
        address _identityRegistry,
        address _compliance,
        ITREXFactory.TokenDetails memory details
    ) external returns (address) {
        bytes memory _code = type(TokenProxy).creationCode;
        bytes memory _constructData = abi.encode
        (
            implementationAuthority_,
            _identityRegistry,
            _compliance,
            details.name,
            details.symbol,
            details.decimals,
            details.ONCHAINID
        );
        bytes memory bytecode = abi.encodePacked(_code, _constructData);
        return _deploy(_salt, bytecode);
    }

    function _deploy(string memory salt, bytes memory bytecode) internal returns (address) {
        bytes32 saltBytes = bytes32(keccak256(abi.encodePacked(salt)));
        address addr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let encoded_data := add(0x20, bytecode) // load initialization code.
            let encoded_size := mload(bytecode)     // load init code's length.
            addr := create2(0, encoded_data, encoded_size, saltBytes)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        return addr;
    }

}