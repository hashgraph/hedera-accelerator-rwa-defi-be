// SPDX-License-Identifier: GPL-3.0
//
//                                             :+#####%%%%%%%%%%%%%%+
//                                         .-*@@@%+.:+%@@@@@%%#***%@@%=
//                                     :=*%@@@#=.      :#@@%       *@@@%=
//                       .-+*%@%*-.:+%@@@@@@+.     -*+:  .=#.       :%@@@%-
//                   :=*@@@@%%@@@@@@@@@%@@@-   .=#@@@%@%=             =@@@@#.
//             -=+#%@@%#*=:.  :%@@@@%.   -*@@#*@@@@@@@#=:-              *@@@@+
//            =@@%=:.     :=:   *@@@@@%#-   =%*%@@@@#+-.        =+       :%@@@%-
//           -@@%.     .+@@@     =+=-.         @@#-           +@@@%-       =@@@@%:
//          :@@@.    .+@@#%:                   :    .=*=-::.-%@@@+*@@=       +@@@@#.
//          %@@:    +@%%*                         =%@@@@@@@@@@@#.  .*@%-       +@@@@*.
//         #@@=                                .+@@@@%:=*@@@@@-      :%@%:      .*@@@@+
//        *@@*                                +@@@#-@@%-:%@@*          +@@#.      :%@@@@-
//       -@@%           .:-=++*##%%%@@@@@@@@@@@@*. :@+.@@@%:            .#@@+       =@@@@#:
//      .@@@*-+*#%%%@@@@@@@@@@@@@@@@%%#**@@%@@@.   *@=*@@#                :#@%=      .#@@@@#-
//      -%@@@@@@@@@@@@@@@*+==-:-@@@=    *@# .#@*-=*@@@@%=                 -%@@@*       =@@@@@%-
//         -+%@@@#.   %@%%=   -@@:+@: -@@*    *@@*-::                   -%@@%=.         .*@@@@@#
//            *@@@*  +@* *@@##@@-  #@*@@+    -@@=          .         :+@@@#:           .-+@@@%+-
//             +@@@%*@@:..=@@@@*   .@@@*   .#@#.       .=+-       .=%@@@*.         :+#@@@@*=:
//              =@@@@%@@@@@@@@@@@@@@@@@@@@@@%-      :+#*.       :*@@@%=.       .=#@@@@%+:
//               .%@@=                 .....    .=#@@+.       .#@@@*:       -*%@@@@%+.
//                 +@@#+===---:::...         .=%@@*-         +@@@+.      -*@@@@@%+.
//                  -@@@@@@@@@@@@@@@@@@@@@@%@@@@=          -@@@+      -#@@@@@#=.
//                    ..:::---===+++***###%%%@@@#-       .#@@+     -*@@@@@#=.
//                                           @@@@@@+.   +@@*.   .+@@@@@%=.
//                                          -@@@@@=   =@@%:   -#@@@@%+.
//                                          +@@@@@. =@@@=  .+@@@@@*:
//                                          #@@@@#:%@@#. :*@@@@#-
//                                          @@@@@%@@@= :#@@@@+.
//                                         :@@@@@@@#.:#@@@%-
//                                         +@@@@@@-.*@@@*:
//                                         #@@@@#.=@@@+.
//                                         @@@@+-%@%=
//                                        :@@@#%@%=
//                                        +@@@@%-
//                                        :#%%=
//
/**
 *     NOTICE
 *
 *     The T-REX software is licensed under a proprietary license or the GPL v.3.
 *     If you choose to receive it under the GPL v.3 license, the following applies:
 *     T-REX is a suite of smart contracts implementing the ERC-3643 standard and
 *     developed by Tokeny to manage and transfer financial assets on EVM blockchains
 *
 *     Copyright (C) 2023, Tokeny sàrl.
 *
 *     This program is free software: you can redistribute it and/or modify
 *     it under the terms of the GNU General Public License as published by
 *     the Free Software Foundation, either version 3 of the License, or
 *     (at your option) any later version.
 *
 *     This program is distributed in the hope that it will be useful,
 *     but WITHOUT ANY WARRANTY; without even the implied warranty of
 *     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *     GNU General Public License for more details.
 *
 *     You should have received a copy of the GNU General Public License
 *     along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */
pragma solidity 0.8.24;

