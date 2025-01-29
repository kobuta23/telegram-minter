// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {GroupChatNFT} from "../contracts/GroupChatNFT.sol";
import {console} from "forge-std/console.sol";

contract DeployGroupChatNFT is Script {
    function run() external returns (GroupChatNFT) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address derived = vm.addr(deployerPrivateKey);
        console.log("Foundry derived address:", derived);

        vm.startBroadcast(deployerPrivateKey);
        
        GroupChatNFT nft = new GroupChatNFT(vm.addr(deployerPrivateKey));
        nft.grantRole(nft.MINTER_ROLE(), vm.addr(deployerPrivateKey));

        vm.stopBroadcast();
        
        return nft;
    }
} 

contract GiveMinterRole is Script {
    function run(address user) external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        GroupChatNFT nft = GroupChatNFT(vm.envAddress("CONTRACT_ADDRESS"));
        console.log("owner: ", nft.hasRole(nft.DEFAULT_ADMIN_ROLE(), vm.addr(deployerPrivateKey)));
        vm.startBroadcast(deployerPrivateKey);
        nft.grantRole(nft.MINTER_ROLE(), user);
        vm.stopBroadcast();
    }
}