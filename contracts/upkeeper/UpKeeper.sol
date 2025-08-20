//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IUpKeeper} from "./interface/IUpKeeper.sol";

/**
 * @title UpKeeper
 * @author Bruno Campos
 * @dev This contract is designed to be used as a base for contracts that require periodic upkeep
 * and rescheduling functionality. It provides a mechanism to track executions and manage
 * the rescheduling state of tasks.
 */
contract UpKeeper is AccessControl, ReentrancyGuard, IUpKeeper {
    // Define roles
    bytes32 public constant TRUSTED_REGISTRY_ROLE = keccak256("TRUSTED_REGISTRY_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    
    // define storage
    mapping (bytes32 => Task) private tasks;
    mapping (address => bytes32[]) private keeperTasks;
    bytes32[] private taskList;

    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(TRUSTED_REGISTRY_ROLE, msg.sender);
        _grantRole(KEEPER_ROLE, msg.sender);
    }

    // This modifier ensures that any attempt to recursively execute the same task within the same transaction is immediately reverted, 
    // fully protecting against classic and advanced single-task reentrancy exploits.
    modifier nonReentrantTask(bytes32 taskId) {
        Task storage task = tasks[taskId];

        if (task.executing) {
            revert TaskReentrancyDetected();
        }

        task.executing = true;
        _;
        task.executing = false;
    }

    /**
     * @dev This function returns the list of tasks assigned to a specific keeper.
     */
    function getTaskList() external view returns (bytes32[] memory) {
        return taskList;
    }

    /**
     * 
     * @param taskId the unique identifier of the task
     * @dev This function returns the information of a specific task based on taskId.
     */
    function getTaskInfo(bytes32 taskId) external view returns (Task memory) {
        return tasks[taskId];
    }

    /**
     * @param target the target contract that will be called
     * @param selector the function selector of the target contract
     * @dev This function allows the admin to register a task for a keeper.
     */
    function registerTask(address target, bytes4 selector) external onlyRole(TRUSTED_REGISTRY_ROLE) {
        bytes32 taskId = keccak256(abi.encodePacked(target, selector));

        if (tasks[taskId].exists) {
            revert TaskAlreadyExists();
        }

        tasks[taskId] = Task({
            target: target,
            selector: selector,
            executions: 0,
            executing: false,
            exists: true
        });

        taskList.push(taskId);

        emit TaskRegistered(target, selector);
    }

    /**
     * @param target the target contract that will be called
     * @param selector the function selector of the target contract
     * @dev This function allows the admin to remove a task for a keeper.
     */
    function removeTask(address target, bytes4 selector) external onlyRole(TRUSTED_REGISTRY_ROLE) {
        bytes32 taskId = keccak256(abi.encodePacked(target, selector));

        if (!tasks[taskId].exists) {
            revert TaskNotFound();
        }

        delete tasks[taskId];

        for (uint256 i = 0; i < taskList.length; i++) {
            if (taskList[i] == taskId) {
                taskList[i] = taskList[taskList.length - 1]; // Move last element to the current position
                taskList.pop(); // Remove last element
                break;
            }
        }

        emit TaskRemoved(target, selector);
    }

    /**
     * @param taskId id of the task
     * @param data the data to be passed to the target contract
     * @dev This function allows a keeper to execute a task on a target contract.
     */
    function executeTask(bytes32 taskId, bytes memory data) external nonReentrantTask(taskId) nonReentrant onlyRole(KEEPER_ROLE) {
        _executeTask(taskId, data);
    }

    /**
     * @dev This function allows a keeper to execute all tasks assigned to them.
     * It iterates through the tasks assigned to the keeper and executes them.
     * If no tasks are found, it reverts with a TaskNotFound error.
     */
    function executeTasks() external nonReentrant onlyRole(KEEPER_ROLE) {
        if (taskList.length == 0) {
            revert TaskNotFound();
        }

        for (uint256 i = 0; i < taskList.length; i++) {
            bytes32 taskId = taskList[i];
            Task storage task = tasks[taskId];
            if (task.exists) {
                _executeTask(taskId, new bytes(0));
            }
        }
    }

    /**
     * @param data the data to be passed to the target contract
     * @dev This function allows a keeper to execute all tasks assigned to them with specific data
     * It iterates through the tasks assigned to the keeper and executes them with the provided data.
     * If no tasks are found, it reverts with a TaskNotFound error.
     */
    function executeTasksWithArgs(bytes[] calldata data) external nonReentrant onlyRole(KEEPER_ROLE) {
        if (taskList.length == 0) {
            revert TaskNotFound();
        }

        for (uint256 i = 0; i < taskList.length; i++) {
            bytes32 taskId = taskList[i];
            Task storage task = tasks[taskId];
            if (task.exists) {
                _executeTask(taskId, data[i]);
            }
        }
    }

    /**
     * @param taskId is of the task
     * @param data the data to be passed to the target contract
     * @dev This function executes a specific task by its target and selector.
     * It checks if the task exists, executes it, and emits an event with execution details.
     */
    function _executeTask(bytes32 taskId, bytes memory data) internal {
        Task storage task = tasks[taskId];

        if (!task.exists) {
            revert TaskNotFound();
        }

        (bool success, bytes memory response) = task.target.call(abi.encodeWithSelector(task.selector, data));        


        if (!success) {
            revert TaskExecutionFailed(response);
        }

        if (response.length == 32) {
            if (!abi.decode(response, (bool))) {
                revert TaskExecutionReturnedFalse();
            }
        }                

        task.executions++;
        emit TaskExecuted(msg.sender, task.target, task.selector, task.executions);
    }
}
