// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/GroupChatNFT.sol";

contract GroupChatNFTTest is Test {
    GroupChatNFT public nft;
    address public owner;
    address public minter;
    address public user;

    function setUp() public {
        owner = address(this);
        minter = address(0x1);
        user = address(0x2);
        
        nft = new GroupChatNFT(owner);
    }

    function testGrantMinterRole() public {
        nft.grantRole(nft.MINTER_ROLE(), minter);
        assertTrue(nft.hasRole(nft.MINTER_ROLE(), minter));
    }

    function testCreateToken() public {
        nft.grantRole(nft.MINTER_ROLE(), minter);
        
        vm.prank(minter);
        uint256 tokenId = nft.createToken("ipfs://test");
        assertEq(tokenId, 1);
        assertEq(nft.uri(tokenId), "ipfs://test");
    }

    function testMint() public {
        nft.grantRole(nft.MINTER_ROLE(), minter);
        
        vm.prank(minter);
        uint256 tokenId = nft.createToken("ipfs://test");
        
        vm.prank(minter);
        nft.mint(user, tokenId, 1);
        
        assertEq(nft.balanceOf(user, tokenId), 1);
    }

    function testFailCreateTokenUnauthorized() public {
        vm.prank(user);
        nft.createToken("ipfs://test");
    }

    function testFailMintUnauthorized() public {
        nft.grantRole(nft.MINTER_ROLE(), minter);
        
        vm.prank(minter);
        uint256 tokenId = nft.createToken("ipfs://test");
        
        vm.prank(user);
        nft.mint(user, tokenId, 1);
    }

    function testFailMintNonexistentToken() public {
        nft.grantRole(nft.MINTER_ROLE(), minter);
        
        vm.prank(minter);
        nft.mint(user, 1, 1);
    }
} 