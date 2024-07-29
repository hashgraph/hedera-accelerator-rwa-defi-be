// SPDX-License-Identifier: Apache-2.0
pragma solidity 0.8.24;

import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract MockOracle is IPyth, Ownable {
    mapping(bytes32 => PythStructs.Price) public prices;

    constructor() Ownable(msg.sender) {}

    // Function to set mock prices
    function setPrice(bytes32 id, int64 price, uint64 conf, int32 expo, uint publishTime) public {
        prices[id] = PythStructs.Price({price: price, conf: conf, expo: expo, publishTime: publishTime});
    }

    function getValidTimePeriod() external pure override returns (uint validTimePeriod) {
        return 3600; // 1 hour for example
    }

    function getPrice(bytes32 id) external view override returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getEmaPrice(bytes32 id) external view override returns (PythStructs.Price memory price) {
        return prices[id]; // Just returning the same price for simplicity
    }

    function getPriceUnsafe(bytes32 id) external view override returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getPriceNoOlderThan(bytes32 id, uint age) external view override returns (PythStructs.Price memory price) {
        require(block.timestamp - prices[id].publishTime <= age, "Price is too old");
        return prices[id];
    }

    function getEmaPriceUnsafe(bytes32 id) external view override returns (PythStructs.Price memory price) {
        return prices[id];
    }

    function getEmaPriceNoOlderThan(
        bytes32 id,
        uint age
    ) external view override returns (PythStructs.Price memory price) {
        require(block.timestamp - prices[id].publishTime <= age, "Price is too old");
        return prices[id];
    }

    function updatePriceFeeds(bytes[] calldata updateData) external payable override {}

    function updatePriceFeedsIfNecessary(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64[] calldata publishTimes
    ) external payable override {
        // Mock implementation
    }

    function getUpdateFee(bytes[] calldata updateData) external view override returns (uint feeAmount) {
        return 0; // No fee for mock
    }

    function parsePriceFeedUpdates(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable override returns (PythStructs.PriceFeed[] memory priceFeeds) {
        // Mock implementation
    }

    function parsePriceFeedUpdatesUnique(
        bytes[] calldata updateData,
        bytes32[] calldata priceIds,
        uint64 minPublishTime,
        uint64 maxPublishTime
    ) external payable override returns (PythStructs.PriceFeed[] memory priceFeeds) {
        // Mock implementation
    }
}
