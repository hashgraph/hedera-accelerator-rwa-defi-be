// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Building} from "./Building.sol";
import {IERC721Metadata} from "../erc721/interface/IERC721Metadata.sol";

contract BuildingFactory is OwnableUpgradeable  {
    address private nft;
    address private usdc;
    address private uniswapRouter;
    address private uniswapFactory;
    address private router;

    event NewBuilding(address addr);

    function initialize(
        address _nft,
        address _usdc, 
        address _uniswapRouter,
        address _uniswapFactory
    ) external initializer {
        __Ownable_init(_msgSender());
        nft = _nft;
        usdc = _usdc;
        uniswapRouter = _uniswapRouter;
        uniswapFactory = _uniswapFactory;
        router = _uniswapRouter;
    }

    function newBuilding(bytes32 _salt) external payable {
        Building building = (new Building){salt: _salt}();
        
        building.initialize{ value : msg.value }(
            _salt,
            usdc, 
            uniswapRouter, 
            uniswapFactory,
            nft
        );

        IERC721Metadata(nft).mint(address(building), ""); // tokenURI should be sent here?        
        emit NewBuilding(address(building));
    }

    function addLiquidityToBuilding(address _building, uint256 _usdcAmount, uint256 _tokenAmount) external payable {
        IERC20(usdc).transferFrom(_msgSender(), address(_building), _usdcAmount);
        Building(_building).addLiquidity{ value : msg.value}(_usdcAmount, _tokenAmount);
    }
}
