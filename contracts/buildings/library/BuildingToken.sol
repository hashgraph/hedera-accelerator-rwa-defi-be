// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "../../common/safe-HTS/SafeHTS.sol";
import {ITREXGateway} from "../../erc3643/factory/ITREXGateway.sol";
import {ITREXFactory} from "../../erc3643/factory/ITREXFactory.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

library BuildingToken {
    using Bits for uint256; // used to create HTS token

    function createHTSToken(string memory _name, string memory _symbol, uint8 decimals, address buildingAddress) internal returns (address _token) {
        uint256 supplyKeyType;
        uint256 adminKeyType;

        IHederaTokenService.KeyValue memory supplyKeyValue;
        supplyKeyType = supplyKeyType.setBit(4);
        supplyKeyValue.delegatableContractId = buildingAddress;

        IHederaTokenService.KeyValue memory adminKeyValue;
        adminKeyType = adminKeyType.setBit(0);
        adminKeyValue.delegatableContractId = buildingAddress;

        IHederaTokenService.TokenKey[] memory keys = new IHederaTokenService.TokenKey[](2);

        keys[0] = IHederaTokenService.TokenKey(supplyKeyType, supplyKeyValue);
        keys[1] = IHederaTokenService.TokenKey(adminKeyType, adminKeyValue);

        IHederaTokenService.Expiry memory expiry;
        expiry.autoRenewAccount = buildingAddress;
        expiry.autoRenewPeriod = 8000000;

        IHederaTokenService.HederaToken memory newToken;
        newToken.name = _name;
        newToken.symbol = _symbol;
        newToken.treasury = buildingAddress;
        newToken.expiry = expiry;
        newToken.tokenKeys = keys;
        _token = SafeHTS.safeCreateFungibleToken(newToken, 0, decimals);
    }

    function createERC3643Token(address trexGateway, address buildingAddress, string memory name, string memory symbol) internal returns (address) {
        ITREXGateway(trexGateway).deployTREXSuite(
            buildTokenDetails(buildingAddress, name, symbol), 
            buildTokenClaimDetails()
        );

        string memory salt  = string(abi.encodePacked(Strings.toHexString(buildingAddress), name));
        address factory = ITREXGateway(trexGateway).getFactory();
        address token = ITREXFactory(factory).getToken(salt);

        return token;
    }

    function buildTokenDetails(address buildingAddress, string memory name, string memory symbol) internal pure returns (ITREXFactory.TokenDetails memory)  {
        address irs = address(0);
        address onchainid = address(0);
        address[] memory irsAgents = new address[](0);
        address[] memory tokenAgents = new address[](0);
        address[] memory complianceModules = new address[](0);
        bytes[] memory complianceSettings = new bytes[](0);
        uint8 decimals = 18;
        
        return ITREXFactory.TokenDetails(
            buildingAddress,
            name,
            symbol,
            decimals,
            irs,
            onchainid, 
            irsAgents, 
            tokenAgents, 
            complianceModules, 
            complianceSettings 
        );
    }

    function buildTokenClaimDetails () internal pure returns (ITREXFactory.ClaimDetails memory) {
        uint256[] memory claimTopics = new uint256[](0);
        address[] memory issuers = new address[](0);
        uint256[][] memory  issuerClaims = new uint256[][](0);
        
        return ITREXFactory.ClaimDetails (
            claimTopics,
            issuers,
            issuerClaims
        );
    }
}

library Bits {
    uint256 internal constant ONE = uint256(1);

    /**
     * @dev Sets the bit at the given 'index' in 'self' to '1'.
     *
     * @return Returns the modified value.
     */
    function setBit(uint256 self, uint8 index) internal pure returns (uint256) {
        return self | (ONE << index);
    }
}
