// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {ITREXGateway} from "../../erc3643/factory/ITREXGateway.sol";
import {ITREXFactory} from "../../erc3643/factory/ITREXFactory.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

struct TokenDetails {
    address initialOwner;
    address trexGateway; 
    string name;
    string symbol;
    uint8 decimals;
    address[] irAgents;
    address[] tokenAgents;
}

library BuildingTokenLib {

    function detployERC3643Token(TokenDetails memory details) external returns (address) {
        string memory salt  = string(abi.encodePacked(Strings.toHexString(details.initialOwner), details.name));
        address factory = ITREXGateway(details.trexGateway).getFactory();

        ITREXFactory.TokenDetails memory tokenDetails = ITREXFactory.TokenDetails(
            details.initialOwner, //owner,
            details.name, // name
            details.symbol, // symbol
            details.decimals, // decimals
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

        ITREXGateway(details.trexGateway).deployTREXSuite(tokenDetails, claimDetails);
        
        return ITREXFactory(factory).getToken(salt);
    }
}
