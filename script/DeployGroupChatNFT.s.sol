// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {GroupChatNFT} from "../contracts/GroupChatNFT.sol";

contract DeployGroupChatNFT is Script {
    function run() external returns (GroupChatNFT) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        
        vm.startBroadcast(deployerPrivateKey);
        
        GroupChatNFT nft = new GroupChatNFT(vm.addr(deployerPrivateKey));
        
        vm.stopBroadcast();
        
        return nft;
    }
} 