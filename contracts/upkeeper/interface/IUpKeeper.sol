//SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IUpKeeper
 * @author Bruno Campos
 * @dev interface of the UpKeeper
 */
interface IUpKeeper {
    struct Task {
        uint256 executions;
        address target;
        bytes4 selector;
        bool exists;
        bool executing;
    }

    error TaskAlreadyExists();
    error TaskNotFound();
    error TaskExecutionFailed(bytes response);
    error TaskExecutionReturnedFalse();
    error TooManyTasksForKeeper();
    error Degub(address target, bytes4 selector, bytes data, bool success, bytes response);
    error TaskReentrancyDetected();
    error NotTaskKeeper(address notKeeper);

    event TaskExecuted(address indexed keeper, address indexed target, bytes4 selector, uint256 executions);
    event TaskRegistered(address indexed target, bytes4 selector);
    event TaskRemoved(address indexed target, bytes4 selector);

    /**
     * @dev This function returns the list of tasks assigned to a specific keeper.
     */
    function getTaskList() external view returns (bytes32[] memory);

    /**
     * 
     * @param taskId the unique identifier of the task
     * @dev This function returns the information of a specific task based on taskId.
     */
    function getTaskInfo(bytes32 taskId) external view returns (Task memory);


    /**
     * @param target the target contract that will be called
     * @param selector the function selector of the target contract
     * @dev This function allows the admin to register a task for a keeper.
     */
    function registerTask(address target, bytes4 selector) external;

    /**
     * @param target the target contract that will be called
     * @param selector the function selector of the target contract
     * @dev This function allows the admin to remove a task for a keeper.
     */
    function removeTask(address target, bytes4 selector) external;

    /**
     * @param taskId id of the task
     * @param data the data to be passed to the target contract
     * @dev This function allows a keeper to execute a task on a target contract.
     */
    function executeTask(bytes32 taskId, bytes memory data) external;

    /**
     * 
     * @dev This function allows a keeper to execute all tasks assigned to them.
     */
    function executeTasks() external;

    /**
     * @param data the data to be passed to the target contract
     * @dev This function allows a keeper to execute all tasks assigned to them with specific data
     */
    function executeTasksWithArgs(bytes[] calldata data) external ;
}
