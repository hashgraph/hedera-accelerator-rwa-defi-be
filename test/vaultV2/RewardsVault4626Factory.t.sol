// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@contracts/vaultV2/RewardsVault4626Factory.sol";
import "@contracts/vaultV2/RewardsVault4626.sol";
import "@contracts/vaultV2/IRewardsVault4626.sol";
import "@contracts/mock/SimpleToken.sol";

contract RewardsVault4626FactoryTest is Test {
    RewardsVault4626Factory factory;
    SimpleToken asset;
    SimpleToken rewardToken;
    
    address owner = makeAddr("owner");
    address user1 = makeAddr("user1");
    address user2 = makeAddr("user2");
    
    function setUp() public {
        vm.startPrank(owner);
        
        // Deploy factory
        factory = new RewardsVault4626Factory();
        
        // Deploy mock tokens
        asset = new SimpleToken("Test Asset", "ASSET", 18);
        rewardToken = new SimpleToken("Reward Token", "REWARD", 18);
        
        // Mint tokens to users
        asset.mint(user1, 1000e18);
        asset.mint(user2, 1000e18);
        rewardToken.mint(owner, 1000e18);
        
        vm.stopPrank();
    }
    
    function testCreateVault() public {
        vm.prank(user1);
        
        address vault = factory.createVaultWithParams(
            IERC20(address(asset)),
            "Test Vault",
            "TV",
            18,
            86400 // 1 day lock period
        );
        
        assertNotEq(vault, address(0));
        assertTrue(factory.isDeployedVault(vault));
        
        IRewardsVault4626 rewardsVault = IRewardsVault4626(vault);
        assertEq(address(rewardsVault.asset()), address(asset));
        assertEq(rewardsVault.lockPeriod(), 86400);
        assertEq(rewardsVault.name(), "Test Vault");
        assertEq(rewardsVault.symbol(), "TV");
    }
    
    function testFactoryTracking() public {
        // Create multiple vaults
        vm.startPrank(user1);
        address vault1 = factory.createVaultWithParams(
            IERC20(address(asset)),
            "Vault 1",
            "V1",
            18,
            86400
        );
        
        address vault2 = factory.createVaultWithParams(
            IERC20(address(asset)),
            "Vault 2",
            "V2",
            18,
            172800 // 2 days
        );
        vm.stopPrank();
        
        // Check factory tracking
        assertEq(factory.getVaultCount(), 2);
        
        address[] memory allVaults = factory.getAllVaults();
        assertEq(allVaults.length, 2);
        assertEq(allVaults[0], vault1);
        assertEq(allVaults[1], vault2);
        
        address[] memory assetVaults = factory.getVaultsByAsset(address(asset));
        assertEq(assetVaults.length, 2);
    }
    
    function testVaultFunctionality() public {
        // Create vault
        vm.prank(user1);
        address vault = factory.createVaultWithParams(
            IERC20(address(asset)),
            "Test Vault",
            "TV",
            18,
            86400
        );
        
        IRewardsVault4626 rewardsVault = IRewardsVault4626(vault);
        
        // User deposits
        vm.startPrank(user1);
        asset.approve(vault, 100e18);
        uint256 shares = rewardsVault.deposit(100e18, user1);
        vm.stopPrank();
        
        assertGt(shares, 0);
        assertEq(rewardsVault.balanceOf(user1), shares);
        assertEq(rewardsVault.totalAssets(), 100e18);
        assertEq(rewardsVault.getTVL(), 100e18);
        
        // Check lock status
        assertFalse(rewardsVault.isUnlocked(user1));
        assertGt(rewardsVault.getTimeUntilUnlock(user1), 0);
    }
    
    function testFactoryStats() public {
        // Create vaults with different assets
        SimpleToken asset2 = new SimpleToken("Asset 2", "ASSET2", 18);
        
        vm.prank(user1);
        factory.createVaultWithParams(
            IERC20(address(asset)),
            "Vault 1",
            "V1",
            18,
            86400
        );
        
        vm.prank(user2);
        factory.createVaultWithParams(
            IERC20(address(asset2)),
            "Vault 2",
            "V2",
            18,
            172800
        );
        
        (uint256 totalVaults, uint256 uniqueAssets, uint256 totalTVL) = factory.getFactoryStats();
        
        assertEq(totalVaults, 2);
        assertEq(uniqueAssets, 2);
        // TVL should be 0 since no deposits were made
    }
}
