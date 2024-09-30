// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "../IModularCompliance.sol";
import "../../../token/IToken.sol";
import "./AbstractModule.sol";

/**
* _@title MaxOwnershipByCountryModule
* This module manage the token percentage (relative to the token supply) each ONCHAINID is allowed to own
*/ 
contract MaxOwnershipByCountryModule is AbstractModule {
    using Math for uint256;

    /// state variables
    /// mapping of preset status of compliance addresses
    mapping(address => bool) private _compliancePresetStatus;

    /// mapping of country of compliance addresses
    mapping(address => uint16) private _localCountry;

    /// maximum percetage ownership per investor per local/non local ONCHAINID per modular compliance
    // percentage is set in basis point so 10000 = 100%
    mapping(address => mapping(bool => uint16)) private _maxPercentage;

    /// mapping of balances per ONCHAINID per modular compliance
    // solhint-disable-next-line var-name-mixedcase
    mapping(address => mapping(address => uint256)) private _IDBalance;

    /// events

    /**
     *  this event is emitted when the max balance has been set for a compliance bound.
     *  `_compliance` is the address of modular compliance concerned
     *  `_maxPercetage` is the max amount of tokens that a user can hold .
     */
    event MaxPercentageSet(address indexed _compliance, uint256 indexed _maxPercetageLocal, uint256 indexed _maxPercetageNonlocal);

    /**
     *  this event is emitted when the state of user balances is pre setted.
     *  `_compliance` is the address of modular compliance concerned
     *  `_id` user ONCHAINID address
     *  `_balance` balance setted for the user
     */
    event IDBalancePreSet(address indexed _compliance, address indexed _id, uint256 _balance);

    /// errors
    error MaxOwnershipExceeded(address _compliance, uint256 _value);

    error InvalidPresetValues(address _compliance, address[] _id, uint256[] _balance);

    error OnlyComplianceOwnerCanCall(address _compliance);

    error TokenAlreadyBound(address _compliance);

    /// functions

    /**
     *  @dev sets max percentage ownership limit for a bound compliance contract
     *  @param _maxLocal max percentage of tokens (in basis points (185 = 1.85%)) owned by an local individual
     *  @param _maxNonlocal max percentage of tokens (in basis points (185 = 1.85%)) owned by an non-local individual
     *  @notice Only the owner of the Compliance smart contract can call this function
     *  emits an `MaxPercentageSet` event
     */
    function setMaxPercentage(uint16 _country, uint16 _maxLocal, uint16 _maxNonlocal) external onlyComplianceCall {
        _localCountry[msg.sender] = _country;
        _maxPercentage[msg.sender][true] = _maxLocal;
        _maxPercentage[msg.sender][false] = _maxNonlocal;
        emit MaxPercentageSet(msg.sender, _maxLocal, _maxNonlocal);
    }

    /**
     *  @dev pre-set the balance of a token holder per ONCHAINID
     *  @param _compliance the address of the compliance contract to preset
     *  @param _id the ONCHAINID address of the token holder
     *  @param _balance the current balance of the token holder
     *  @notice Only the owner of the Compliance smart contract can call this function
     *  emits a `IDBalancePreSet` event
     */
    function preSetModuleState(address _compliance, address _id, uint256 _balance) external {
        if (OwnableUpgradeable(_compliance).owner() != msg.sender) {
            revert OnlyComplianceOwnerCanCall(_compliance);
        }

        if (IModularCompliance(_compliance).isModuleBound(address(this))) {
            revert TokenAlreadyBound(_compliance);
        }

        _preSetModuleState(_compliance, _id, _balance);
    }

    /**
     *  @dev make a batch transaction calling preSetModuleState multiple times
     *  @param _compliance the address of the compliance contract to preset
     *  @param _id the ONCHAINID address of the token holder
     *  @param _balance the current balance of the token holder
     *  @notice Only the owner of the Compliance smart contract can call this function
     *  emits _id.length `IDBalancePreSet` events
     */
    function batchPreSetModuleState(
        address _compliance,
        address[] calldata _id,
        uint256[] calldata _balance) external {

        uint256 idLength = _id.length;

        if(idLength == 0 || idLength != _balance.length) {
            revert InvalidPresetValues(_compliance, _id, _balance);
        }

        if (OwnableUpgradeable(_compliance).owner() != msg.sender) {
            revert OnlyComplianceOwnerCanCall(_compliance);
        }

        if (IModularCompliance(_compliance).isModuleBound(address(this))) {
            revert TokenAlreadyBound(_compliance);
        }

        for (uint i = 0; i < idLength; i++) {
            _preSetModuleState(_compliance, _id[i], _balance[i]);
        }

        _compliancePresetStatus[_compliance] = true;
    }

    /**
     *  @dev updates compliance preset status as true
     *  @param _compliance the address of the compliance contract
     *  @notice Only the owner of the Compliance smart contract can call this function
     */
    function presetCompleted(address _compliance) external {
        if (OwnableUpgradeable(_compliance).owner() != msg.sender) {
            revert OnlyComplianceOwnerCanCall(_compliance);
        }

        _compliancePresetStatus[_compliance] = true;
    }

    /**
     *  @dev See {IModule-moduleTransferAction}.
     */
    function moduleTransferAction(address _from, address _to, uint256 _value) external override onlyComplianceCall {
        address _idFrom = _getIdentity(msg.sender, _from);
        address _idTo = _getIdentity(msg.sender, _to);
        bool localFlag = _isLocalUser(msg.sender, _to);
        _IDBalance[msg.sender][_idTo] += _value;
        _IDBalance[msg.sender][_idFrom] -= _value;
        if (_getPercentage(msg.sender, _IDBalance[msg.sender][_idTo]) > _maxPercentage[msg.sender][localFlag]) revert MaxOwnershipExceeded(msg.sender, _value);
    }

    /**
     *  @dev See {IModule-moduleMintAction}.
     */
    function moduleMintAction(address _to, uint256 _value) external override onlyComplianceCall {
        address _idTo = _getIdentity(msg.sender, _to);
        _IDBalance[msg.sender][_idTo] += _value;
    }

    /**
     *  @dev See {IModule-moduleBurnAction}.
     */
    function moduleBurnAction(address _from, uint256 _value) external override onlyComplianceCall {
        address _idFrom = _getIdentity(msg.sender, _from);
        _IDBalance[msg.sender][_idFrom] -= _value;
    }

    /**
     *  @dev See {IModule-moduleCheck}.
     *  checks if the country of address _to is allowed for this _compliance
     *  returns TRUE if the country of _to is allowed for this _compliance
     *  returns FALSE if the country of _to is not allowed for this _compliance
     */
    function moduleCheck(
        address /*_from*/,
        address _to,
        uint256 _value,
        address _compliance
    ) external view override returns (bool) {
        address _id = _getIdentity(_compliance, _to);
        bool localFlag = _isLocalUser(_compliance, _to);

        if (_getPercentage(_compliance, _value) > _maxPercentage[_compliance][localFlag]) {
            return false;
        }

        if (_getPercentage(_compliance, _IDBalance[_compliance][_id] + _value) > _maxPercentage[_compliance][localFlag]) {
            return false;
        }
        return true;
    }

    /**
     *  @dev getter for compliance identity balance
     *  @param _compliance address of the compliance contract
     *  @param _identity ONCHAINID address
     */
    function getIDBalance(address _compliance, address _identity) external view returns (uint256) {
        return _IDBalance[_compliance][_identity];
    }

    /**
     *  @dev See {IModule-canComplianceBind}.
     */
    function canComplianceBind(address _compliance) external view returns (bool) {
        if (_compliancePresetStatus[_compliance]) {
            return true;
        }

        IToken token = IToken(IModularCompliance(_compliance).getTokenBound());
        uint256 totalSupply = token.totalSupply();
        if (totalSupply == 0) {
            return true;
        }

        return false;
    }

    /**
     * @dev See {IModule-isPlugAndPlay}.
     */
    function isPlugAndPlay() external pure returns (bool) {
        return false;
    }

    /**
     *  @dev See {IModule-name}.
     */
    function name() public pure returns (string memory _name) {
        return "MaxOwnershipByCountryModule";
    }

    /**
     *  @dev pre-set the balance of a token holder per ONCHAINID
     *  @param _compliance the address of the compliance contract to preset
     *  @param _id the ONCHAINID address of the token holder
     *  @param _balance the current balance of the token holder
     *  emits a `IDBalancePreSet` event
     */
    function _preSetModuleState(address _compliance, address _id, uint256 _balance) internal {
        _IDBalance[_compliance][_id] = _balance;
        emit IDBalancePreSet(_compliance, _id, _balance);
    }

    /**
     *  @dev function used to get the country of a wallet address.
     *  @param _compliance the compliance contract address for which the country verification is required
     *  @param _userAddress the address of the wallet to be checked
     *  @notice internal function, used only by the contract itself to process checks on investor countries
     *  returns the ONCHAINID address of the wallet owner
     */
    function _getIdentity(address _compliance, address _userAddress) internal view returns (address) {
        address identity = address(IToken(IModularCompliance(_compliance).getTokenBound())
            .identityRegistry().identity(_userAddress));
        require(identity != address(0), "identity not found");
        return identity;
    }

    /**
    * @dev function used to return percentage of the token supply relative to the amount
    * @param _amount is the amount of the transaction
    * returns the calculated percentage
    */
    function _getPercentage(address _compliance, uint256 _amount) internal view returns (uint16) {
        IToken token = IToken(IModularCompliance(_compliance).getTokenBound());
        uint256 totalSupply = token.totalSupply();
        // percentage is set in basis point so 10000 = 100%
        uint256 oneHundred = 100 * 10 ** 2;

        if (totalSupply > 0){
            return uint16(_amount.mulDiv(oneHundred, totalSupply));
        } else {
            return 0;
        }
    }

    /**
     *  @dev function used to check if user is local or non-local
     *  @param _compliance the compliance contract address for which the country verification is required
     *  @param _userAddress the address of the wallet to be checked
     *  @notice internal function, used only by the contract itself to process checks on investor countries
     *  returns a boolean flag indicating wether the user is local (true) or non-local (false)
     */
    function _isLocalUser(address _compliance, address _userAddress) internal view returns (bool) {
        uint16 userCountry = IToken(IModularCompliance(_compliance)
            .getTokenBound()).identityRegistry().investorCountry(_userAddress);

        require(userCountry != 0, "MaxOwnershipByCountryModule: user country not found");
        
        return userCountry == _localCountry[_compliance];
    }
}
