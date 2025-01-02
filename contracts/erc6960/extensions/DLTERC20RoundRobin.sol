// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { DLTEnumerable } from "./DLTEnumerable.sol";

/*
 * @dev This implements an optional extension of {DLT} defined in the EIP 6960 that adds
 * ERC20 support using a RoundRobin strategy for transfering amounts.
 */
abstract contract DLTERC20RoundRobin is DLTEnumerable, IERC20 {
    uint256 private totalTokenSupply; // erc20 total supply
    mapping (address => int64[]) private mainStack; // stack of main asset IDs
    mapping (address => mapping(int64 => int64[])) private subStack; // stack of sub asset IDs
    mapping (address => mapping(int64 => bool)) private isMainIdPresent; // maps if an main asset id is present in the stack
    mapping (address => mapping(int64 => mapping(int64 => bool))) private isSubIdPresent; // maps if an sub asset id is present in the stack
    mapping (address => mapping(address => uint256)) private allowances; // erc20 allowances map
    mapping (address => uint256) private nextMainIndex; // map with a pointer to the next main asset id
    mapping (address => mapping(int64 => uint256)) private nextSubIndex; // map with a pointer to the next sub asset id

    /**
     * Data structure to handle token transfer 
     */
    struct TransferData {
        int64[] selectedMainAssetIds; // list of main asset ids that are part of transfer
        int64[] selectedSubAssetIds; // list of sub asset ids that are part of the transfer
        uint256[] selectedAmounts; // list o amount of tokens to be transfer of each sub id
        uint256 totalCollected; // total amount collected for the transfer att ampt
        uint256 remainingAmount; // amount remaining to fullfil the collection 
        uint256 selectedCount; // number of sub tokens selected for the transfer
    }

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
        _transfer(_msgSender(), to, value);
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
     * Using the RoundRobin strategy, meaning that it first collects the newest record in the stack to include 
     * on the batch transfer until the remaining amount to send is zero
     * @param from address of token owner
     * @param to  address of the recipient of tokens
     * @param value amount of tokens to send
     */
    function _transfer(address from, address to, uint256 value) internal {
        require(from != address(0), "ERC20: invalid from address");
        require(to != address(0), "ERC20: invalid to address");
        require(value > 0, "ERC20: invalid value");

        // Initialize the TransferData struct to store the collected data
        TransferData memory data;
        data.remainingAmount = value;
        data.selectedMainAssetIds = new int64[](mainStack[from].length);
        data.selectedSubAssetIds = new int64[](mainStack[from].length);
        data.selectedAmounts = new uint256[](mainStack[from].length);

        // Collect assets using helper function
        _collectAssetsForTransfer(from, data);

        // Perform the transfer
        require(data.totalCollected == value, "ERC20: Insufficient balance in sub-assets to complete the transfer");

        _safeBatchTransferFrom(
            from,
            to,
            _resizeArray(data.selectedMainAssetIds, data.selectedCount),
            _resizeArray(data.selectedSubAssetIds, data.selectedCount),
            _resizeUintArray(data.selectedAmounts, data.selectedCount),
            new bytes(0)
        );
    }

    /**
     * Internal function used to colelct tokens to be transfered
     * @param from address to collect tokens from
     * @param data data structure to handle the collection
     */
    function _collectAssetsForTransfer(
        address from,
        TransferData memory data
    ) internal {
        // Fetch the main and sub-assets of the user
        int64[] memory userMainAssets = mainStack[from];

        if (nextMainIndex[from] == userMainAssets.length) {
            nextMainIndex[from] = 0;
        }

        // Collect from main and sub-assets
        for (uint i = nextMainIndex[from]; i < userMainAssets.length; i++) {
            _collectFromMainAsset(from, userMainAssets[i], data);

            if (data.remainingAmount == 0) {
                nextMainIndex[from] = i + 1;
                break;
            }
        }
    }

    /**
     * Internal function used to colelct tokens to be transfered
     * @param from address to collect tokens from
     * @param mainAssetId id of the main asset to collect sub-asset amounts from
     * @param data data structure to handle the collection
     */
    function _collectFromMainAsset(
        address from,
        int64 mainAssetId,
        TransferData memory data
    ) internal {
        int64[] memory userSubAssets = subStack[from][mainAssetId];

        if (nextSubIndex[from][mainAssetId] == userSubAssets.length) {
            nextSubIndex[from][mainAssetId] = 0;
        }

        for (uint j = nextSubIndex[from][mainAssetId]; j < userSubAssets.length; j++) {
            int64 subAssetId = userSubAssets[j];
            uint256 subBalance = subBalanceOf(from, mainAssetId, subAssetId);

            if (subBalance > 0) {
                if (subBalance >= data.remainingAmount) {
                    data.selectedMainAssetIds[data.selectedCount] = mainAssetId;
                    data.selectedSubAssetIds[data.selectedCount] = subAssetId;
                    data.selectedAmounts[data.selectedCount] = data.remainingAmount;
                    data.totalCollected += data.remainingAmount;
                    data.selectedCount++;
                    data.remainingAmount = 0;
                    nextSubIndex[from][mainAssetId] = j + 1;
                    break;
                } else {
                    data.selectedMainAssetIds[data.selectedCount] = mainAssetId;
                    data.selectedSubAssetIds[data.selectedCount] = subAssetId;
                    data.selectedAmounts[data.selectedCount] = subBalance;
                    data.totalCollected += subBalance;
                    data.selectedCount++;
                    data.remainingAmount -= subBalance;
                }
            }
        }
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
