import { expect, ethers } from '../setup';
import { loadFixture } from '@nomicfoundation/hardhat-network-helpers';

async function deployFixture() {
  const [admin, keeper, otherKeeper, notKeeper, notAdmin] = await ethers.getSigners();

  const upkeeper = await ethers.deployContract('UpKeeper', admin);
  await upkeeper.waitForDeployment();
  const upkeeperAddress = await upkeeper.getAddress();

  const mockKeeperTarget = await ethers.deployContract('MockKeeperTarget');
  await mockKeeperTarget.waitForDeployment();
  const target = await mockKeeperTarget.getAddress();
  
  const mockKeeperTarget2 = await ethers.deployContract('MockKeeperTarget');
  await mockKeeperTarget2.waitForDeployment();
  const target2 = await mockKeeperTarget2.getAddress();

  // grant the keeper role to the keeper account
  await upkeeper.grantRole(await upkeeper.KEEPER_ROLE(), keeper.address);
  await upkeeper.grantRole(await upkeeper.KEEPER_ROLE(), otherKeeper.address);

  return {
    admin,
    notAdmin,
    keeper,
    otherKeeper,
    notKeeper,
    upkeeper,
    upkeeperAddress,
    target,
    mockKeeperTarget,
    target2,
  }
}

describe('Upkeeper', () => {
  describe('.registerTask()', () => {    
    it('should register a task', async () => {
      const { 
        admin,
        upkeeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);

      expect(await upkeeper.connect(admin).registerTask(target, selector))
       .to.emit(upkeeper, 'TaskRegistered')
       .withArgs(target, selector);

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(1);

      const task1 = await upkeeper.getTaskInfo(taskList[0]);
      expect(task1.target).to.equal(target);
      expect(task1.selector).to.equal(selector);
      expect(task1.executions).to.equal(0);
      expect(task1.exists).to.equal(true);
    });

    it('should revert when not admin', async () => {
      const { 
        upkeeper,
        notAdmin,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);

      await expect(upkeeper.connect(notAdmin).registerTask(target, selector))
        .to.be.rejectedWith('AccessControlUnauthorizedAccount')

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(0);
      
    });

    it('shoud revert when task already exists', async () => {
      const { 
        admin,
        upkeeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector);

      // try to register task again      
      await expect(upkeeper.connect(admin).registerTask(target, selector))
        .to.be.rejectedWith('TaskAlreadyExists');

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(1);
      
    });

    it('should register different tasks with same selector for different targets', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target,
        target2
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);

      expect(await upkeeper.connect(admin).registerTask(target, selector))
       .to.emit(upkeeper, 'TaskRegistered')
       .withArgs(keeper.address, target, selector);

      expect(await upkeeper.connect(admin).registerTask(target2, selector))
        .to.emit(upkeeper, 'TaskRegistered')
        .withArgs(keeper.address, target2, selector);

      // check that both tasks are registered
      const tasksForKeeper = await upkeeper.getTaskList();
      expect(tasksForKeeper.length).to.equal(2);

      const task1 = await upkeeper.getTaskInfo(tasksForKeeper[0]);
      const task2 = await upkeeper.getTaskInfo(tasksForKeeper[1]);

      expect(task1.target).to.equal(target);
      expect(task1.selector).to.equal(selector);

      expect(task2.target).to.equal(target2);
      expect(task2.selector).to.equal(selector);
    });
  });

  describe('.removeTask()', () => {    
    it('should remove a task', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector);
      expect(await upkeeper.connect(admin).removeTask(target, selector))
       .to.emit(upkeeper, 'TaskRemoved')
       .withArgs(keeper.address, target, selector);

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(0);
      
    });

    it('should revert when not admin', async () => {
      const { 
        admin,
        notAdmin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);
      await upkeeper.connect(admin).registerTask(target, selector);

      await expect(upkeeper.connect(notAdmin).removeTask(target, selector))
        .to.be.rejectedWith('AccessControlUnauthorizedAccount')
      
    });

    it('should revert when task is not found', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunction()').slice(0, 10);

      await expect(upkeeper.connect(admin).removeTask(target, selector))
        .to.be.rejectedWith('TaskNotFound');
      
    });
  });

  describe('.executeTask()', () => {    
    it('should execute a task', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
      } = await loadFixture(deployFixture);
      
      const selector = ethers.id('mockFunction()').slice(0, 10);
      
      await upkeeper.connect(admin).registerTask(target, selector);
      const [taskId] = await upkeeper.getTaskList();

      // execute the task
      await expect(upkeeper.connect(keeper).executeTask(taskId, '0x'))
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector, 1);

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(1);

      const task1 = await upkeeper.getTaskInfo(taskList[0]);
      expect(task1.target).to.equal(target);
      expect(task1.selector).to.equal(selector);
      expect(task1.executions).to.equal(1);
      expect(task1.exists).to.equal(true);
    });

    it('should execute a task with params', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunctionWithArgs(uint256,address)').slice(0, 10);
      const data = ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address'], [42, ethers.ZeroAddress]);

      await upkeeper.connect(admin).registerTask(target, selector);
      const [taskId] = await upkeeper.getTaskList();

      // execute the task with params
      await expect(upkeeper.connect(keeper).executeTask(taskId, data))
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector, 1);

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(1);

      const task1 = await upkeeper.getTaskInfo(taskList[0]);
      expect(task1.executions).to.equal(1);
    });

    it('should revert if task reverted', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector = ethers.id('mockFunctionRevert()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector);
      const [taskId] = await upkeeper.getTaskList();

      // execute the task
      await expect(upkeeper.connect(keeper).executeTask(taskId, '0x'))
        .to.be.rejectedWith('TaskExecutionFailed');

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(1);

      const task1 = await upkeeper.getTaskInfo(taskList[0]);
      expect(task1.executions).to.equal(0);
    });

    it('should revert if task not found', async () => {
      const { 
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const taskId = ethers.id("non existing task id");

      // execute the task without registering it
      await expect(upkeeper.connect(keeper).executeTask(taskId, '0x'))
        .to.be.rejectedWith('TaskNotFound');
    });  

    it.skip("should revert on reentrant execution of the same task", async () => {
      const { 
        admin,
        upkeeper,
        upkeeperAddress,
        keeper,
        target,
        mockKeeperTarget
       } = await loadFixture(deployFixture);

      // Prepare selector and taskId
      const selector = mockKeeperTarget.interface.getFunction("mockFunctionRevertReentrantTask").selector;

      // Register the task
      await upkeeper.connect(admin).registerTask(target, selector);

      const [taskId] = await upkeeper.getTaskList();

      // Encode arguments: upkeeper address, taskId, data (empty for this demo)
      const args = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "bytes32"],
        [upkeeperAddress, taskId]
      );

      // Should revert with TaskReentrancyDetected
      await expect(
        upkeeper.connect(keeper).executeTask(taskId, args)
      ).to.be.rejectedWith("TaskReentrancyDetected");
    });
  });

  describe('.executeTasksWithArgs()', () => {
    it('should execute all tasks for a keeper', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector1 = ethers.id('mockFunction()').slice(0, 10);
      const selector2 = ethers.id('mockFunctionWithArgs(uint256,address)').slice(0, 10);
      
      const data = [];
      data.push('0x'); // no params for the first selector
      data.push(ethers.AbiCoder.defaultAbiCoder().encode(['uint256', 'address'], [42, ethers.ZeroAddress]));

      await upkeeper.connect(admin).registerTask(target, selector1);
      await upkeeper.connect(admin).registerTask(target, selector2);

      // execute the tasks
      await expect(upkeeper.connect(keeper).executeTasksWithArgs(data))
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector1, 1)
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector2, 1);
    });

    it('should revert if one task fails', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector1 = ethers.id('mockFunction()').slice(0, 10);
      const selector2 = ethers.id('mockFunctionRevert()').slice(0, 10);
      
      const data = [];
      data.push('0x'); // no params for the first selector
      data.push('0x'); // no params for the second selector

      await upkeeper.connect(admin).registerTask(target, selector1);
      await upkeeper.connect(admin).registerTask(target, selector2);

      // execute the tasks
      await expect(upkeeper.connect(keeper).executeTasksWithArgs(data))
        .to.be.rejectedWith('TaskExecutionFailed');
    });

    it('should revert when not keeper', async () => {
      const { 
        upkeeper,
        notKeeper,
        target
       } = await loadFixture(deployFixture);

      // const selector = ethers.id('mockFunction()').slice(0, 10);
      const data = ['0x'];

      // try to execute tasks as a non-keeper
      await expect(upkeeper.connect(notKeeper).executeTasksWithArgs(data))
        .to.be.rejectedWith('AccessControlUnauthorizedAccount');
    });

    it('should revert if task not found', async () => {
      const { 
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);


      // try to execute tasks without registering them
      await expect(upkeeper.connect(keeper).executeTasksWithArgs([]))
        .to.be.rejectedWith('TaskNotFound');
    });
  });

  describe('.executeKeeperTasks()', () => {
    it('should execute all tasks for a keeper', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target,
        mockKeeperTarget
       } = await loadFixture(deployFixture);

      const selector1 = ethers.id('mockFunction()').slice(0, 10);
      const selector2 = ethers.id('mockFunction2()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector1);
      await upkeeper.connect(admin).registerTask(target, selector2);

      // execute the tasks
      await expect(upkeeper.connect(keeper).executeTasks())
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector1, 1)
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector2, 1);

      expect(await mockKeeperTarget.callCount()).to.equal(2);

      const taskList = await upkeeper.getTaskList();
      expect(taskList.length).to.equal(2);

      const task1 = await upkeeper.getTaskInfo(taskList[0]);
      expect(task1.executions).to.equal(1);

      const task2 = await upkeeper.getTaskInfo(taskList[1]);
      expect(task2.executions).to.equal(1);
    });

    it('should revert if one task fails', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target,
        mockKeeperTarget
       } = await loadFixture(deployFixture);

      const selector1 = ethers.id('mockFunction()').slice(0, 10);
      const selector2 = ethers.id('mockFunctionRevert()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector1);
      await upkeeper.connect(admin).registerTask(target, selector2);

      // execute the tasks
      await expect(upkeeper.connect(keeper).executeTasks())
        .to.be.rejectedWith('TaskExecutionFailed');

      expect(await mockKeeperTarget.callCount()).to.equal(0);
    });

    it('should revert if one task returns false', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector1 = ethers.id('mockFunction()').slice(0, 10);
      const selector2 = ethers.id('mockFunctionReturnFalse()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector1);
      await upkeeper.connect(admin).registerTask(target, selector2);

      // execute the tasks
      await expect(upkeeper.connect(keeper).executeTasks())
        .to.be.rejectedWith('TaskExecutionReturnedFalse');
    });

    it('should execute if one task does not return a bool', async () => {
      const { 
        admin,
        upkeeper,
        keeper,
        target
       } = await loadFixture(deployFixture);

      const selector1 = ethers.id('mockFunction()').slice(0, 10);
      const selector2 = ethers.id('mockFunctionNoReturn()').slice(0, 10);

      await upkeeper.connect(admin).registerTask(target, selector1);
      await upkeeper.connect(admin).registerTask(target, selector2);

      // execute the tasks
      await expect(upkeeper.connect(keeper).executeTasks())
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector1, 1)
        .to.emit(upkeeper, 'TaskExecuted')
        .withArgs(keeper.address, target, selector2, 1);
    });

    it('should revert when not keeper', async () => {
      const { 
        upkeeper,
        notKeeper,
       } = await loadFixture(deployFixture);

      // try to execute tasks as a non-keeper
      await expect(upkeeper.connect(notKeeper).executeTasks())
        .to.be.rejectedWith('AccessControlUnauthorizedAccount');
    });

    it('should revert if task not found', async () => {
      const { 
        upkeeper,
        keeper,
       } = await loadFixture(deployFixture);

      // try to execute tasks without registering them
      await expect(upkeeper.connect(keeper).executeTasks())
        .to.be.rejectedWith('TaskNotFound');
    });
  });
});
