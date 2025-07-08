// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {BeaconProxy} from "@openzeppelin/contracts/proxy/beacon/BeaconProxy.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {Building} from "./Building.sol";
import {IERC721Metadata} from "../erc721/interface/IERC721Metadata.sol";
import {BuildingFactoryStorage} from "./BuildingFactoryStorage.sol";
import {ITreasury} from "../treasury/interfaces/ITreasury.sol";
import {BuildingVaultLib, VaultDetails} from "./library/BuildingVault.sol";
import {BuildingGovernanceLib, GovernanceDetails} from "./library/BuildingGovernance.sol";
import {BuildingTreasuryLib, TreasuryDetails} from "./library/BuildingTreasury.sol";
import {BuildingTokenLib, TokenDetails} from "./library/BuildingToken.sol";
import {BuildingAutoCompounderLib, AutoCompounderDetails} from "./library/BuildingAutoCompounder.sol";
import {IIdFactory} from "../onchainid/factory/IIdFactory.sol";
import {IIdentity} from "../onchainid/interface/IIdentity.sol";
import {IIdentityRegistry} from "../erc3643/registry/interface/IIdentityRegistry.sol";
import {ITokenVotes} from "../erc3643/token/ITokenVotes.sol";
import {IModularCompliance} from "../erc3643/compliance/modular/IModularCompliance.sol";
import {UniswapV2Library} from "../uniswap/v2-periphery/libraries/UniswapV2Library.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

interface IOwnable {
    function transferOwnership(address to) external;
}

interface IIdentityGateway {
    function idFactory() external view returns (IIdFactory);
    function deployIdentityForWallet(address wallet) external returns (address);
}

interface IERC20 {
    function mint(address to, uint256 amount) external;
}
/**
 * @title BuildingFactory
 * @author Hashgraph
 */