import {AgentRole, Ownable} from "../roles/AgentRole.sol";
import {IToken, IClaimIssuer} from "../token/IToken.sol";
import {IClaimTopicsRegistry} from "../registry/interface/IClaimTopicsRegistry.sol";
import {IIdentityRegistry} from "../registry/interface/IIdentityRegistry.sol";
import {IModularCompliance} from "../compliance/modular/IModularCompliance.sol";
import {ITrustedIssuersRegistry} from "../registry/interface/ITrustedIssuersRegistry.sol";
import {IIdentityRegistryStorage} from "../registry/interface/IIdentityRegistryStorage.sol";
import {ITREXImplementationAuthority} from "../proxy/authority/ITREXImplementationAuthority.sol";
import {TREXDeployments} from "./libraries/TREXDeployments.sol";
import {ITREXFactory} from "./ITREXFactory.sol";
import {IIdFactory} from "../../onchainid/factory/IIdFactory.sol";
import {ITREXFactoryAts} from "../ats/interfaces/IFactory.sol";
import {FactoryRegulationData} from "../ats/interfaces/regulation.sol";


contract TREXFactoryAts is ITREXFactory, Ownable {
    /// the address of the implementation authority contract used in the tokens deployed by the factory
    address private _implementationAuthority;

    /// the address of the Identity Factory used to deploy token OIDs
    address private _idFactory;

    /// mapping containing info about the token contracts corresponding to salt already used for CREATE2 deployments
    mapping(string => address) public tokenDeployed;

    /// constructor is setting the implementation authority and the Identity Factory of the TREX factory
    constructor(address implementationAuthority_, address idFactory_) Ownable(msg.sender) {
        setImplementationAuthority(implementationAuthority_);
        setIdFactory(idFactory_);
    }

    /**
     *  @dev See {ITREXFactory-deployTREXSuite}.
     */
    // solhint-disable-next-line code-complexity, function-max-lines
    function deployTREXSuite(string memory _salt, TokenDetails calldata _tokenDetails, ClaimDetails calldata _claimDetails) external override onlyOwner {
        revert("not implemented");
    }

    function _deployTREXSuite(string memory _salt, TokenDetails memory _tokenDetails, ClaimDetails calldata
        _claimDetails)
    internal {
        require(tokenDeployed[_salt] == address(0)
        , "token already deployed");
        require((_claimDetails.issuers).length == (_claimDetails.issuerClaims).length
        , "claim pattern not valid");
        require((_claimDetails.issuers).length <= 5
        , "max 5 claim issuers at deployment");
        require((_claimDetails.claimTopics).length <= 5
        , "max 5 claim topics at deployment");
        require((_tokenDetails.irAgents).length <= 5 && (_tokenDetails.tokenAgents).length <= 5
        , "max 5 agents at deployment");
        require((_tokenDetails.complianceModules).length <= 30
        , "max 30 module actions at deployment");
        require((_tokenDetails.complianceModules).length >= (_tokenDetails.complianceSettings).length
        , "invalid compliance pattern");

        ITrustedIssuersRegistry tir = ITrustedIssuersRegistry(TREXDeployments._deployTIR(_salt, _implementationAuthority));
        IClaimTopicsRegistry ctr = IClaimTopicsRegistry(TREXDeployments._deployCTR(_salt, _implementationAuthority));
        IModularCompliance mc = IModularCompliance(TREXDeployments._deployMC(_salt, _implementationAuthority));
        IIdentityRegistryStorage irs;
        if (_tokenDetails.irs == address(0)) {
            irs = IIdentityRegistryStorage(TREXDeployments._deployIRS(_salt, _implementationAuthority));
        }
        else {
            irs = IIdentityRegistryStorage(_tokenDetails.irs);
        }
        IIdentityRegistry ir = IIdentityRegistry(TREXDeployments._deployIR(_salt, _implementationAuthority, address(tir),
            address(ctr), address(irs)));
        IToken token = IToken(TREXDeployments._deployToken
            (
                _salt,
                _implementationAuthority,
                address(ir),
                address(mc),
                _tokenDetails
            ));
        if(_tokenDetails.ONCHAINID == address(0)) {
            address _tokenID = IIdFactory(_idFactory).createTokenIdentity(address(token), _tokenDetails.owner, _salt);
            token.setOnchainID(_tokenID);
        }
        for (uint256 i = 0; i < (_claimDetails.claimTopics).length; i++) {
            ctr.addClaimTopic(_claimDetails.claimTopics[i]);
        }
        for (uint256 i = 0; i < (_claimDetails.issuers).length; i++) {
            tir.addTrustedIssuer(IClaimIssuer((_claimDetails).issuers[i]), _claimDetails.issuerClaims[i]);
        }
        irs.bindIdentityRegistry(address(ir));
        AgentRole(address(ir)).addAgent(address(token));
        for (uint256 i = 0; i < (_tokenDetails.irAgents).length; i++) {
            AgentRole(address(ir)).addAgent(_tokenDetails.irAgents[i]);
        }
        for (uint256 i = 0; i < (_tokenDetails.tokenAgents).length; i++) {
            AgentRole(address(token)).addAgent(_tokenDetails.tokenAgents[i]);
        }
        for (uint256 i = 0; i < (_tokenDetails.complianceModules).length; i++) {
            if (!mc.isModuleBound(_tokenDetails.complianceModules[i])) {
                mc.addModule(_tokenDetails.complianceModules[i]);
            }
            if (i < (_tokenDetails.complianceSettings).length) {
                mc.callModuleFunction(_tokenDetails.complianceSettings[i], _tokenDetails.complianceModules[i]);
            }
        }
        tokenDeployed[_salt] = address(token);
        (Ownable(address(token))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(ir))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(tir))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(ctr))).transferOwnership(_tokenDetails.owner);
        (Ownable(address(mc))).transferOwnership(_tokenDetails.owner);
        emit TREXSuiteDeployed(address(token), address(ir), address(irs), address(tir), address(ctr), address(mc), _salt);
    }

    /**
     * @dev 
     * @param _salt salt used to deploy the token
     * @param _tokenDetails details of the token
     * @param _claimDetails details of the claims and claim issuers
     * @param _equityData details of the equity
     * @param _factoryRegulationData details of the factory regulation
     */
    function deployTREXSuiteAtsEquity(
        string memory _salt,
        ITREXFactoryAts.TokenDetailsAts calldata _tokenDetails,
        ClaimDetails calldata _claimDetails,
        ITREXFactoryAts.EquityData calldata _equityData,
        FactoryRegulationData calldata _factoryRegulationData
    ) external {
        TokenDetails memory tokenDetails = TokenDetails(
            _tokenDetails.owner,
            _equityData.security.erc20MetadataInfo.name,
            _equityData.security.erc20MetadataInfo.symbol,
            _equityData.security.erc20MetadataInfo.decimals,
            _tokenDetails.ONCHAINID,
            _tokenDetails.irs,
            _tokenDetails.irAgents,
            _tokenDetails.tokenAgents,
            _tokenDetails.complianceModules,
            _tokenDetails.complianceSettings
        );
        _deployTREXSuite(_salt, tokenDetails, _claimDetails);
    }

    /**
     *  @dev See {ITREXFactory-recoverContractOwnership}.
     */
    function recoverContractOwnership(address _contract, address _newOwner) external override onlyOwner {
        (Ownable(_contract)).transferOwnership(_newOwner);
    }

    /**
     *  @dev See {ITREXFactory-getImplementationAuthority}.
     */
    function getImplementationAuthority() external override view returns(address) {
        return _implementationAuthority;
    }

    /**
     *  @dev See {ITREXFactory-getIdFactory}.
     */
    function getIdFactory() external override view returns(address) {
        return _idFactory;
    }

    /**
     *  @dev See {ITREXFactory-getToken}.
     */
    function getToken(string calldata _salt) external override view returns(address) {
        return tokenDeployed[_salt];
    }

    /**
     *  @dev See {ITREXFactory-setImplementationAuthority}.
     */
    function setImplementationAuthority(address implementationAuthority_) public override onlyOwner {
        require(implementationAuthority_ != address(0), "invalid argument - zero address");
        // should not be possible to set an implementation authority that is not complete
        require(
            (ITREXImplementationAuthority(implementationAuthority_)).getTokenImplementation() != address(0)
            && (ITREXImplementationAuthority(implementationAuthority_)).getCTRImplementation() != address(0)
            && (ITREXImplementationAuthority(implementationAuthority_)).getIRImplementation() != address(0)
            && (ITREXImplementationAuthority(implementationAuthority_)).getIRSImplementation() != address(0)
            && (ITREXImplementationAuthority(implementationAuthority_)).getMCImplementation() != address(0)
            && (ITREXImplementationAuthority(implementationAuthority_)).getTIRImplementation() != address(0),
            "invalid Implementation Authority");
        _implementationAuthority = implementationAuthority_;
        emit ImplementationAuthoritySet(implementationAuthority_);
    }

    /**
     *  @dev See {ITREXFactory-setIdFactory}.
     */
    function setIdFactory(address idFactory_) public override onlyOwner {
        require(idFactory_ != address(0), "invalid argument - zero address");
        _idFactory = idFactory_;
        emit IdFactorySet(idFactory_);
    }
}
