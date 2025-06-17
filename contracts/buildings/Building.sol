// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {BuildingBase} from './BuildingBase.sol';
import {BuildingAudit} from "./extensions/BuildingAudit.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Building is BuildingBase, BuildingAudit {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * Contract initializer
     * @param _initialOwner initial owner
     */
    function initialize (address _initialOwner) public virtual initializer {
        __Building_init(_initialOwner);
        __Audit_init();
    }
}
