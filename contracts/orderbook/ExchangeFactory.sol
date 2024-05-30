// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Exchange} from "./Exchange.sol";

/**
 * @title Exchange Factory
 *
 * The contract which allows to deploy Exchanges with different token pairs
 * and track contract addresses.
 */
contract ExchangeFactory {
    // Available Exchanges
    mapping(address exchange => bool) public availableExchanges;

    // Used salt => deployed Exchange
    mapping(bytes32 => address) public exchangeDeployed;

    // emited when an exchagne is deployed
    event ExchangeDeployed(address exchange, address tokenA, address tokenB, address deployer);

    /**
     * @dev Deploys an Exchange using CREATE2 opcode.
     *
     * @param tokenA address of source token.
     * @param tokenB address of target token
     * @return exchange address of the deployed Exchange.
     */
    function deployExchange(
        address tokenA,
        address tokenB
    ) external returns (address exchange) {
        bytes32 salt = bytes32(keccak256(abi.encodePacked(msg.sender, tokenA, tokenB)));
        require(exchangeDeployed[salt] == address(0), "Exchange already deployed");

        exchange = _deployExchange(salt, tokenA, tokenB);

        exchangeDeployed[salt] = exchange;
        availableExchanges[exchange] = true;

        emit ExchangeDeployed(exchange, tokenA, tokenB, msg.sender);
    }

    /**
     * @dev Creates deployment data for the CREATE2 opcode.
     *
     * @return The the address of the contract created.
     */
    function _deployExchange(
        bytes32 salt,
        address tokenA,
        address tokenB
    ) private returns (address) {
        bytes memory _code = type(Exchange).creationCode;
        bytes memory _constructData = abi.encode(
            tokenA,
            tokenB
        );
        bytes memory deploymentData = abi.encodePacked(_code, _constructData);
        return _deploy(salt, deploymentData);
    }

    /**
     * @dev Deploy function with create2 opcode call.
     *
     * @return The the address of the contract created.
     */
    function _deploy(bytes32 salt, bytes memory bytecode) private returns (address) {
        address addr;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            let encoded_data := add(0x20, bytecode) // load initialization code.
            let encoded_size := mload(bytecode) // load init code's length.
            addr := create2(callvalue(), encoded_data, encoded_size, salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        return addr;
    }

    /**
     * @dev Checks if Exchange is available.
     *
     * @return The bool flag of exchanges's availability.
     */
    function isExchangeAvailable(address exchange) external view returns (bool) {
        return availableExchanges[exchange];
    }
}