contract BuildingFactory is BuildingFactoryStorage, Initializable, OwnableUpgradeable {
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
        address _treasuryBeacon,
        address _governanceBeacon
    ) public virtual initializer  {
        __Ownable_init(msg.sender);
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
        
        address initialOwner = msg.sender; // initial owner is sender

        address building = address(new BeaconProxy(
            $.buildingBeacon,
            abi.encodeWithSelector(Building.initialize.selector, initialOwner)
        ));

        address auditRegistry = Building(building).getAuditRegistry();

        address erc3643Token = BuildingTokenLib.detployERC3643Token(
            TokenDetails(
                initialOwner, 
                $.trexGateway, 
                details.tokenName, 
                details.tokenSymbol, 
                details.tokenDecimals,
                irAgents(),
                tokenAgents()
            )
        );

        address treasury = BuildingTreasuryLib.deployTreasury(
            TreasuryDetails(
                $.treasuryBeacon, 
                initialOwner, 
                details.treasuryReserveAmount, 
                details.treasuryNPercent, 
                initialOwner, // business address
                $.usdc,
                address(this) // building factory
            )
        );

        address vault = BuildingVaultLib.deployVault(
            VaultDetails(
                erc3643Token,
                details.vaultShareTokenName, 
                details.vaultShareTokenSymbol, 
                details.vaultFeeReceiver, 
                details.vaultFeeToken, 
                details.vaultFeePercentage,
                initialOwner, // rewardController
                initialOwner, // feeConfigController
                details.vaultCliff, 
                details.vaultUnlockDuration
            )
        );        

        address governance = BuildingGovernanceLib.deployGovernance(
            GovernanceDetails(
                $.governanceBeacon, 
                erc3643Token, 
                details.governanceName, 
                treasury, 
                auditRegistry,
                initialOwner
            )
        );

        address autoCompounder = BuildingAutoCompounderLib.deployAutoCompounder(
            AutoCompounderDetails (
                $.uniswapRouter,
                vault,
                $.usdc,
                details.aTokenName,
                details.aTokenSymbol,
                initialOwner // operator
            )
        );

        uint256 nftId = IERC721Metadata($.nft).mint(building, details.tokenURI);        

        // special addresses that interact with the token
        // they act as a normal user inside the registry so we deploy and register identities for them
        address[] memory specialWallets = new address[](5);
        specialWallets[0] = (initialOwner);
        specialWallets[1] = ($.uniswapRouter);
        specialWallets[2] = (vault);
        specialWallets[3] = (autoCompounder);
        specialWallets[4] = (UniswapV2Library.pairFor($.uniswapFactory, erc3643Token, $.usdc));

        registeridentityForWallets(building, erc3643Token, specialWallets);

        ITreasury(treasury).grantGovernanceRole(governance);
        ITreasury(treasury).addVault(vault); 
        IAccessControl(vault).grantRole(keccak256("VAULT_REWARD_CONTROLLER_ROLE"), treasury);// grant reward controller role to treasury
        IAccessControl(auditRegistry).grantRole(keccak256("GOVERNANCE_ROLE"), governance); // default admin role
        IAccessControl(auditRegistry).grantRole(0x00, initialOwner); // default admin role to building owner
        IERC20(erc3643Token).mint(initialOwner, details.tokenMintAmount);
        IOwnable(vault).transferOwnership(initialOwner);
        IOwnable(autoCompounder).transferOwnership(initialOwner);

        buildingDetails = BuildingDetails(
            building,
            nftId,
            details.tokenURI,
            auditRegistry,
            erc3643Token,
            treasury, 
            governance,
            vault,
            autoCompounder
        );

        $.buildingDetails[building] = buildingDetails;
        $.buildingsList.push(buildingDetails);

        emit NewBuilding(building, erc3643Token, treasury, vault, governance, initialOwner, autoCompounder);
    }

    /**
     *  deployIdentityForWallet 
     * @param wallet address to deploy the identity to
     * @return identity address
     */
    function deployIdentityForWallet(address wallet) external returns (address) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        return IIdentityGateway($.onchainIdGateway).deployIdentityForWallet(wallet);
    }

    /**
     * registerIdentity 
     * Register the identity in the Identity Registry
     * @param buildingAddress address
     * @param wallet wallet address
     * @param country uint26 country code
     */
    function registerIdentity(address buildingAddress, address wallet, uint16 country) external {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();

        BuildingDetails memory building = $.buildingDetails[buildingAddress];
        ITokenVotes token = ITokenVotes(building.erc3643Token);
        IIdFactory idFactory = IIdentityGateway($.onchainIdGateway).idFactory();
        IIdentityRegistry ir = token.identityRegistry();
        address identity = idFactory.getIdentity(wallet);

        require(identity != address(0), "Identity for wallet not found");

        ir.registerIdentity(wallet, IIdentity(identity), country);

        emit IdentityRegistered(buildingAddress, wallet, identity, country);
    }

    /**
     * getIdentity
     * @param wallet wallet address
     * @return IIdentity identity of the wallet if any
     */
    function getIdentity(address wallet) external view returns (IIdentity) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        IIdFactory idFactory = IIdentityGateway($.onchainIdGateway).idFactory();

        return IIdentity(idFactory.getIdentity(wallet));
    }

    /**
     * Deploy identity and register addresses in identity registry
     * erc3643 tokens might be sent to them, so they need to have identities registered
     * @param building building address
     * @param token token address
     * @param wallets addresses to be registered
     */
    function registeridentityForWallets(address building, address token, address[] memory wallets) private {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        IIdentityGateway identityGateway = IIdentityGateway($.onchainIdGateway);
        IIdentityRegistry identityRegistry = IIdentityRegistry(ITokenVotes(token).identityRegistry());

        for (uint256 i = 0; i < wallets.length; i++) {
            IIdentity identity = IIdentity(identityGateway.idFactory().getIdentity(wallets[i]));
            uint16 country = 840; // defaults to united states (ISO code)

            if (identity == IIdentity(address(0))) { 
                // if controller does not have identity, create one.
                identity = IIdentity(identityGateway.deployIdentityForWallet(wallets[i]));
            }

            if (identityRegistry.identity(wallets[i]) == IIdentity(address(0))) {
                // if identity is not registered, register it.
                identityRegistry.registerIdentity(
                    wallets[i],
                    identity,
                    country
                );

                emit IdentityRegistered(building, wallets[i], address(identity), country);
            }
        }
    }

    /**
     * add addresses as agents on IR
     * @param agents addresses to be added as IR agents
     */
    function addRegistryAgents(address[] memory agents) public onlyOwner {
        require(agents.length <= 30, "max agents is 30");

        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        
        for (uint i = 0; i < agents.length; i++) {
            require(agents[i] != address(0), "Invalid agent address");
            $.registryAgents.push(agents[i]);            
        }

        emit RegistryAgentsAdded(agents);
    }

    /**
     * add addresses as agents on IR
     * @param agent addresses to be added as IR agents
     */
    function removeRegistryAgent(address agent) public onlyOwner {
        require(agent != address(0), "Invalid agent address");
        
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        address[] storage list = $.registryAgents;

        for (uint i = 0; i < list.length; i++) {
            if (list[i] == agent){
                list[i] = list[list.length - 1]; // overwrite with last
                list.pop(); 

                emit RegistryAgentRemoved(agent);

                break;
            }
        }
    }

    /**
     * get registry agents added
     */
    function getRegistryAgents() external view returns (address[] memory) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        return $.registryAgents;
    }

    /**
     * build array with identiry registry agents
     */
    function irAgents () private view returns (address[] memory) {
        BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
        address[] memory agents = new address[]($.registryAgents.length + 2);

        for (uint i = 0; i < $.registryAgents.length; i++) {
            agents[i] = $.registryAgents[i];
        }

        agents[agents.length -1] = address(this);
        agents[agents.length -2] = msg.sender;


        return agents;
    }

    /**
     * build array with token agents
     */
    function tokenAgents () private view returns (address[] memory) {
         BuildingFactoryStorageData storage $ = _getBuildingFactoryStorage();
         address[] memory agents = new address[]($.tokenAgents.length + 2);

        for (uint i = 0; i < $.tokenAgents.length; i++) {
            agents[i] = $.tokenAgents[i];
        }

        agents[agents.length -1] = address(this);
        agents[agents.length -2] = msg.sender;

        return agents;
    }
}
