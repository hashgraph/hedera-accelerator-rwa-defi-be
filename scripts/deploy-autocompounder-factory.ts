import { ethers } from 'hardhat';
import { writeFile } from 'fs/promises';

/**
 * Script to deploy AutoCompounderFactory (RewardsVaultAutoCompounderFactory)
 * This factory allows creating multiple AutoCompounder instances
 */
async function deployAutoCompounderFactory(
  uniswapRouterAddress: string,
  intermediateTokenAddress: string,
  defaultMinimumClaimThreshold: bigint = ethers.parseUnits("10", 6), // 10 USDC
  defaultMaxSlippage: number = 500 // 5% in basis points
) {
  console.log('🚀 Deploying AutoCompounderFactory...');
  
  const [deployer] = await ethers.getSigners();
  console.log('📝 Deployer address:', deployer.address);
  console.log('💰 Deployer balance:', ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

  try {
    // Deploy RewardsVaultAutoCompounderFactory
    console.log('⏳ Deploying RewardsVaultAutoCompounderFactory...');
    const AutoCompounderFactory = await ethers.getContractFactory('RewardsVaultAutoCompounderFactory');
    const factory = await AutoCompounderFactory.deploy(
      uniswapRouterAddress,
      intermediateTokenAddress,
      defaultMinimumClaimThreshold,
      defaultMaxSlippage
    );
    await factory.waitForDeployment();

    const factoryAddress = await factory.getAddress();
    console.log('✅ AutoCompounderFactory deployed to:', factoryAddress);

    // Get deployment transaction details
    const deploymentTx = factory.deploymentTransaction();
    if (deploymentTx) {
      console.log('📊 Deployment transaction hash:', deploymentTx.hash);
      console.log('⛽ Gas used:', deploymentTx.gasLimit?.toString());
    }

    // Verify factory configuration
    const owner = await factory.owner();
    const defaultRouter = await factory.DEFAULT_UNISWAP_ROUTER();
    const defaultToken = await factory.DEFAULT_INTERMEDIATE_TOKEN();
    
    console.log('👤 Factory owner:', owner);
    console.log('🔄 Default Uniswap router:', defaultRouter);
    console.log('🪙 Default intermediate token:', defaultToken);

    // Save deployment information
    const deploymentData = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId.toString(),
      contracts: {
        RewardsVaultAutoCompounderFactory: {
          address: factoryAddress,
          deployer: deployer.address,
          owner: owner,
          defaultUniswapRouter: defaultRouter,
          defaultIntermediateToken: defaultToken,
          deploymentTime: new Date().toISOString(),
          transactionHash: deploymentTx?.hash
        }
      }
    };

    const fileName = `deployment-autocompounder-factory-${Date.now()}.json`;
    await writeFile(fileName, JSON.stringify(deploymentData, null, 2));
    console.log('💾 Deployment data saved to:', fileName);

    return {
      factory: factoryAddress,
      owner: owner,
      deployer: deployer.address,
      defaultRouter: defaultRouter,
      defaultToken: defaultToken
    };

  } catch (error) {
    console.error('❌ Deployment failed:', error);
    throw error;
  }
}

/**
 * Example function to create an AutoCompounder using the factory
 */
async function createExampleAutoCompounder(
  factoryAddress: string,
  vaultAddress: string
) {
  console.log('🏭 Creating example AutoCompounder...');
  
  const [deployer] = await ethers.getSigners();
  const factory = await ethers.getContractAt('RewardsVaultAutoCompounderFactory', factoryAddress);

  try {
    const autoCompounderParams = {
      name: "Test Auto Compounder",
      symbol: "TAC"
    };

    console.log('📋 AutoCompounder parameters:', {
      ...autoCompounderParams,
      vault: vaultAddress
    });

    const tx = await factory.deployAutoCompounder(
      vaultAddress,
      autoCompounderParams.name,
      autoCompounderParams.symbol
    );

    const receipt = await tx.wait();
    console.log('⏳ Transaction hash:', tx.hash);

    // Get the autocompounder address from the event
    const autoCompounderCreatedEvent = receipt?.logs.find(
      (log: any) => {
        try {
          const parsed = factory.interface.parseLog({
            topics: log.topics,
            data: log.data
          });
          return parsed?.name === 'AutoCompounderDeployed';
        } catch {
          return false;
        }
      }
    );

    if (autoCompounderCreatedEvent) {
      const parsed = factory.interface.parseLog({
        topics: autoCompounderCreatedEvent.topics,
        data: autoCompounderCreatedEvent.data
      });
      const autoCompounderAddress = parsed?.args.autoCompounder;
      console.log('✅ AutoCompounder created at:', autoCompounderAddress);
      
      // Verify autocompounder info
      const autoCompounderInfo = await factory.autoCompounderInfo(autoCompounderAddress);
      console.log('📊 AutoCompounder info:', {
        vault: autoCompounderInfo.vault,
        asset: autoCompounderInfo.asset,
        name: autoCompounderInfo.name,
        symbol: autoCompounderInfo.symbol,
        deployer: autoCompounderInfo.deployer,
        isActive: autoCompounderInfo.isActive
      });

      return autoCompounderAddress;
    } else {
      throw new Error('Could not find AutoCompounderDeployed event');
    }

  } catch (error) {
    console.error('❌ AutoCompounder creation failed:', error);
    throw error;
  }
}

// Main execution
async function main() {
  try {
    // Configuration - Replace with actual addresses for your network
    const config = {
      // Hedera testnet Uniswap router (replace with actual address)
      uniswapRouterAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
      // USDC or intermediate token address (replace with actual address)
      intermediateTokenAddress: '0x322eA7052a392316be9f7281646108ed8044b405'
    };

    console.log('🔧 Configuration:', config);

    // Validate addresses
    if (config.uniswapRouterAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️  WARNING: Using zero address for Uniswap router. Please update with actual address.');
    }
    if (config.intermediateTokenAddress === '0x0000000000000000000000000000000000000000') {
      console.warn('⚠️  WARNING: Using zero address for intermediate token. Please update with actual address.');
    }

    const deployment = await deployAutoCompounderFactory(
      config.uniswapRouterAddress,
      config.intermediateTokenAddress,
      ethers.parseUnits("10", 6), // 10 USDC minimum claim threshold
      500 // 5% max slippage
    );
    
    console.log('\n🎉 Deployment completed successfully!');
    console.log('📋 Summary:');
    console.log('  Factory Address:', deployment.factory);
    console.log('  Owner:', deployment.owner);
    console.log('  Deployer:', deployment.deployer);
    console.log('  Default Router:', deployment.defaultRouter);
    console.log('  Default Token:', deployment.defaultToken);

    // Uncomment the following lines to create an example autocompounder
    // Make sure to replace 'YOUR_VAULT_ADDRESS' with a valid vault address
    console.log('\n🔄 Creating example autocompounder...');
    const exampleAutoCompounder = await createExampleAutoCompounder(
      deployment.factory,
      '0xfF97699a90773b8Be500Ec732680B3D4d767E62f' // Replace with actual vault address
    );
    console.log('📍 Example autocompounder created at:', exampleAutoCompounder);

  } catch (error) {
    console.error('💥 Script failed:', error);
    process.exitCode = 1;
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { deployAutoCompounderFactory, createExampleAutoCompounder };
