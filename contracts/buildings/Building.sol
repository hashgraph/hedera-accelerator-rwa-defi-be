// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "../common/safe-HTS/SafeHTS.sol";
import "./interface/UniswapInterface.sol";
import "./BuildingLiquidityPool.sol";
import "./library/BuildingToken.sol";
import "./library/CallContract.sol";
import "../audit/AuditRegistry.sol";

contract Building is IERC721Receiver, Initializable, OwnableUpgradeable, BuildingLiquidityPool  {    
    // Addresses for the supporting contracts
    address public token;
    address public usdc;
    address public vault;
    address public autocompounder;
    address public governance;
    address public auditRegistry;
    address public treasury;

    function initialize (
        address _usdc, 
        address _uniswapRouter, 
        address _uniswapFactory,
        address _buildingNftAddress
    ) external payable initializer {
        __Ownable_init(_msgSender());
        usdc = _usdc;
        uniswapRouter = _uniswapRouter;
        uniswapFactory = _uniswapFactory;
        token = BuildingToken.createHTSToken("BuildingToken", "BILD", 6, address(this));
        auditRegistry = address(new AuditRegistry(_buildingNftAddress));
    }

    function addLiquidity(uint256 usdcAmount, uint256 tokenAmount) external payable onlyOwner {        
        _addLiquidityToPool(usdc, token, usdcAmount, tokenAmount);        
    }

    function callContract(address callableContract, bytes memory data) external onlyOwner returns(bytes memory) {
        return CallContract.call(callableContract, data);
    }

    function onERC721Received(
        address /*operator*/,
        address /*from*/,
        uint256 /*tokenId*/,
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
