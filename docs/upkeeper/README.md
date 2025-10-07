# Upkeeper

The Upkeeper contract is a task execution system designed to automate periodic operations across the Hedera RWA DeFi ecosystem. It provides a secure, role-based mechanism for executing predefined tasks on target contracts.

## 📋 Overview

The Upkeeper contract provides:

-   **Task Registration**: Register tasks for automated execution
-   **Task Execution**: Execute tasks on target contracts
-   **Role-Based Access**: Different roles for different operations
-   **Reentrancy Protection**: Secure against reentrancy attacks
-   **Task Management**: Add, remove, and manage tasks

## 🏗️ Architecture

### Key Features

-   **Task Registry**: Centralized task management
-   **Execution Engine**: Secure task execution
-   **Role-Based Access**: Granular permission control
-   **Reentrancy Protection**: Protection against reentrancy attacks
-   **Task Tracking**: Execution history and statistics

### Contract Structure

```solidity
contract UpKeeper is AccessControl, ReentrancyGuard, IUpKeeper {
    // Roles
    bytes32 public constant TRUSTED_REGISTRY_ROLE = keccak256("TRUSTED_REGISTRY_ROLE");
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    // Task management
    mapping(bytes32 => Task) private tasks;
    mapping(address => bytes32[]) private keeperTasks;
    bytes32[] private taskList;
}
```

## 🔧 Core Functions

### Task Management

#### Register Task

```solidity
function registerTask(address target, bytes4 selector) external onlyRole(TRUSTED_REGISTRY_ROLE)
```

**Parameters:**

-   `target`: Target contract address
-   `selector`: Function selector to execute

**Process:**

1. Generates unique task ID
2. Validates task doesn't already exist
3. Creates task record
4. Adds task to task list
5. Emits task registered event

#### Remove Task

```solidity
function removeTask(address target, bytes4 selector) external onlyRole(TRUSTED_REGISTRY_ROLE)
```

**Parameters:**

-   `target`: Target contract address
-   `selector`: Function selector to remove

**Process:**

1. Validates task exists
2. Removes task from storage
3. Removes task from task list
4. Emits task removed event

### Task Execution

#### Execute Single Task

```solidity
function executeTask(bytes32 taskId, bytes memory data) external nonReentrantTask(taskId) nonReentrant onlyRole(KEEPER_ROLE)
```

**Parameters:**

-   `taskId`: Task ID to execute
-   `data`: Calldata to pass to target function

**Process:**

1. Validates task exists
2. Executes task on target contract
3. Validates execution success
4. Updates execution count
5. Emits execution event

#### Execute All Tasks

```solidity
function executeTasks() external nonReentrant onlyRole(KEEPER_ROLE)
```

**Process:**

1. Iterates through all registered tasks
2. Executes each task with empty calldata
3. Updates execution counts
4. Emits execution events

#### Execute Tasks with Arguments

```solidity
function executeTasksWithArgs(bytes[] calldata data) external nonReentrant onlyRole(KEEPER_ROLE)
```

**Parameters:**

-   `data`: Array of calldata for each task

**Process:**

1. Iterates through all registered tasks
2. Executes each task with corresponding calldata
3. Updates execution counts
4. Emits execution events

## 📊 Data Structures

### Task

```solidity
struct Task {
    address target;     // Target contract address
    bytes4 selector;    // Function selector
    uint256 executions; // Number of executions
    bool executing;     // Currently executing flag
    bool exists;        // Task exists flag
}
```

## 🔍 Query Functions

### Get Task List

```solidity
function getTaskList() external view returns (bytes32[] memory)
```

Returns array of all registered task IDs.

### Get Task Info

```solidity
function getTaskInfo(bytes32 taskId) external view returns (Task memory)
```

Returns complete task information for a specific task ID.

## 🚀 Deployment

### Constructor

```solidity
constructor()
```

The constructor initializes the contract with:

-   Deployer as admin
-   Deployer as trusted registry
-   Deployer as keeper

### Deployment Example

```typescript
// Deploy Upkeeper
const upkeeper = await ethers.deployContract("UpKeeper");

console.log("Upkeeper deployed to:", upkeeper.target);
```

## 🔒 Security Considerations

### Access Control

-   **TRUSTED_REGISTRY_ROLE**: Task registration and removal
-   **KEEPER_ROLE**: Task execution
-   **DEFAULT_ADMIN_ROLE**: Role management

### Reentrancy Protection

-   **Task-Level Protection**: `nonReentrantTask` modifier prevents reentrancy
-   **Contract-Level Protection**: `nonReentrant` modifier on all external functions
-   **Execution State**: Tracks execution state to prevent reentrancy

### Task Validation

-   **Task Existence**: Validates tasks exist before execution
-   **Execution Success**: Validates task execution success
-   **Return Value**: Checks return values for boolean functions

