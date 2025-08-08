// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.24;

contract Dummy {
    uint256 count;

    function getCount() public view returns (uint256) {
        return count;
    }

    function increment() public  {
        count++;
    }
}
