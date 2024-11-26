// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../erc721/ERC721Metadata.sol";
import "./Building.sol";

contract BuildingFactory is Ownable  {
    ERC721Metadata private nft;
    address private usdc;
    address private uniswapRouter;
    address private uniswapFactory;
    address private router;

    event NewBuilding(address addr);
    event NewNFTCollection(address addr);

    constructor() Ownable(_msgSender()) {}

    function initialize(
        string memory _name, 
        string memory _symbol, 
        address _usdc, 
        address _uniswapRouter,
        address _uniswapFactory
    ) external {
        nft = new ERC721Metadata(_name, _symbol);
        usdc = _usdc;
        uniswapRouter = _uniswapRouter;
        uniswapFactory = _uniswapFactory;
        router = _uniswapRouter;
        emit NewNFTCollection(address(nft));
    }

    function newBuilding() external payable {
        Building building = new Building();
        
        building.initialize{ value : msg.value}(
            usdc, 
            uniswapRouter, 
            uniswapFactory
        );

        nft.mint(address(building), ""); // tokenURI should be sent here?        
        emit NewBuilding(address(building));
    }

    function addLiquidityToBuilding(address _building, uint256 _usdcAmount, uint256 _tokenAmount) external payable {
        IERC20(usdc).transferFrom(_msgSender(), address(_building), _usdcAmount);
        Building(_building).addLiquidity{ value : msg.value}(_usdcAmount, _tokenAmount);
    }
}
