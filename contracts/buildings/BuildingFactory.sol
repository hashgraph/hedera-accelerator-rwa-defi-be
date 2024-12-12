// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Building} from "./Building.sol";
import {IERC721Metadata} from "../erc721/interface/IERC721Metadata.sol";
import {Token} from '../erc3643/token/Token.sol';

contract BuildingFactory is OwnableUpgradeable  {
    address private nft;
    address private uniswapRouter;
    address private uniswapFactory;

    mapping(bytes32 => address) public buildingSalts;
    BuildingInfo[] public buildingsList;

    event NewBuilding(address addr);

    struct BuildingInfo {
        address addr;
        uint256 nftId;
        string tokenURI;
        bytes32 salt;
    }

    function initialize(
        address _nft,
        address _uniswapRouter,
        address _uniswapFactory
    ) public virtual initializer {
        __Ownable_init(_msgSender());
        nft = _nft;
        uniswapRouter = _uniswapRouter;
        uniswapFactory = _uniswapFactory;
    }

    function newBuilding(bytes32 _salt, string memory tokenURI) public virtual payable onlyOwner {
        require(buildingSalts[_salt] == address(0), "BuildingFactory: Building alreadyExists");

        Building building = (new Building){salt: _salt}();

        building.initialize{ value : msg.value }(
            _salt,
            uniswapRouter, 
            uniswapFactory,
            nft
        );

        uint256 tokenId = IERC721Metadata(nft).mint(address(building), tokenURI);

        buildingsList.push(BuildingInfo(
            address(building),
            tokenId,
            tokenURI,
            _salt
        ));

        buildingSalts[_salt] = address(building);

        emit NewBuilding(address(building));
    }
}
