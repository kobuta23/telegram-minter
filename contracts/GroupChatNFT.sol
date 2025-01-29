// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract GroupChatNFT is ERC1155, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    uint256 private _currentTokenId;
    
    // Mapping from token ID to token URI
    mapping(uint256 => string) private _tokenURIs;

    constructor(address initialOwner) ERC1155("") {
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
        _grantRole(MINTER_ROLE, initialOwner);
        _currentTokenId = 0;
    }

    function createToken(string memory tokenURI) external onlyRole(MINTER_ROLE) returns (uint256) {
        _currentTokenId += 1;
        _tokenURIs[_currentTokenId] = tokenURI;
        return _currentTokenId;
    }

    function mint(address to, uint256 tokenId, uint256 amount) external onlyRole(MINTER_ROLE) {
        require(_exists(tokenId), "Token does not exist");
        _mint(to, tokenId, amount, "");
    }

    function uri(uint256 tokenId) public view virtual override returns (string memory) {
        require(_exists(tokenId), "URI query for nonexistent token");
        return _tokenURIs[tokenId];
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return bytes(_tokenURIs[tokenId]).length > 0;
    }

    // Override required by Solidity
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
} 