// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RewardsVault4626} from "../RewardsVault4626.sol";
import {IRewardsVault4626} from "../interfaces/IRewardsVault4626.sol";
import {IERC20} from "../IERC20.sol";

/// @title RewardsVault4626Factory
/// @notice Factory contract for creating RewardsVault4626 instances
/// @dev Allows for standardized deployment and tracking of RewardsVault4626 contracts
contract RewardsVault4626Factory {
    /*///////////////////////////////////////////////////////////////
                            STORAGE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Address of the factory owner
    address public owner;

    /// @notice Array of all deployed vault addresses
    address[] public deployedVaults;

    /// @notice Mapping from vault address to deployment info
    mapping(address => VaultInfo) public vaultInfo;

    /// @notice Mapping from asset to array of vault addresses using that asset
    mapping(address => address[]) public vaultsByAsset;

    /// @notice Mapping to check if a vault was deployed by this factory
    mapping(address => bool) public isDeployedVault;

    /*///////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct VaultInfo {
        address asset;
        string name;
        string symbol;
        uint8 decimals;
        uint256 lockPeriod;
        address deployer;
        uint256 deploymentTime;
        bool exists;
    }

    struct VaultCreationParams {
        IERC20 asset;
        string name;
        string symbol;
        uint8 decimals;
        uint256 lockPeriod;
    }

    /*///////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event VaultCreated(
        address indexed vault,
        address indexed asset,
        address indexed deployer,
        string name,
        string symbol,
        uint8 decimals,
        uint256 lockPeriod
    );

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /*///////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        require(msg.sender == owner, "RewardsVault4626Factory: Not authorized");
        _;
    }

    modifier validVault(address vault) {
        require(isDeployedVault[vault], "RewardsVault4626Factory: Vault not deployed by factory");
        _;
    }

    /*///////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor() {
        owner = msg.sender;
        emit OwnershipTransferred(address(0), msg.sender);
    }

    /*///////////////////////////////////////////////////////////////
                        VAULT CREATION FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Create a vault with separate parameters (alternative interface)
    /// @param asset The underlying asset token
    /// @param name Name of the vault token
    /// @param symbol Symbol of the vault token
    /// @param decimals Decimals of the vault token
    /// @param lockPeriod Lock period in seconds
    /// @return vault Address of the newly created vault
    function createVaultWithParams(
        IERC20 asset,
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 lockPeriod
    ) external returns (address vault) {
        VaultCreationParams memory params = VaultCreationParams({
            asset: asset,
            name: name,
            symbol: symbol,
            decimals: decimals,
            lockPeriod: lockPeriod
        });
        return _createVaultInternal(params);
    }

    /// @notice Create a new RewardsVault4626 instance
    /// @param params Vault creation parameters
    /// @return vault Address of the newly created vault
    function createVault(VaultCreationParams memory params) 
        external 
        returns (address vault) 
    {
        return _createVaultInternal(params);
    }

    /// @notice Internal function to create vault
    /// @param params Vault creation parameters
    /// @return vault Address of the newly created vault
    function _createVaultInternal(VaultCreationParams memory params) 
        internal 
        returns (address vault) 
    {
        require(address(params.asset) != address(0), "RewardsVault4626Factory: Invalid asset");
        require(bytes(params.name).length > 0, "RewardsVault4626Factory: Empty name");
        require(bytes(params.symbol).length > 0, "RewardsVault4626Factory: Empty symbol");
        require(params.decimals > 0, "RewardsVault4626Factory: Invalid decimals");

        // Deploy new vault
        vault = address(new RewardsVault4626(
            params.asset,
            params.name,
            params.symbol,
            params.decimals,
            params.lockPeriod,
            msg.sender  // Pass the caller as owner, not the factory
        ));

        // Store vault information
        vaultInfo[vault] = VaultInfo({
            asset: address(params.asset),
            name: params.name,
            symbol: params.symbol,
            decimals: params.decimals,
            lockPeriod: params.lockPeriod,
            deployer: msg.sender,
            deploymentTime: block.timestamp,
            exists: true
        });

        // Add to tracking arrays and mappings
        deployedVaults.push(vault);
        vaultsByAsset[address(params.asset)].push(vault);
        isDeployedVault[vault] = true;

        emit VaultCreated(
            vault,
            address(params.asset),
            msg.sender,
            params.name,
            params.symbol,
            params.decimals,
            params.lockPeriod
        );
    }

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the total number of deployed vaults
    function getVaultCount() external view returns (uint256) {
        return deployedVaults.length;
    }

    /// @notice Get all deployed vault addresses
    function getAllVaults() external view returns (address[] memory) {
        return deployedVaults;
    }

    /// @notice Get vaults by asset
    /// @param asset The asset token address
    /// @return Array of vault addresses using the specified asset
    function getVaultsByAsset(address asset) external view returns (address[] memory) {
        return vaultsByAsset[asset];
    }

    /// @notice Get vault information
    /// @param vault The vault address
    /// @return info Vault information struct
    function getVaultInfo(address vault) external view validVault(vault) returns (VaultInfo memory info) {
        return vaultInfo[vault];
    }

    /// @notice Get vaults deployed by a specific address
    /// @param deployer The deployer address
    /// @return vaults Array of vault addresses deployed by the specified address
    function getVaultsByDeployer(address deployer) external view returns (address[] memory vaults) {
        uint256 count = 0;
        
        // First count the vaults
        for (uint256 i = 0; i < deployedVaults.length; i++) {
            if (vaultInfo[deployedVaults[i]].deployer == deployer) {
                count++;
            }
        }
        
        // Create array and populate
        vaults = new address[](count);
        uint256 index = 0;
        for (uint256 i = 0; i < deployedVaults.length; i++) {
            if (vaultInfo[deployedVaults[i]].deployer == deployer) {
                vaults[index] = deployedVaults[i];
                index++;
            }
        }
    }

    /// @notice Get paginated vault list
    /// @param offset Starting index
    /// @param limit Number of vaults to return
    /// @return vaults Array of vault addresses
    /// @return total Total number of vaults
    function getVaultsPaginated(uint256 offset, uint256 limit) 
        external 
        view 
        returns (address[] memory vaults, uint256 total) 
    {
        total = deployedVaults.length;
        
        if (offset >= total) {
            return (new address[](0), total);
        }
        
        uint256 end = offset + limit;
        if (end > total) {
            end = total;
        }
        
        vaults = new address[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            vaults[i - offset] = deployedVaults[i];
        }
    }

    /*///////////////////////////////////////////////////////////////
                        ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Transfer ownership of the factory
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "RewardsVault4626Factory: New owner is zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }

    /// @notice Emergency function to update vault tracking (in case of edge cases)
    /// @param vault Vault address to update
    /// @param status New tracking status
    function updateVaultTracking(address vault, bool status) external onlyOwner {
        isDeployedVault[vault] = status;
    }

    /// @notice Transfer ownership of a vault to a new owner
    /// @param vault Vault address
    /// @param newOwner New owner address
    function transferVaultOwnership(address vault, address newOwner) external onlyOwner validVault(vault) {
        IRewardsVault4626(vault).transferOwnership(newOwner);
    }

    /*///////////////////////////////////////////////////////////////
                        UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Check if a vault supports the IRewardsVault4626 interface
    /// @param vault Vault address to check
    /// @return Whether the vault supports the interface
    function supportsInterface(address vault) external view returns (bool) {
        try IRewardsVault4626(vault).asset() returns (IERC20) {
            return true;
        } catch {
            return false;
        }
    }

    /// @notice Get vault statistics
    /// @return totalVaults Total number of deployed vaults
    /// @return uniqueAssets Number of unique assets used
    /// @return totalTVL Combined TVL across all vaults
    function getFactoryStats() external view returns (uint256 totalVaults, uint256 uniqueAssets, uint256 totalTVL) {
        totalVaults = deployedVaults.length;
        
        // Count unique assets
        address[] memory uniqueAssetsList = new address[](totalVaults);
        uint256 uniqueCount = 0;
        
        for (uint256 i = 0; i < totalVaults; i++) {
            address asset = vaultInfo[deployedVaults[i]].asset;
            bool found = false;
            
            for (uint256 j = 0; j < uniqueCount; j++) {
                if (uniqueAssetsList[j] == asset) {
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                uniqueAssetsList[uniqueCount] = asset;
                uniqueCount++;
            }
            
            // Add to total TVL
            try IRewardsVault4626(deployedVaults[i]).getTVL() returns (uint256 tvl) {
                totalTVL += tvl;
            } catch {
                // Skip if vault doesn't respond
            }
        }
        
        uniqueAssets = uniqueCount;
    }
}
