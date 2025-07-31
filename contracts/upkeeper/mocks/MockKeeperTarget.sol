//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {IUpKeeper} from "../interface/IUpKeeper.sol";


/**
 * @title UpKeeper
 * @author Bruno Campos
 * @dev This contract is designed to be used as a base for contracts that require periodic upkeep
 * and rescheduling functionality. It provides a mechanism to track executions and manage
 * the rescheduling state of tasks.
 */
contract MockKeeperTarget{
    uint256 public callCount;

    modifier count() {
        callCount++;
        _;
    }
 
    function mockFunction() external count returns (bool) {
        // This is a mock function to be used in tests
        return true;
    }

    function mockFunction2() external count returns (bool) {
        // This is a mock function to be used in tests
        return true;
    }

    function mockFunctionWithArgs(uint256 arg1, address arg2) external count returns (bool) {
        // This is a mock function with arguments to be used in tests
        return true;
    }

    function mockFunctionReturnFalse() external count returns (bool) {
        // This is a mock function that returns false to be used in tests
        return false;
    }

    function mockFunctionNoReturn() external count {
        // This is a mock function that returns false to be used in tests
    }

    function mockFunctionRevert() external count returns (bool) {
        // This is a mock function that reverts to be used in tests
        revert("Mock function revert");
    }

    function mockFunctionRevertReentrantTask(address upkeeper, bytes32 taskId) count external returns (bool) {
        // Try to re-enter the same task (should fail)
        IUpKeeper(upkeeper).executeTask(taskId, abi.encode(upkeeper, taskId));
        return true;
    }
}
