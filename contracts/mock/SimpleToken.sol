// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "../erc4626/ERC20.sol";

/// @title SimpleToken
/// @notice Simple ERC20 token for testing purposes
contract SimpleToken is ERC20 {
    /*//////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        string memory _name,
        string memory _symbol,
        uint8 _decimals
    ) ERC20(_name, _symbol, _decimals) {}

    /*//////////////////////////////////////////////////////////////
                              MINT FUNCTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Mint tokens to a specific address
    /// @param to The address to mint tokens to
    /// @param amount The amount of tokens to mint
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /*//////////////////////////////////////////////////////////////
                              BURN FUNCTION
    //////////////////////////////////////////////////////////////*/

    /// @notice Burn tokens from a specific address
    /// @param from The address to burn tokens from
    /// @param amount The amount of tokens to burn
    function burn(address from, uint256 amount) external {
        _burn(from, amount);
    }
}
