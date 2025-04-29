// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.24;

import {FixedPointMathLib} from "../../math/FixedPointMathLib.sol";

/**
 * @title ERC7540 Request Type
 * @notice Represents a request in the ERC7540 standard
 * @dev This type is a simple wrapper around a uint256 value
 */
type ERC7540_Request is uint256;

/**
 * @title ERC7540 Filled Request Structure
 * @notice Holds information about a filled request
 * @dev This struct is used to store the assets and shares of a filled ERC7540 request
 */
struct ERC7540_FilledRequest {
    uint256 assets; // The number of assets involved in the request
    uint256 shares; // The number of shares associated with the request
}

/**
 * @title ERC7540 Library
 * @notice Library for handling ERC7540 requests and conversions
 * @dev This struct is used to store the assets and shares of a filled ERC7540 request
 * @dev This library provides utility functions for converting between assets and shares in ERC7540 requests
 */
library ERC7540Lib {
    /**
     * @dev Converts a given amount of assets to shares.
     *
     * @param self The filled request (ERC7540_FilledRequest) to operate on.
     * @param assets The amount of assets to convert to shares.
     * @return The equivalent amount of shares.
     */
    function convertToShares(ERC7540_FilledRequest memory self, uint256 assets) internal pure returns (uint256) {
        return FixedPointMathLib.mulDivDown(self.shares, assets, self.assets);
    }

    /**
     * @dev Converts a given amount of shares to assets.
     *
     * @param self The filled request (ERC7540_FilledRequest) to operate on.
     * @param shares The amount of shares to convert to assets.
     * @return The equivalent amount of assets.
     */
    function convertToAssets(ERC7540_FilledRequest memory self, uint256 shares) internal pure returns (uint256) {
        return FixedPointMathLib.mulDivDown(self.assets, shares, self.shares);
    }

    /**
     * @dev Adds a value to an ERC7540_Request.
     *
     * @param self The ERC7540_Request to operate on.
     * @param x The value to add.
     * @return The new ERC7540_Request with the added value.
     */
    function add(ERC7540_Request self, uint256 x) internal pure returns (ERC7540_Request) {
        return ERC7540_Request.wrap(ERC7540_Request.unwrap(self) + x);
    }

    /**
     * @dev Subtracts a value from an ERC7540_Request.
     *
     * @param self The ERC7540_Request to operate on.
     * @param x The value to subtract.
     * @return The new ERC7540_Request with the subtracted value.
     */
    function sub(ERC7540_Request self, uint256 x) internal pure returns (ERC7540_Request) {
        return ERC7540_Request.wrap(ERC7540_Request.unwrap(self) - x);
    }

    /**
     * @dev Unwraps an ERC7540_Request to retrieve the underlying uint256 value.
     *
     * @param self The ERC7540_Request to unwrap.
     * @return The raw uint256 value of the request.
     */
    function unwrap(ERC7540_Request self) internal pure returns (uint256) {
        return ERC7540_Request.unwrap(self);
    }
}
