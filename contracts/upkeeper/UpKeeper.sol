//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title UpKeeper
 * @author Bruno Campos
 * @dev This contract is designed to be used as a base for contracts that require periodic upkeep
 * and rescheduling functionality. It provides a mechanism to track executions and manage
 * the rescheduling state of tasks.
 */
contract UpKeeper is AccessControl, ReentrancyGuard {
    // Define Upkeeper role
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    struct KeeperTask {
        address keeper;
        uint256 executions;
        bool exists;
        bool executing;
        address target;
        bytes4 selector;
    }
    
    mapping (bytes32 => KeeperTask) private tasks;
    mapping (address => bytes32[]) private keeperTasks;

    error TaskAlreadyExists();
    error TaskNofFound();
    error TaskExecutionFailed(bytes response);
    error TaskExecutionReturnedFalse();
    error TooManyTasksForKeeper();
    error Degub(address target, bytes4 selector, bytes data, bool success, bytes response);
    error TaskReentrancyDetected();
    error NotTeskKeeper(address notKeeper);

    event TaskExecuted(address indexed keeper, address indexed target, bytes4 selector, uint256 executions);
    event TaskRegistered(address indexed keeper, address indexed target, bytes4 selector);
    event TaskRemoved(address indexed keeper, address indexed target, bytes4 selector);


    constructor() {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }

    // This modifier ensures that any attempt to recursively execute the same task within the same transaction is immediately reverted, 
    // fully protecting against classic and advanced single-task reentrancy exploits.
    modifier nonReentrantTask(bytes32 taskId) {
        KeeperTask storage task = tasks[taskId];

        if (task.executing) {
            revert TaskReentrancyDetected();
        }

        task.executing = true;
        _;
        task.executing = false;
    }

    /**
     * @param keeper address of the keeper that will execute the task
     * @dev This function returns the list of tasks assigned to a specific keeper.
     */
    function getTaskList(address keeper) external view returns (bytes32[] memory) {
        return keeperTasks[keeper];
    }

    /**
     * 
     * @param taskId the unique identifier of the task
     * @dev This function returns the information of a specific task based on taskId.
     */
    function getTaskInfo(bytes32 taskId) external view returns (KeeperTask memory) {
        return tasks[taskId];
    }

    /**
     * @param keeper address of the keeper that will execute the task
     * @param target the target contract that will be called
     * @param selector the function selector of the target contract
     * @dev This function allows the admin to register a task for a keeper.
     */
    function registerTask(address keeper, address target, bytes4 selector) external onlyRole(DEFAULT_ADMIN_ROLE) {
         // limit the number of tasks per keeper
        if (keeperTasks[keeper].length >= 100) {
            revert TooManyTasksForKeeper();
        }

        bytes32 taskId = keccak256(abi.encodePacked(keeper, target, selector));

        if (tasks[taskId].exists) {
            revert TaskAlreadyExists();
        }

        tasks[taskId] = KeeperTask({
            keeper: keeper,
            target: target,
            selector: selector,
            executions: 0,
            executing: false,
            exists: true
        });

        keeperTasks[keeper].push(taskId);

        emit TaskRegistered(keeper, target, selector);
    }

    /**
     * @param keeper address of the keeper that will execute the task
     * @param target the target contract that will be called
     * @param selector the function selector of the target contract
     * @dev This function allows the admin to remove a task for a keeper.
     */
    function removeTask(address keeper, address target, bytes4 selector) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 taskId = keccak256(abi.encodePacked(keeper, target, selector));

        if (!tasks[taskId].exists) {
            revert TaskNofFound();
        }

        delete tasks[taskId];

        // Remove task from keeper's task list
        bytes32[] storage taskList = keeperTasks[keeper];
        for (uint256 i = 0; i < taskList.length; i++) {
            if (taskList[i] == taskId) {
                taskList[i] = taskList[taskList.length - 1]; // Move last element to the current position
                taskList.pop(); // Remove last element
                break;
            }
        }

        emit TaskRemoved(keeper, target, selector);
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
     * 
     * @param keeper address of the keeper that will execute the tasks
     * @dev This function allows a keeper to execute all tasks assigned to them.
     * It iterates through the tasks assigned to the keeper and executes them.
     * If no tasks are found, it reverts with a TaskNofFound error.
     */
    function executeKeeperTasks(address keeper) external nonReentrant onlyRole(KEEPER_ROLE) {
        bytes32[] storage taskList = keeperTasks[keeper];

        if (taskList.length == 0) {
            revert TaskNofFound();
        }

        for (uint256 i = 0; i < taskList.length; i++) {
            bytes32 taskId = taskList[i];
            KeeperTask storage task = tasks[taskId];
            if (task.exists) {
                _executeTask(taskId, new bytes(0));
            }
        }
    }

    /**
     * 
     * @param keeper address of the keeper that will execute the tasks
     * @param data the data to be passed to the target contract
     * @dev This function allows a keeper to execute all tasks assigned to them with specific data
     * It iterates through the tasks assigned to the keeper and executes them with the provided data.
     * If no tasks are found, it reverts with a TaskNofFound error.
     */
    function executeKeeperTasksWithArgs(address keeper, bytes[] calldata data) external nonReentrant onlyRole(KEEPER_ROLE) {
        bytes32[] storage taskList = keeperTasks[keeper];

        if (taskList.length == 0) {
            revert TaskNofFound();
        }

        for (uint256 i = 0; i < taskList.length; i++) {
            bytes32 taskId = taskList[i];
            KeeperTask storage task = tasks[taskId];
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
        KeeperTask storage task = tasks[taskId];

        if (!task.exists) {
            revert TaskNofFound();
        }
        
        if (task.keeper != msg.sender) {
            revert NotTeskKeeper(msg.sender);
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
        emit TaskExecuted(task.keeper, task.target, task.selector, task.executions);
    }
}
