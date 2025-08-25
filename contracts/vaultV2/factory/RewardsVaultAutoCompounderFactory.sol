// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {RewardsVaultAutoCompounder} from "../RewardsVaultAutoCompounder.sol";
import {RewardsVault4626} from "../RewardsVault4626.sol";
import {IUniswapV2Router02} from "../../uniswap/v2-periphery/interfaces/IUniswapV2Router02.sol";
import {IRewardsVaultAutoCompounder} from "../interfaces/IRewardsVaultAutoCompounder.sol";

/// @title RewardsVaultAutoCompounderFactory
/// @notice Factory contract for deploying RewardsVaultAutoCompounder instances
/// @dev This factory provides convenient deployment and management of autocompounders
contract RewardsVaultAutoCompounderFactory {
    
    /*///////////////////////////////////////////////////////////////
                            STORAGE VARIABLES
    //////////////////////////////////////////////////////////////*/

    /// @notice Owner of the factory
    address public owner;
    
    /// @notice Default Uniswap router for all autocompounders
    IUniswapV2Router02 public immutable DEFAULT_UNISWAP_ROUTER;
    
    /// @notice Default intermediate token (e.g., WETH, USDC)
    address public immutable DEFAULT_INTERMEDIATE_TOKEN;
    
    /// @notice Default minimum claim threshold
    uint256 public defaultMinimumClaimThreshold;
    
    /// @notice Default max slippage (in basis points)
    uint256 public defaultMaxSlippage;
    
    /// @notice Array of all deployed autocompounders
    address[] public deployedAutoCompounders;
    
    /// @notice Mapping from vault to autocompounder address
    mapping(address => address) public vaultToAutoCompounder;
    
    /// @notice Mapping from autocompounder to deployment info
    mapping(address => AutoCompounderInfo) public autoCompounderInfo;

    /*///////////////////////////////////////////////////////////////
                                STRUCTS
    //////////////////////////////////////////////////////////////*/

    struct AutoCompounderInfo {
        address vault;
        address asset;
        string name;
        string symbol;
        uint256 deploymentTimestamp;
        address deployer;
        bool isActive;
    }

    struct DeploymentParams {
        RewardsVault4626 vault;
        string name;
        string symbol;
        uint256 minimumClaimThreshold;
        IUniswapV2Router02 uniswapRouter;
        address intermediateToken;
        uint256 maxSlippage;
    }

    /*///////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event AutoCompounderDeployed(
        address indexed autoCompounder,
        address indexed vault,
        address indexed deployer,
        string name,
        string symbol
    );
    
    event AutoCompounderDeactivated(address indexed autoCompounder);
    event AutoCompounderReactivated(address indexed autoCompounder);
    event DefaultParametersUpdated(uint256 minimumClaimThreshold, uint256 maxSlippage);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /*///////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error NotOwner();
    error InvalidVault();
    error InvalidRouter();
    error InvalidParameters();
    error AutoCompounderAlreadyExists();
    error AutoCompounderNotFound();
    error InvalidSlippage();
    error ZeroAddress();

    /*///////////////////////////////////////////////////////////////
                                MODIFIERS
    //////////////////////////////////////////////////////////////*/

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /*///////////////////////////////////////////////////////////////
                               CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(
        IUniswapV2Router02 _defaultUniswapRouter,
        address _defaultIntermediateToken,
        uint256 _defaultMinimumClaimThreshold,
        uint256 _defaultMaxSlippage
    ) {
        if (address(_defaultUniswapRouter) == address(0)) revert ZeroAddress();
        if (_defaultIntermediateToken == address(0)) revert ZeroAddress();
        if (_defaultMaxSlippage > 5000) revert InvalidSlippage(); // Max 50%
        
        owner = msg.sender;
        DEFAULT_UNISWAP_ROUTER = _defaultUniswapRouter;
        DEFAULT_INTERMEDIATE_TOKEN = _defaultIntermediateToken;
        defaultMinimumClaimThreshold = _defaultMinimumClaimThreshold;
        defaultMaxSlippage = _defaultMaxSlippage;
    }

    /*///////////////////////////////////////////////////////////////
                        DEPLOYMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deploy a new autocompounder with default parameters
    /// @param vault The vault to wrap with autocompounding
    /// @param name Name of the autocompounder token
    /// @param symbol Symbol of the autocompounder token
    /// @return autoCompounder Address of the deployed autocompounder
    function deployAutoCompounder(
        RewardsVault4626 vault,
        string memory name,
        string memory symbol
    ) external returns (address autoCompounder) {
        return _deployAutoCompounder(DeploymentParams({
            vault: vault,
            name: name,
            symbol: symbol,
            minimumClaimThreshold: defaultMinimumClaimThreshold,
            uniswapRouter: DEFAULT_UNISWAP_ROUTER,
            intermediateToken: DEFAULT_INTERMEDIATE_TOKEN,
            maxSlippage: defaultMaxSlippage
        }));
    }

    /// @notice Deploy a new autocompounder with custom parameters
    /// @param params Deployment parameters
    /// @return autoCompounder Address of the deployed autocompounder
    function deployAutoCompounderWithParams(
        DeploymentParams memory params
    ) external returns (address autoCompounder) {
        return _deployAutoCompounder(params);
    }

    /// @notice Internal deployment function
    function _deployAutoCompounder(
        DeploymentParams memory params
    ) internal returns (address autoCompounder) {
        // Validations
        if (address(params.vault) == address(0)) revert InvalidVault();
        if (address(params.uniswapRouter) == address(0)) revert InvalidRouter();
        if (params.intermediateToken == address(0)) revert ZeroAddress();
        if (params.maxSlippage > 5000) revert InvalidSlippage();
        if (vaultToAutoCompounder[address(params.vault)] != address(0)) {
            revert AutoCompounderAlreadyExists();
        }

        // Deploy the autocompounder
        RewardsVaultAutoCompounder newAutoCompounder = new RewardsVaultAutoCompounder(
            params.vault,
            params.name,
            params.symbol,
            params.minimumClaimThreshold,
            params.uniswapRouter,
            params.intermediateToken,
            params.maxSlippage
        );

        autoCompounder = address(newAutoCompounder);

        // Store deployment info
        autoCompounderInfo[autoCompounder] = AutoCompounderInfo({
            vault: address(params.vault),
            asset: address(params.vault.asset()),
            name: params.name,
            symbol: params.symbol,
            deploymentTimestamp: block.timestamp,
            deployer: msg.sender,
            isActive: true
        });

        // Update mappings and arrays
        vaultToAutoCompounder[address(params.vault)] = autoCompounder;
        deployedAutoCompounders.push(autoCompounder);

        emit AutoCompounderDeployed(
            autoCompounder,
            address(params.vault),
            msg.sender,
            params.name,
            params.symbol
        );
    }

    /*///////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get the total number of deployed autocompounders
    function getDeployedAutoCompounderCount() external view returns (uint256) {
        return deployedAutoCompounders.length;
    }

    /// @notice Get all deployed autocompounder addresses
    function getAllDeployedAutoCompounders() external view returns (address[] memory) {
        return deployedAutoCompounders;
    }

    /// @notice Get active autocompounders
    function getActiveAutoCompounders() external view returns (address[] memory active) {
        uint256 activeCount = 0;
        
        // Count active autocompounders
        for (uint256 i = 0; i < deployedAutoCompounders.length; i++) {
            if (autoCompounderInfo[deployedAutoCompounders[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active autocompounders
        active = new address[](activeCount);
        uint256 index = 0;
        for (uint256 i = 0; i < deployedAutoCompounders.length; i++) {
            if (autoCompounderInfo[deployedAutoCompounders[i]].isActive) {
                active[index] = deployedAutoCompounders[i];
                index++;
            }
        }
    }

    /// @notice Get autocompounder for a specific vault
    function getAutoCompounderForVault(address vault) external view returns (address) {
        return vaultToAutoCompounder[vault];
    }

    /// @notice Get deployment info for an autocompounder
    function getAutoCompounderInfo(address autoCompounder) external view returns (AutoCompounderInfo memory) {
        return autoCompounderInfo[autoCompounder];
    }

    /// @notice Check if an autocompounder was deployed by this factory
    function isFactoryDeployed(address autoCompounder) external view returns (bool) {
        return autoCompounderInfo[autoCompounder].deploymentTimestamp > 0;
    }

    /*///////////////////////////////////////////////////////////////
                           MANAGEMENT FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Deactivate an autocompounder (mark as inactive)
    /// @param autoCompounder Address of the autocompounder to deactivate
    function deactivateAutoCompounder(address autoCompounder) external onlyOwner {
        if (!autoCompounderInfo[autoCompounder].isActive) revert AutoCompounderNotFound();
        
        autoCompounderInfo[autoCompounder].isActive = false;
        emit AutoCompounderDeactivated(autoCompounder);
    }

    /// @notice Reactivate an autocompounder
    /// @param autoCompounder Address of the autocompounder to reactivate
    function reactivateAutoCompounder(address autoCompounder) external onlyOwner {
        if (autoCompounderInfo[autoCompounder].deploymentTimestamp == 0) revert AutoCompounderNotFound();
        if (autoCompounderInfo[autoCompounder].isActive) revert InvalidParameters();
        
        autoCompounderInfo[autoCompounder].isActive = true;
        emit AutoCompounderReactivated(autoCompounder);
    }

    /// @notice Update default parameters for new deployments
    /// @param newMinimumClaimThreshold New default minimum claim threshold
    /// @param newMaxSlippage New default max slippage
    function updateDefaultParameters(
        uint256 newMinimumClaimThreshold,
        uint256 newMaxSlippage
    ) external onlyOwner {
        if (newMaxSlippage > 5000) revert InvalidSlippage();
        
        defaultMinimumClaimThreshold = newMinimumClaimThreshold;
        defaultMaxSlippage = newMaxSlippage;
        
        emit DefaultParametersUpdated(newMinimumClaimThreshold, newMaxSlippage);
    }

    /// @notice Transfer ownership of the factory
    /// @param newOwner New owner address
    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    /*///////////////////////////////////////////////////////////////
                           UTILITY FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Batch configure swap paths for multiple autocompounders
    /// @param autoCompounders Array of autocompounder addresses
    /// @param rewardTokens Array of reward token addresses
    /// @param paths Array of swap paths
    function batchConfigureSwapPaths(
        address[] calldata autoCompounders,
        address[] calldata rewardTokens,
        address[][] calldata paths
    ) external onlyOwner {
        if (autoCompounders.length != rewardTokens.length || rewardTokens.length != paths.length) {
            revert InvalidParameters();
        }

        for (uint256 i = 0; i < autoCompounders.length; i++) {
            if (!autoCompounderInfo[autoCompounders[i]].isActive) continue;
            
            IRewardsVaultAutoCompounder(autoCompounders[i]).setSwapPath(rewardTokens[i], paths[i]);
        }
    }

    /// @notice Get statistics about all autocompounders
    /// @return totalDeployed Total number of autocompounders deployed
    /// @return totalActive Number of active autocompounders
    /// @return totalAssets Total assets managed across all autocompounders
    function getFactoryStatistics() external view returns (
        uint256 totalDeployed,
        uint256 totalActive,
        uint256 totalAssets
    ) {
        totalDeployed = deployedAutoCompounders.length;
        
        for (uint256 i = 0; i < deployedAutoCompounders.length; i++) {
            address autoCompounder = deployedAutoCompounders[i];
            if (autoCompounderInfo[autoCompounder].isActive) {
                totalActive++;
                totalAssets += IRewardsVaultAutoCompounder(autoCompounder).totalAssets();
            }
        }
    }
}
