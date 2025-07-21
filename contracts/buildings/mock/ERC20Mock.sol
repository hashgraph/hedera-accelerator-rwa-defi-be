// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit, Nonces} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {ERC20Votes} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

contract ERC20Mock is ERC20, ERC20Votes, ERC20Permit {
    uint8 private customDecimals;

    constructor(string memory _name, string memory _symbol, uint8 _decimals)
        ERC20(_name, _symbol)
        ERC20Permit(_name) // Must explicitly call ERC20Permit constructor
    {
        customDecimals = _decimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return customDecimals;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function _update(
        address from,
        address to,
        uint256 value
    ) internal virtual override(ERC20, ERC20Votes) {
        super._update(from, to, value);
    }

    function clock() public view override returns (uint48) {
        return uint48(block.timestamp);
    }

    // solhint-disable-next-line func-name-mixedcase
    function CLOCK_MODE() public pure override returns (string memory) {
        return "mode=timestamp";
    }

    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

}
