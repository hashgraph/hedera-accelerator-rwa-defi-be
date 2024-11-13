// SPDX-License-Identifier: GPL-3.0
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract ERC721Metadata is ERC721, ERC721URIStorage, Ownable {
    using Strings for string;

    uint256 private nextTokenId;
    mapping(bytes32 => KeyValue) internal metadata;
    mapping(uint256 => string[]) internal metadataKeys;
    mapping(uint256 => bool) internal isFrozen;
    mapping(string => KeyValue) internal collectionMetadata;
    string[] internal collectionMetadataKeys;

    struct KeyValue {
        string key;
        string value;
        bool exists;
    }

    struct TokenDetails {
        uint256 id;
        string uri;
        address owner;
        KeyValue[] metadata;
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

    // view calls
    function getMetadata(uint256 _tokenId) public view returns(KeyValue[] memory) {
        KeyValue[] memory data = new KeyValue[](metadataKeys[_tokenId].length);

        for (uint i = 0; i < metadataKeys[_tokenId].length; i++) {
            string memory key = metadataKeys[_tokenId][i];
            data[i] = getMetadata(_tokenId, key);
        }

        return data;
    }

    function getMetadata(uint256 _tokenId, string memory _key) public view returns(KeyValue memory) {
        return metadata[_tokenIdKeyHash(_tokenId,_key)];
    }

    function getCollectionMetadata() external view returns(KeyValue[] memory) {
        KeyValue[] memory data = new KeyValue[](collectionMetadataKeys.length);

        for (uint i = 0; i < collectionMetadataKeys.length; i++) {
            string memory key = collectionMetadataKeys[i];
            data[i] = (collectionMetadata[key]);
        }

        return data;
    }

    function getCollectionMetadata(string memory _key) external view returns(KeyValue memory) {
        return collectionMetadata[_key];
    }


    function filterTokens(string memory _key, string memory _value) external view returns(TokenDetails[] memory) {
        uint256 _tokenIndex;
        uint256[] memory _tokensIds = new uint256[](nextTokenId);

        for (uint _tokenId = 0; _tokenId < nextTokenId; _tokenId++) {
            string[] memory _metadataKeys = metadataKeys[_tokenId];

            for (uint j = 0; j < _metadataKeys.length; j++) {
                KeyValue memory _metadata = getMetadata(_tokenId, _metadataKeys[j]);

                if (_metadata.key.equal(_key) && _metadata.value.equal(_value)) {
                    _tokensIds[_tokenIndex++] = _tokenId;
                }
            }
        }

        return _getTokenDetails(_resizeArray(_tokensIds, _tokenIndex));
    }

    function filterTokens(string[] memory _keys, string[] memory _values) external view returns (TokenDetails[] memory) {
        require(_keys.length == _values.length, "ERC721Metadata: array length mismatch");

        uint256[] memory matchingTokenIds = new uint256[](nextTokenId);
        uint256 matchCount = 0;

        for (uint256 tokenId = 0; tokenId < nextTokenId; tokenId++) {
            bool matchesAll = true;

            // Check if the token has all specified key-value pairs
            for (uint256 i = 0; i < _keys.length; i++) {
                string memory key = _keys[i];
                string memory value = _values[i];
                
                KeyValue memory keyValue = metadata[_tokenIdKeyHash(tokenId, key)];
                
                // If key does not exist or value does not match, mark as unmatched
                if (!keyValue.exists || !keyValue.key.equal(key) || !keyValue.value.equal(value)){
                    matchesAll = false;
                    break;
                }
            }

            // If token has all matching key-value pairs, add it to the result
            if (matchesAll) {
                matchingTokenIds[matchCount++] = tokenId;
            }
        }

        // Resize the array to match count and return token details
        return _getTokenDetails(_resizeArray(matchingTokenIds, matchCount));
    }

    // mutable calls
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
        _tokenId = nextTokenId++;
        _safeMint(_to, _tokenId);
        _setTokenURI(_tokenId, _uri);
    }

    function _setMetadata(uint256 _tokenId, string memory _key, string memory _newValue) internal {
        KeyValue memory data = KeyValue(_key, _newValue, true);

        if (!metadata[_tokenIdKeyHash(_tokenId, _key)].exists)
            metadataKeys[_tokenId].push(_key);

        metadata[_tokenIdKeyHash(_tokenId, _key)] = data;
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

            if (!collectionMetadata[_keys[i]].exists)
                collectionMetadataKeys.push(_keys[i]);

            collectionMetadata[_keys[i]] = data;
        }
    }

    function _getTokenDetails(uint256[] memory _ids) internal view returns (TokenDetails[] memory) {
        TokenDetails[] memory _details = new TokenDetails[](_ids.length);
        
        for (uint i = 0; i < _ids.length; i++) {
            _details[i] = _getTokenDetails(_ids[i]);
        }

        return _details;
    }

    function _getTokenDetails(uint256 _id) internal view returns (TokenDetails memory _details) {
        return TokenDetails(_id, tokenURI(_id), ownerOf(_id), getMetadata(_id));
    }

    function _resizeArray(uint256[] memory array, uint256 newSize) internal pure returns (uint256[] memory) {
        uint256[] memory resizedArray = new uint256[](newSize);
        for (uint256 i = 0; i < newSize; i++) {
            resizedArray[i] = array[i];
        }
        return resizedArray;
    }

    function _tokenIdKeyHash(uint256 _tokenId, string memory _key) internal pure returns(bytes32) {
        return keccak256(abi.encodePacked(_tokenId, _key));
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
