// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import {Building} from "./Building.sol";
import {IERC721Metadata} from "../erc721/interface/IERC721Metadata.sol";
import {IdentityGateway} from "../onchainid/gateway/Gateway.sol";
import {BuildingToken} from "./library/BuildingToken.sol";
import {BuildingFactoryStorage} from "./BuildingFactoryStorage.sol";
import {Treasury} from "../treasury/Treasury.sol";
import {BuildingGovernance} from "./governance/BuildingGovernance.sol";
import {IVaultFactory} from "../erc4626/factory/interfaces/IVaultFactory.sol";
import {FeeConfiguration} from "../common/FeeConfiguration.sol";
import {ITreasury} from "../treasury/interfaces/ITreasury.sol";

/**
 * @title BuildingFactory
 * @author Hashgraph
 */
contract BuildingFactory is BuildingFactoryStorage, Initializable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * initialize used for upgradable contract
     * @param _nft NFT collection address
     * @param _uniswapRouter unsiswap router address
     * @param _uniswapFactory unsiswap factory address
     * @param _buildingBeacon building beacon address
     * @param _onchainIdGateway OnchainID IdentityGateway address
     */
    function initialize(
        address _nft,
        address _uniswapRouter,
        address _uniswapFactory,
        address _onchainIdGateway,
        address _trexGateway,
        address _usdc,
        address _buildingBeacon,
        address _vaultFactory,
        address _treasuryBeacon,
        address _governanceBeacon
    ) public virtual initializer {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        $.nft = _nft;
        $.uniswapRouter = _uniswapRouter;
        $.uniswapFactory = _uniswapFactory;
        $.buildingBeacon = _buildingBeacon;
        $.onchainIdGateway = _onchainIdGateway;
        $.trexGateway = _trexGateway;
        $.treasuryBeacon = _treasuryBeacon;
        $.usdc = _usdc;
        $.governanceBeacon = _governanceBeacon;
        $.vaultFactory = _vaultFactory;
        $.vaultNonce = 0;
    }

    /**
     * getBuildingList get list of buildings deployed
     */
    function getBuildingList() public view returns (BuildingDetails[] memory) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        return $.buildingsList;
    }

    /**
     * getBuildingDetails get details of building
     * @param buildingAddress address of the building contract
     */
    function getBuildingDetails(address buildingAddress) public view returns (BuildingDetails memory) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        return $.buildingDetails[buildingAddress];
    }

    /**
     * newBuilding Creates new building with create2, mints NFT and store it.
     * @param details NewBuildingDetails struct
     */
    function newBuilding(NewBuildingDetails calldata details) public virtual returns (BuildingDetails memory buildingDetails){
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        address building = address(new BeaconProxy(
            $.buildingBeacon,
            abi.encodeWithSelector(Building.initialize.selector, $.uniswapRouter, $.uniswapFactory, msg.sender)
        ));

        // deploy new token
        address initialOwner = msg.sender;
        uint256 nftId = IERC721Metadata($.nft).mint(building, details.tokenURI);
        address identity = IdentityGateway($.onchainIdGateway).deployIdentityForWallet(building);
        address erc3643Token = _deployERC3643Token(building, details.tokenName, details.tokenSymbol, details.tokenDecimals);
        address treasury = _deployTreasury(details.treasuryReserveAmount, details.treasuryNPercent, initialOwner);
        address vault = _deployVault(erc3643Token, initialOwner, treasury, details.vaultCliff, details.vaultUnlockDuration);
        address governance = _deployGovernance(erc3643Token, details.governanceName, treasury, initialOwner);
        
        ITreasury(treasury).grantGovernanceRole(governance);
        ITreasury(treasury).addVault(vault);

        buildingDetails = BuildingDetails(
            building,
            nftId,
            details.tokenURI,
            identity,
            erc3643Token,
            treasury, 
            governance,
            vault 
        );

        $.buildingDetails[building] = buildingDetails;
        $.buildingsList.push(buildingDetails);

        emit NewBuilding(building, erc3643Token, treasury, vault, governance, initialOwner);
    }

    /**
     * Create new ERC3643 token
     * @param building address of the building
     * @param name string name of the token
     * @param symbol string symbol of the token
     * @param decimals uint8 token decimals
     */
    function _deployERC3643Token(
        address building,
        string memory name,
        string memory symbol,
        uint8 decimals
    ) private returns (address token) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();

        token = BuildingToken.createERC3643Token($.trexGateway, building, name, symbol, decimals);

        OwnableUpgradeable(token).transferOwnership(msg.sender);
    }

    /**
     * Deploy new vault
     * @param token address of the token
     */
    function _deployVault(
        address token,
        address initialOwner,
        address vaultRewardController,
        uint32 cliff,
        uint32 unlockDuration
    ) private returns (address) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();

        // increment vault nonce to create salt
        $.vaultNonce++;

        string memory salt = IVaultFactory($.vaultFactory).generateSalt(initialOwner, token, $.vaultNonce);
        string memory tokenName = IERC20Metadata(token).name();
        string memory tokenSymbol = IERC20Metadata(token).symbol();

        IVaultFactory.VaultDetails memory vaultDetails = IVaultFactory.VaultDetails(
            token, // address stakingToken;
            tokenName, // string shareTokenName;
            tokenSymbol, // string shareTokenSymbol;
            vaultRewardController, // address vaultRewardController;
            initialOwner, // address feeConfigController;
            cliff, // uint32 cliff;
            unlockDuration // uint32 unlockDuration;
        );

        FeeConfiguration.FeeConfig memory feeConfig = FeeConfiguration.FeeConfig(
            address(0), // address receiver;
            address(0), // address token;
            0 // uint256 feePercentage;
        );

        return IVaultFactory($.vaultFactory).deployVault(salt, vaultDetails, feeConfig);
    }

    /**
     * Deploy new treasury contract using Beacon Proxy
     * @param reserveAmount reserve amount
     * @param nPercentage  n parcentage
     * @param initialOwner initial owner
     */
    function _deployTreasury(
        uint256 reserveAmount,
        uint256 nPercentage,
        address initialOwner
    ) private returns (address) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();

        // initial owner as business address
        address businessAddress = initialOwner;

        BeaconProxy treasuryProxy = new BeaconProxy(
            $.treasuryBeacon,
            abi.encodeWithSelector(
                Treasury.initialize.selector,
                $.usdc,
                reserveAmount,
                nPercentage,
                initialOwner,
                businessAddress,
                address(this)
            )
        );

        return address(treasuryProxy);
    }

    /**
     * Deploy new Governance for building
     * @param token building token address
     * @param name governance name
     * @param initialOwner initial owner
     * @param treasury treasury contract address
     */
    function _deployGovernance(
        address token,
        string memory name,
        address treasury,
        address initialOwner
    ) private returns (address) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();

        BeaconProxy governanceProxy = new BeaconProxy(
            $.governanceBeacon,
            abi.encodeWithSelector(BuildingGovernance.initialize.selector, token, name, initialOwner, treasury)
        );

        return address(governanceProxy);
    }
}
