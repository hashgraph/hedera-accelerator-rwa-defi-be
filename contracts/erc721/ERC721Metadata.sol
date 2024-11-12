// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721Metadata is ERC721, ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;
    mapping(uint256 => mapping(string => KeyValue)) internal metadataByKey;
    mapping(uint256 => KeyValue[]) internal metadata;
    mapping(uint256 => bool) internal isFrozen;
    mapping(string => KeyValue) internal collectionMetadataByKey;
    KeyValue[] internal collectionMetadata;

    struct KeyValue {
        string key;
        string value;
        bool exists;
    }

    modifier onlyTokenOwner(uint256 _tokenId) {
        require(ownerOf(_tokenId) == _msgSender(), "ERC721Metadata: not token owner");
        _;
    }

    modifier whenUnfrozen(uint256 _tokenId) {
        require(!isFrozen[_tokenId], "ERC721Metadata: token metadata can no longer be modified");
        _;
    }

    constructor (string memory _name, string memory _symbol) 
        ERC721(_name, _symbol) 
        Ownable(_msgSender()) {}

    function getMetadata(uint256 _tokenId) external view returns(KeyValue[] memory) {
        KeyValue[] memory data = new KeyValue[](metadata[_tokenId].length);

        for (uint i = 0; i < metadata[_tokenId].length; i++) {
            KeyValue memory keyvalue = metadata[_tokenId][i];
            data[i] = (metadataByKey[_tokenId][keyvalue.key]);
        }

        return data;
    }

    function getMetadata(uint256 _tokenId, string memory _key) external view returns(KeyValue memory) {
        return metadataByKey[_tokenId][_key];
    }

    function getCollectionMetadata() external view returns(KeyValue[] memory) {
        KeyValue[] memory data = new KeyValue[](collectionMetadata.length);

        for (uint i = 0; i < collectionMetadata.length; i++) {
            KeyValue memory keyvalue = collectionMetadata[i];
            data[i] = (collectionMetadataByKey[keyvalue.key]);
        }

        return data;
    }

    function getCollectionMetadata(string memory _key) external view returns(KeyValue memory) {
        return collectionMetadataByKey[_key];
    }

    function setMetadata(uint256 _tokenId, string memory _key, string memory _newValue) external onlyTokenOwner(_tokenId) whenUnfrozen(_tokenId) {
        _setMetadata(_tokenId, _key, _newValue);
    }
    
    function setMetadata(uint256 _tokenId, string[] memory _keys, string[] memory _values) external onlyTokenOwner(_tokenId) whenUnfrozen(_tokenId) {
        _setMetadata(_tokenId, _keys, _values);
    }

    function freezeMetadata(uint256 _tokenId) external onlyOwner whenUnfrozen(_tokenId) {
        isFrozen[_tokenId] = true;
    }

    // mint functions
    function mint(address _to, string memory _uri) external onlyOwner {
       _mint(_to, _uri);
    }

    function mint(address _to, string memory _uri, string[] memory _keys, string[] memory _values) external onlyOwner {
       uint256 tokenId = _mint(_to, _uri);
       _setMetadata(tokenId, _keys, _values);
    }

    function setTokenURI(uint256 _tokenId, string memory _newURI) external onlyOwner whenUnfrozen(_tokenId) {
        _setTokenURI(_tokenId, _newURI);
    }
    
    function setCollectionMetadata(string[] memory _keys, string[] memory _values) external onlyOwner {
        _setCollectionMetadata(_keys, _values);
    }

    // internal functions
    function _mint(address _to, string memory _uri) internal returns(uint256 _tokenId) {
        _tokenId = _nextTokenId++;
        _safeMint(_to, _tokenId);
        _setTokenURI(_tokenId, _uri);
    }

    function _setMetadata(uint256 _tokenId, string memory _key, string memory _newValue) internal {
        KeyValue memory data = KeyValue(_key, _newValue, true);

        if (!metadataByKey[_tokenId][_key].exists)
            metadata[_tokenId].push(data);

        metadataByKey[_tokenId][_key] = data;
    }

    function _setMetadata(uint256 _tokenId, string[] memory _keys, string[] memory _values) internal {
        require(_keys.length == _values.length, "ERC721Metadata: array length mismatch");

        for (uint i = 0; i < _keys.length; i++) {       
            _setMetadata(_tokenId, _keys[i], _values[i]);
        }
    }

    function _setCollectionMetadata(string[] memory _keys, string[] memory _values) internal {
        require(_keys.length > 0, "ERC721Metadata: invalid array length");
        require(_keys.length == _values.length, "ERC721Metadata: array length mismatch");

        for (uint i = 0; i < _keys.length; i++) {       
             KeyValue memory data = KeyValue(_keys[i], _values[i], true);

            if (!collectionMetadataByKey[_keys[i]].exists)
                collectionMetadata.push(data);

            collectionMetadataByKey[_keys[i]] = data;
        }
    }

    // The following functions are overrides required by Solidity.
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
