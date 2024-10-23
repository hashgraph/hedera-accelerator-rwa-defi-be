// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { DLTEnumerable } from "./DLTEnumerable.sol";

/*
 * @dev This implements an optional extension of {DLT} defined in the EIP 6960 that adds
 * ERC20 support using a FIFO strategy for transfering amounts.
 */
abstract contract DLTERC20FIFO is DLTEnumerable, IERC20 {
    uint256 private totalTokenSupply; // erc20 total supply
    mapping (address => int64[]) private mainStack; // stack of main asset IDs
    mapping (address => mapping(int64 => int64[])) private subStack; // stack of sub asset IDs
    mapping (address => mapping(int64 => bool)) private isMainIdPresent; // maps if an main asset id is present in the stack
    mapping (address => mapping(int64 => mapping(int64 => bool))) private isSubIdPresent; // maps if an sub asset id is present in the stack
    mapping (address => mapping(address => uint256)) private allowances; // erc20 allowances map

    /**
     * @dev ERC20 compliant totalSupply function, return total supply of tokens.
     * @return uint256 the total supply
     */
    function totalSupply() external view override returns (uint256) {
        return totalTokenSupply;
    }

    /**
     * @dev ERC20 compliant `balanceOf` function return the balance of an account. 
     * It reads from the stack and calculate the sum of all amounts of tokens owned by the account 
     * using the subBalanceOf function from the ERC6960 implementation
     * @param account address of the account to get the balance of.
     * @return uint256 the balance of the account.
     */
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

    /**
     * @dev ERC20 compliant `transfer` function
     * @param to address to send the tokens to
     * @param value amount of tokens to send
     * @return bool true on success.
     */
    function transfer(address to, uint256 value) external override returns (bool) {
        address from = _msgSender();
        _transfer(from, to, value);
        return true;
    }

    /**
     * @dev ERC20 compliant `allowance` function. 
     * @param owner address of the token owner
     * @param spender address allowed to spend on behalf of owner
     * @return uint256 the amount spender is allowed
     */
    function allowance(address owner, address spender) external view override returns (uint256) {
        return allowances[owner][spender];
    }

    /**
     * @dev ERC20 compliant `approve` function
     * @param spender address of the spender
     * @param value  amount spender is allowed
     * @return bool true on success
     */
    function approve(address spender, uint256 value) external override returns (bool) {
        allowances[_msgSender()][spender] = value;
        return true;
    }

    /**
     * @dev ERC20 compliant `transferFrom` function
     * @param from address of token owner
     * @param to  address of the recipient of tokens
     * @param value amount of tokens to send
     * @return bool true on success
     */
    function transferFrom(address from, address to, uint256 value) external override returns (bool) {
        require(allowances[from][to] >= value, "ERC20: not enough allowance"); 
        _transfer(from, to, value);
        allowances[from][to] -= value;
        return true;
    }
    
    /**
     * Internal function to handle ERC20 transfers. It uses _safeBatchTransferFrom to send actual tokens
     * Using the FIFO strategy, meaning that it first collects the oldest record in the stack to include 
     * on the batch transfer until the remaining amount to send is zero
     * @param from address of token owner
     * @param to  address of the recipient of tokens
     * @param value amount of tokens to send
     */
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

    /**
     * @dev Internal function to handle ERC20 mint and increase token total supply
     * @param recipient address of the token recipient
     * @param mainId id of the main asset
     * @param subId id of the sub asset
     * @param amount amount to mint
     */
    function _mint(
        address recipient,
        int64 mainId,
        int64 subId,
        uint256 amount
    ) internal virtual override(DLTEnumerable) {
        totalTokenSupply += amount;
        super._mint(recipient, mainId, subId, amount);
    }

   /**
     * @dev Internal function to handle ERC20 burn and decrease token total supply
     * @param account address of the account to burn the tokens from
     * @param mainId id of the main asset
     * @param subId id of the sub asset
     * @param amount amount to burn
     */
    function _burn(
        address account,
        int64 mainId,
        int64 subId,
        uint256 amount
    ) internal virtual override(DLTEnumerable) {
        unchecked {
            totalTokenSupply -= amount;
        }
        super._burn(account, mainId, subId, amount);
    }

    /**
     * Internal function used as a hook for the ERC6960 every time after a token transfer happen
     * We use it to handle the main and sub stacks and make sure they have unique values in it.
     * @param recipient recipient address
     * @param mainId main asset id
     * @param subId sub asset id
     */
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

    /**
     * @dev Helper function to resize an int64 array
     * @param array list to resize
     * @param newSize new size
     * @return int64[] new resized array 
     */
    function _resizeArray(int64[] memory array, uint256 newSize) internal pure returns (int64[] memory) {
        int64[] memory resizedArray = new int64[](newSize);
        for (uint256 i = 0; i < newSize; i++) {
            resizedArray[i] = array[i];
        }
        return resizedArray;
    }

    /**
     * @dev Helper function to resize an uint256 array
     * @param array list to resize
     * @param newSize new size
     * @return int64[] new resized array 
     */
    function _resizeUintArray(uint256[] memory array, uint256 newSize) internal pure returns (uint256[] memory) {
        uint256[] memory resizedArray = new uint256[](newSize);
        for (uint256 i = 0; i < newSize; i++) {
            resizedArray[i] = array[i];
        }
        return resizedArray;
    }
}
