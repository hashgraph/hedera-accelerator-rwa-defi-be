// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { DLTEnumerable } from "./DLTEnumerable.sol";

/*
 * @dev This implements an optional extension of {DLT} defined in the EIP 6960 that adds
 * ERC20 support using a FIFO strategy for transfering amounts.
 */
abstract contract DLTERC20FIFO is DLTEnumerable, IERC20 {
    uint256 private totalTokenSupply;
    mapping (address => int64[]) private mainStack; // stack of main asset IDs
    mapping (address => mapping(int64 => int64[])) private subStack; // stack of sub asset IDs
    mapping (address => mapping(int64 => bool)) private isMainIdPresent;
    mapping (address => mapping(int64 => mapping(int64 => bool))) private isSubIdPresent;
    mapping (address => mapping(address => uint256)) private allowances;

    function totalSupply() external view override returns (uint256) {
        return totalTokenSupply;
    }

    function balanceOf(address account) external view override returns (uint256) {
        uint balance = 0;

        for (uint i = 0; i < mainStack[account].length; i++) {            
            int64 mainAssetId = mainStack[account][i];

            for (uint j = 0; j < subStack[account][mainAssetId].length; j++) {
                int64 subAssetId = subStack[account][mainAssetId][j];
                balance += subBalanceOf(account, mainAssetId, subAssetId);
            }
        }

        return balance;
    }

    function transfer(address to, uint256 value) external override returns (bool) {
        address from = _msgSender();
        _transfer(from, to, value);
        return true;
    }

    function allowance(address owner, address spender) external view override returns (uint256) {
        return allowances[owner][spender];
    }

    function approve(address spender, uint256 value) external override returns (bool) {
        allowances[_msgSender()][spender] = value;
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        require(allowances[from][to] >= value, "ERC20: not enough allowance"); 
        _transfer(from, to, value);
        allowances[from][to] -= value;
        return true;
    }
    
    function _transfer(address from, address to, uint256 value) internal {
        address account = from;
        int64[] memory userMainAssets = mainStack[account]; // Fetch the main asset IDs for sender
        uint256 totalCollected = 0;  // To track the total collected amount
        uint256 remainingAmount = value;  // Track how much more needs to be collected

        int64[] memory selectedMainAssetIds = new int64[](userMainAssets.length);
        int64[] memory selectedSubAssetIds = new int64[](userMainAssets.length);
        uint256[] memory selectedAmounts = new uint256[](userMainAssets.length);
        uint256 selectedCount = 0;  // To track how many main/sub assets are selected

        for (uint i = 0; i < userMainAssets.length; i++) {
            int64 mainAssetId = userMainAssets[i];
            int64[] memory userSubAssets = subStack[account][mainAssetId];  // Fetch sub-assets for the main asset

            for (uint j = 0; j < userSubAssets.length; j++) {
                int64 subAssetId = userSubAssets[j];
                uint256 subBalance = subBalanceOf(account, mainAssetId, subAssetId);

                if (subBalance > 0) {
                    if (subBalance >= remainingAmount) {
                        selectedMainAssetIds[selectedCount] = mainAssetId;
                        selectedSubAssetIds[selectedCount] = subAssetId;
                        selectedAmounts[selectedCount] = remainingAmount;
                        selectedCount++;
                        totalCollected += remainingAmount;
                        remainingAmount = 0;
                        break; // Exit inner loop once the target amount is collected
                    } else {
                        // Otherwise, collect the full balance of this sub-asset
                        selectedMainAssetIds[selectedCount] = mainAssetId;
                        selectedSubAssetIds[selectedCount] = subAssetId;
                        selectedAmounts[selectedCount] = subBalance;

                        selectedCount++;
                        totalCollected += subBalance;
                        remainingAmount -= subBalance;
                    }
                }
            }

            if (remainingAmount == 0) {
                break;
            }
        }

        require(totalCollected == value, "ERC20: Insufficient balance in sub-assets to complete the transfer");

        _safeBatchTransferFrom(
            account, 
            to, 
            _resizeArray(selectedMainAssetIds, selectedCount), 
            _resizeArray(selectedSubAssetIds, selectedCount), 
            _resizeUintArray(selectedAmounts, selectedCount), 
            new bytes(0)
        );
    }

    function _mint(
        address recipient,
        int64 mainId,
        int64 subId,
        uint256 amount
    ) internal virtual override(DLTEnumerable) {
        totalTokenSupply += amount;
        super._mint(recipient, mainId, subId, amount);
    }

    function _burn(
        address recipient,
        int64 mainId,
        int64 subId,
        uint256 amount
    ) internal virtual override(DLTEnumerable) {
        unchecked {
            totalTokenSupply -= amount;
        }
        super._burn(recipient, mainId, subId, amount);
    }

    function _afterTokenTransfer(
        address /*sender*/,
        address recipient,
        int64 mainId,
        int64 subId,
        uint256 /*amount*/,
        bytes memory /*data*/
    ) internal virtual override {        
        if (recipient != address(0)) { // if not burn action
            if (!isMainIdPresent[recipient][mainId]){
                mainStack[recipient].push(mainId);
                isMainIdPresent[recipient][mainId] = true;
            }

            if (!isSubIdPresent[recipient][mainId][subId]){
                subStack[recipient][mainId].push(subId);
                isSubIdPresent[recipient][mainId][subId] = true;
            }
        }
    }

    // Helper function to resize an int64 array
    function _resizeArray(int64[] memory array, uint256 newSize) internal pure returns (int64[] memory) {
        int64[] memory resizedArray = new int64[](newSize);
        for (uint256 i = 0; i < newSize; i++) {
            resizedArray[i] = array[i];
        }
        return resizedArray;
    }

    // Helper function to resize a uint256 array
    function _resizeUintArray(uint256[] memory array, uint256 newSize) internal pure returns (uint256[] memory) {
        uint256[] memory resizedArray = new uint256[](newSize);
        for (uint256 i = 0; i < newSize; i++) {
            resizedArray[i] = array[i];
        }
        return resizedArray;
    }
}
