// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

contract ERC721Metadata is ERC721URIStorage {
    mapping(uint256 => mapping(string => KeyValue)) internal metadataByKey;
    mapping(uint256 => KeyValue[]) internal metadata;
    mapping(uint256 => bool) internal isMutable;

    struct KeyValue {
        string key;
        string value;
        bool exists;
    }

    modifier onlyTokenOwner(uint256 _tokenId) {
        require(ownerOf(_tokenId) == _msgSender(), "ERC721Metadata: not token owner");
        _;
    }

    modifier whenMutable(uint256 _tokenId) {
        require(isMutable[_tokenId], "ERC721Metadata: token can no longer be modified");
        _;
    }

    constructor (string memory _name, string memory _symbol) ERC721(_name, _symbol) {}

    function getMetadata(uint256 _tokenId) external view returns(KeyValue[] memory) {
        return metadata[_tokenId];
    }

    function getMetadataByKey(uint256 _tokenId, string memory _key) external view returns(KeyValue memory) {
        return metadataByKey[_tokenId][_key];
    }

    function setMetadata(uint256 _tokenId, string memory _key, string memory _newValue) external onlyTokenOwner(_tokenId) whenMutable(_tokenId) {
        _setMetadata(_tokenId, _key, _newValue);
    }

    function freezeMetadata(uint256 _tokenId) external onlyTokenOwner(_tokenId) {
        isMutable[_tokenId] = false;
    }

    function setBulkMetadata(uint256 _tokenId, string[] memory _keys, string[] memory _values) external onlyTokenOwner(_tokenId) whenMutable(_tokenId) {
        require(_keys.length == _values.length, "ERC721Metadata: array length mismatch");

        for (uint i = 0; i < _keys.length; i++) {       
            _setMetadata(_tokenId, _keys[i], _values[i]);
        }
    }

    function _setMetadata(uint256 _tokenId, string memory _key, string memory _newValue) internal {
        KeyValue memory data = KeyValue(_key, _newValue, true);

        metadataByKey[_tokenId][_key] = data;
        metadata[_tokenId].push(data);
    }
}
