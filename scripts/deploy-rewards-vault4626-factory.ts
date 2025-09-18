import { ethers } from 'hardhat';
import { writeFile } from 'fs/promises';

/**
 * Script to deploy RewardsVault4626Factory
 * This factory allows creating multiple RewardsVault4626 instances
 */
async function deployRewardsVault4626Factory() {
  console.log('🚀 Deploying RewardsVault4626Factory...');
  
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deployer address:', deployer.address);
  console.log('💰 Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  try {
    // Deploy RewardsVault4626Factory
    console.log('⏳ Deploying RewardsVault4626Factory...');
    const RewardsVault4626Factory = await ethers.getContractFactory('RewardsVault4626Factory');
    const factory = await RewardsVault4626Factory.deploy();
    await factory.waitForDeployment();

    const factoryAddress = await factory.getAddress();
    console.log('✅ RewardsVault4626Factory deployed to:', factoryAddress);

    // Get deployment transaction details
    const deploymentTx = factory.deploymentTransaction();
    if (deploymentTx) {
      console.log('📊 Deployment transaction hash:', deploymentTx.hash);
      console.log('⛽ Gas used:', deploymentTx.gasLimit?.toString());
    }

    // Verify factory owner
    const owner = await factory.owner();
    console.log('👤 Factory owner:', owner);

    // Save deployment information
    const deploymentData = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId.toString(),
      contracts: {
        RewardsVault4626Factory: {
          address: factoryAddress,
          deployer: deployer.address,
          owner: owner,
          deploymentTime: new Date().toISOString(),
          transactionHash: deploymentTx?.hash
        }
      }
    };

    const fileName = `deployment-rewards-vault4626-factory-${Date.now()}.json`;
    await writeFile(fileName, JSON.stringify(deploymentData, null, 2));
    console.log('💾 Deployment data saved to:', fileName);

    return {
      factory: factoryAddress,
      owner: owner,
      deployer: deployer.address
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

/**
 * Example function to create a RewardsVault4626 using the factory
 */
async function createExampleVault(factoryAddress: string, assetAddress: string) {
  console.log('🏭 Creating example RewardsVault4626...');
  
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractAt('RewardsVault4626Factory', factoryAddress);

  try {
    const vaultParams = {
      name: "Test Rewards Vault",
      symbol: "TRV",
      decimals: 18,
      lockPeriod: 86400 * 30, // 30 days in seconds
    };

    console.log('📋 Vault parameters:', vaultParams);
    console.log('🪙 Asset address:', assetAddress);

    const tx = await factory.createVaultWithParams(
      assetAddress,
      vaultParams.name,
      vaultParams.symbol,
      vaultParams.decimals,
      vaultParams.lockPeriod
    );

    const receipt = await tx.wait();
    console.log('⏳ Transaction hash:', tx.hash);

    // Get the vault address from the event
    const vaultCreatedEvent = receipt?.logs.find(
      (log: any) => {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsed?.name === 'VaultCreated';
        } catch {
          return false;
        }
      }
    );

    if (vaultCreatedEvent) {
      const parsed = factory.interface.parseLog({
        topics: vaultCreatedEvent.topics,
        data: vaultCreatedEvent.data
      });
      const vaultAddress = parsed?.args.vault;
      console.log('✅ RewardsVault4626 created at:', vaultAddress);
      
      // Verify vault info
      const vaultInfo = await factory.vaultInfo(vaultAddress);
      console.log('📊 Vault info:', {
        asset: vaultInfo.asset,
        name: vaultInfo.name,
        symbol: vaultInfo.symbol,
        decimals: vaultInfo.decimals,
        lockPeriod: vaultInfo.lockPeriod.toString(),
        deployer: vaultInfo.deployer
      });

      return vaultAddress;
    } else {
      throw new Error('Could not find VaultCreated event');
    }

  } catch (error) {
    console.error('❌ Vault creation failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    const deployment = await deployRewardsVault4626Factory();
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('📋 Summary:');
    console.log('  Factory Address:', deployment.factory);
    console.log('  Owner:', deployment.owner);
    console.log('  Deployer:', deployment.deployer);

    // Uncomment the following lines to create an example vault
    // Make sure to replace 'YOUR_ASSET_ADDRESS' with a valid ERC20 token address
    console.log('\n🔄 Creating example vault...');
    const exampleVault = await createExampleVault(
      deployment.factory,
      "0x322eA7052a392316be9f7281646108ed8044b405" // Replace with actual asset address
    );
    console.log('📍 Example vault created at:', exampleVault);

  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exitCode = 1;
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { deployRewardsVault4626Factory, createExampleVault };