## 🧪 Testing

### Test Coverage

The Upkeeper includes comprehensive tests:

-   Task registration and removal
-   Task execution functionality
-   Role-based access control
-   Reentrancy protection
-   Edge cases and error conditions

### Running Tests

```bash
# Run upkeeper tests
yarn hardhat test test/upkeeper/upkeeper.test.ts

# Run with gas reporting
yarn hardhat test test/upkeeper/upkeeper.test.ts --gas-report
```

## 📚 Usage Examples

### Task Registration

```typescript
// Connect to Upkeeper
const upkeeper = await ethers.getContractAt("UpKeeper", upkeeperAddress);

// Register task for vault rebalancing
const rebalanceSelector = "0x12345678"; // Function selector
await upkeeper.registerTask(vaultAddress, rebalanceSelector);

// Register task for treasury payment
const paymentSelector = "0x87654321"; // Function selector
await upkeeper.registerTask(treasuryAddress, paymentSelector);
```

### Task Execution

```typescript
// Execute single task
const taskId = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "bytes4"], [vaultAddress, rebalanceSelector]),
);

await upkeeper.executeTask(taskId, "0x"); // Empty calldata

// Execute all tasks
await upkeeper.executeTasks();

// Execute tasks with specific data
const calldata = [
    "0x", // Empty for first task
    ethers.AbiCoder.defaultAbiCoder().encode(["address", "uint256"], [recipientAddress, ethers.parseEther("1000")]),
];
await upkeeper.executeTasksWithArgs(calldata);
```

### Task Management

```typescript
// Get all tasks
const taskList = await upkeeper.getTaskList();

// Get task information
for (const taskId of taskList) {
    const taskInfo = await upkeeper.getTaskInfo(taskId);
    console.log("Target:", taskInfo.target);
    console.log("Selector:", taskInfo.selector);
    console.log("Executions:", taskInfo.executions);
}

// Remove task
await upkeeper.removeTask(vaultAddress, rebalanceSelector);
```

## 🔗 Integration Points

### With Vault Contracts

The Upkeeper integrates with vault contracts to:

-   **Rebalancing**: Execute periodic rebalancing
-   **Reward Distribution**: Distribute rewards
-   **Yield Optimization**: Optimize yield strategies
-   **Maintenance**: Perform maintenance tasks

### With Treasury Contracts

The Upkeeper integrates with treasury contracts to:

-   **Payment Processing**: Execute scheduled payments
-   **Fund Distribution**: Distribute funds
-   **Reserve Management**: Manage reserves
-   **Excess Forwarding**: Forward excess funds

### With Building Contracts

The Upkeeper integrates with building contracts to:

-   **Governance**: Execute governance proposals
-   **Compliance**: Update compliance settings
-   **Audit**: Trigger audit processes
-   **Maintenance**: Perform building maintenance

## 📈 Gas Optimization

### Efficient Execution

-   **Batch Execution**: Execute multiple tasks in single transaction
-   **Gas Estimation**: Pre-calculate gas costs
-   **State Management**: Minimize state changes
-   **Event Optimization**: Minimal event data

### Task Management

-   **Efficient Storage**: Optimized data structures
-   **Index Management**: Efficient task indexing
-   **Memory Usage**: Optimized memory operations
-   **Gas Tracking**: Monitor gas usage

## 🚨 Error Handling

### Custom Errors

```solidity
error TaskAlreadyExists();
error TaskNotFound();
error TaskReentrancyDetected();
error TaskExecutionFailed(bytes response);
error TaskExecutionReturnedFalse();
```

### Revert Conditions

-   Task already exists during registration
-   Task not found during execution
-   Reentrancy detected during execution
-   Task execution failed
-   Task returned false

## 🔄 Upgrade Path

The Upkeeper contract is not upgradeable by design. For updates:

1. Deploy new version
2. Migrate existing tasks
3. Update integration points
4. Maintain backward compatibility

## 📊 Monitoring

### Key Metrics

-   **Task Count**: Number of registered tasks
-   **Execution Frequency**: How often tasks are executed
-   **Success Rate**: Task execution success rate
-   **Gas Usage**: Gas consumption per execution

### Events to Monitor

```solidity
// Task management events
event TaskRegistered(address indexed target, bytes4 indexed selector);
event TaskRemoved(address indexed target, bytes4 indexed selector);

// Execution events
event TaskExecuted(
    address indexed executor,
    address indexed target,
    bytes4 indexed selector,
    uint256 executions
);
```

## 📞 Support

For questions or issues related to the Upkeeper:

-   Check the test files for usage examples
-   Review the contract source code
-   Open an issue in the repository
-   Contact the development team

---

**Next Steps:**

-   [Vault V2 Documentation](../vault/README.md)
-   [Back to Main Documentation](../README.md)
