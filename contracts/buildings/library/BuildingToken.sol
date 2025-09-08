// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {ITREXFactory} from "../../erc3643/factory/ITREXFactory.sol";
import {ITREXFactoryAts} from "../../erc3643/ats/interfaces/IFactory.sol";
import {TRexIBusinessLogicResolver} from '../../erc3643/ats/interfaces/IBusinessLogicResolver.sol';
import { FactoryRegulationData, RegulationType, RegulationSubType, AdditionalSecurityData } from '../../erc3643/ats/interfaces/regulation.sol';
import {TRexIResolverProxy as IResolverProxy} from '../../erc3643/ats/interfaces/IResolverProxy.sol';
import {TRexIEquity as IEquity} from '../../erc3643/ats/interfaces/IEquity.sol';
import {TRexIERC20 as IERC20} from '../../erc3643/ats/interfaces/IERC20.sol';
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

struct TokenDetails {
    address initialOwner;
    address trexFactory; 
    string name;
    string symbol;
    uint8 decimals;
    address[] irAgents;
    address[] tokenAgents;
}

library BuildingTokenLib {

    function detployERC3643Token(TokenDetails memory details) external returns (address) {
        string memory salt  = string(abi.encodePacked(Strings.toHexString(details.initialOwner), details.name));

        ITREXFactoryAts.TokenDetailsAts memory tokenDetails = ITREXFactoryAts.TokenDetailsAts(
            details.initialOwner, //owner,
            address(0), //irs,
            address(0), //onchainid, 
            details.irAgents, // irAgents 
            details.tokenAgents, // tokenAgents
            new address[](0), // complianceModules, 
            new bytes[](0) // complianceSettings 
        ); 
        
        ITREXFactory.ClaimDetails memory claimDetails = ITREXFactory.ClaimDetails (
            new uint256[](0), //claimTopics,
            new address[](0), //issuers,
            new uint256[][](0) //issuerClaims
        );


        ITREXFactoryAts.EquityData memory equityData = ITREXFactoryAts.EquityData(
            ITREXFactoryAts.SecurityData(
                false, //arePartitionsProtected,
                false, //isMultiPartition,
                TRexIBusinessLogicResolver(0xeCa365F3d0DF975bbA70ee31B98A8504Cda5f184), //resolver,
                ITREXFactoryAts.ResolverProxyConfiguration(0x0000000000000000000000000000000000000000000000000000000000000001, 1), //resolverProxyConfiguration,
                new IResolverProxy.Rbac[](0), //rbacs,
                true, //isControllable,
                false, //isWhiteList,
                type(uint256).max, //maxSupply is max integer value so it's unlimited
                IERC20.ERC20MetadataInfo(details.name, details.symbol, "US0378331005", details.decimals), //erc20MetadataInfo, // 
                false, //clearingActive,
                false, //internalKycActivated,
                new address[](0), //externalPauses,
                new address[](0), //externalControlLists,
                new address[](0), //externalKycLists,
                true, //erc20VotesActivated,
                address(0), //compliance,
                address(0) //identityRegistry
            ),

            IEquity.EquityDetailsData(
                true, //bool votingRight;
                false, //bool informationRight;
                true, //bool liquidationRight;
                false, //bool subscriptionRight;
                true, //bool conversionRight;
                false, //bool redemptionRight;
                true, //bool putRight;
                IEquity.DividendType.PREFERRED, //DividendType dividendRight;
                0x455552, //bytes3 currency; 
                100 //uint256 nominalValue; 
            )
        );

        FactoryRegulationData memory regulationData = FactoryRegulationData(
            RegulationType.REG_D,
            RegulationSubType.REG_D_506_B,
            AdditionalSecurityData(
                true, // countriesControlListType
                "US", //listOfCountries
                "info" // info
            )
        );
        
        ITREXFactoryAts(details.trexFactory).deployTREXSuiteAtsEquity(salt, tokenDetails, claimDetails, equityData, regulationData);
        
        return ITREXFactoryAts(details.trexFactory).getToken(salt);
    }
}
