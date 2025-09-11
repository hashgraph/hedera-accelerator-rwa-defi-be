// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

/**
 * @title IBuildingIdentityFactory
 * @author Hashgraph
 *
 * The interface for the BuildingIdentityFactory contract
 */
interface IBuildingIdentityFactory {

    /**
     *  @dev createIdentity an ONCHAINID using a factory using the identityOwner address as salt.
     *  @param identityOwner the address to set as a management key.
     */
    function createIdentity(address identityOwner) external returns (address);

    /**
     *  @dev getIdentity an ONCHAINID using a factory
     * @param identityOwner the address of the identity owner
     * @return the address of the identity
     */
    function getIdentity(address identityOwner) external view returns (address);
}
