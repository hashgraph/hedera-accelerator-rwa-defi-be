// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract BuildingERC20 is ERC20, Ownable {
    uint8 customDecimals;

    constructor(string memory name, string memory symbol, uint8 _customDecimals) ERC20(name, symbol) Ownable(msg.sender) {
        customDecimals = _customDecimals;
    }

    function decimals() public view virtual override returns (uint8) {
        return customDecimals;
    }

    function mint(address to, uint256 amount) external onlyOwner {
        require(to != address(0), "BuildingERC20: Invalid address");
        require(amount > 0, "BuildingERC20: Invalid amount");
        _mint(to, amount);
    }
}
