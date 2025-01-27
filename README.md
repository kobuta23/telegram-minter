# Group Chat NFT Bot

A Telegram bot that allows users in a group chat to create and mint ERC1155 NFTs on the Base network.

## Features

- Create NFTs by uploading images and providing metadata
- Automatic IPFS upload via Pinata
- Mint NFTs to any address or ENS name
- Role-based access control for minting
- Foundry-based smart contract deployment

## Prerequisites

- Node.js 16+
- Foundry
- Telegram Bot Token
- Pinata API Key
- Base network wallet with funds

## Installation

1. Clone the repository: 
git clone <repository-url>
cd group-chat-nft-bot

npm install
forge install

cp .env.example .env
Edit .env with your private key

forge script script/DeployGroupChatNFT.s.sol:DeployGroupChatNFT --rpc-url https://base-mainnet.public.blastapi.io --broadcast --verify

npm run build

npm start

npm run dev

forge test


