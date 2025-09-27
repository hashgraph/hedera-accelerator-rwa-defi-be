// Quick test for RewardsVault4626Factory
import { ethers } from "hardhat";

async function main(): Promise<void> {
    console.log("🏭 Testing RewardsVault4626Factory");
    console.log("================================\n");

    const [owner, alice] = await ethers.getSigners();

    // Deploy asset token
    const SimpleToken = await ethers.getContractFactory("SimpleToken");
    const assetToken = await SimpleToken.deploy("Test Asset", "TA", 18);
    await assetToken.waitForDeployment();
    console.log("✅ Asset token deployed:", await assetToken.getAddress());

    // Deploy factory
    const Factory = await ethers.getContractFactory("RewardsVault4626Factory");
    const factory = await Factory.deploy();
    await factory.waitForDeployment();
    console.log("✅ Factory deployed:", await factory.getAddress());

    // Test vault creation
    console.log("\n🔧 Testing vault creation...");
    
    const vaultParams = {
        asset: await assetToken.getAddress(),
        name: "Test Vault",
        symbol: "TV",
        decimals: 18,
        lockPeriod: 86400 // 1 day
    };

    const tx = await factory.createVaultWithParams(
        vaultParams.asset,
        vaultParams.name,
        vaultParams.symbol,
        vaultParams.decimals,
        vaultParams.lockPeriod
    );
    const receipt = await tx.wait();
    
    // Get vault address from event
    const vaultCreatedEvent = receipt?.logs.find(log => {
        try {
            const parsed = factory.interface.parseLog(log as any);
            return parsed?.name === 'VaultCreated';
        } catch {
            return false;
        }
    });

    if (!vaultCreatedEvent) {
        throw new Error("VaultCreated event not found");
    }

    const parsedEvent = factory.interface.parseLog(vaultCreatedEvent as any);
    const vaultAddress = parsedEvent?.args[0];
    
    console.log("✅ Vault created at:", vaultAddress);

    // Test factory tracking
    const vaultCount = await factory.getVaultCount();
    const allVaults = await factory.getAllVaults();
    const isDeployed = await factory.isDeployedVault(vaultAddress);
    const vaultInfo = await factory.getVaultInfo(vaultAddress);

    console.log("\n📊 Factory State:");
    console.log("Vault count:", vaultCount.toString());
    console.log("All vaults:", allVaults);
    console.log("Is deployed by factory:", isDeployed);
    console.log("Vault info:", {
        asset: vaultInfo.asset,
        name: vaultInfo.name,
        symbol: vaultInfo.symbol,
        decimals: vaultInfo.decimals.toString(),
        lockPeriod: vaultInfo.lockPeriod.toString(),
        deployer: vaultInfo.deployer,
        exists: vaultInfo.exists
    });

    // Test vault functionality
    console.log("\n🧪 Testing created vault functionality...");
    const RewardsVault = await ethers.getContractFactory("RewardsVault4626");
    const vault = RewardsVault.attach(vaultAddress);

    // Check vault properties
    const vaultAsset = await vault.asset();
    const vaultLockPeriod = await vault.lockPeriod();
    const vaultOwner = await vault.owner();
    const vaultName = await vault.name();
    const vaultSymbol = await vault.symbol();

    console.log("Vault asset:", vaultAsset);
    console.log("Vault lock period:", vaultLockPeriod.toString());
    console.log("Vault owner:", vaultOwner);
    console.log("Vault name:", vaultName);
    console.log("Vault symbol:", vaultSymbol);

    // Verify all match
    const allMatch = 
        vaultAsset.toLowerCase() === vaultParams.asset.toLowerCase() &&
        vaultLockPeriod.toString() === vaultParams.lockPeriod.toString() &&
        vaultOwner === owner.address &&
        vaultName === vaultParams.name &&
        vaultSymbol === vaultParams.symbol;

    console.log("\n✅ Factory compatibility test:", allMatch ? "PASSED" : "FAILED");

    if (allMatch) {
        console.log("🎉 RewardsVault4626Factory is perfectly compatible with RewardsVault4626!");
    } else {
        console.log("❌ Compatibility issues detected!");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
