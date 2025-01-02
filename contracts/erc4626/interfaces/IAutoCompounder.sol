// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title Auto Compounder
 */
interface IAutoCompounder {
    /**
     * @notice CreatedToken event.
     * @dev Emitted after contract initialization, when aToken was deployed.
     *
     * @param createdToken The address of aToken.
     */
    event CreatedToken(address indexed createdToken);
    /**
     * @notice Claim event.
     * @dev Emitted after AutoCompounder claiming process.
     *
     * @param depositedUnderlying The amount of deposited underlying.
     */
    event Claim(uint256 depositedUnderlying);
    /**
     * @notice Withdraw event.
     * @dev Emitted when anyone withdraw aToken for underlying.
     *
     * @param caller The caller address.
     * @param aTokenAmount The aToken amount to withdraw.
     * @param underlyingAmount The withdrawn underlying amount.
     */
    event Withdraw(address indexed caller, uint256 aTokenAmount, uint256 underlyingAmount);
    /**
     * @notice Deposit event.
     * @dev Emitted after contract initialization, when aToken was deployed.
     *
     * @param caller The caller address.
     * @param assets The assets amount to deposit.
     * @param aTokenMinted The minted aToken amount.
     */
    event Deposit(address indexed caller, uint256 assets, uint256 aTokenMinted);

    /**
     * @dev Throw during claim process if there is no reward to reinvest
     */
    error ZeroReward();

    /**
     * @dev Returns the exchange rate: aToken / vToken.
     */
    function exchangeRate() external view returns (uint256);

    /**
     * @dev Returns underlying asset address.
     */
    function asset() external view returns (address);

    /**
     * @dev Deposits staking token to the Vault and returns shares.
     *
     * @param assets The amount of staking token to send.
     * @return amountToMint The amount of aToken to receive.
     */
    function deposit(uint256 assets) external returns (uint256 amountToMint);

    /**
     * @dev Withdraws underlying asset from the Vault.
     *
     * @param aTokenAmount The amount of aToken to send.
     * @return underlyingAmount The amount of aToken to receive.
     */
    function withdraw(uint256 aTokenAmount) external returns (uint256 underlyingAmount);

    /**
     * @dev Claims reward from the Vault, swap to underlying and deposit back.
     */
    function claim() external;
}
