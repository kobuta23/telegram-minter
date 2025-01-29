# Group Chat NFT Bot

A Telegram bot that allows users in a group chat to create and mint ERC1155 NFTs on the Base network. This bot enables community-driven NFT creation and minting directly through Telegram.

## Features

- 🖼️ Create NFTs by uploading images and providing metadata
- 📤 Automatic IPFS upload via Pinata
- 🔄 Mint NFTs to any address or ENS name
- 🔐 Role-based access control for minting
- 📝 Foundry-based smart contract deployment
- 🤖 Telegram bot integration
- 📊 Token tracking and management
- 📋 Minting logs and history
- 👥 Admin controls and management

## Tech Stack

- **Smart Contracts**: Solidity + Foundry
- **Blockchain**: Base Network
- **Frontend**: Telegram Bot API
- **Storage**: IPFS via Pinata
- **Libraries**: 
  - Viem/Wagmi for blockchain interactions
  - Node-Telegram-Bot-API for Telegram integration
  - TypeScript for type safety

## Prerequisites

- Node.js 16+
- Foundry
- Telegram Bot Token
- Pinata API Key
- Base network wallet with funds

## Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd group-chat-nft-bot
```

2. Install dependencies:
```bash
npm install
forge install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your:
# - PRIVATE_KEY
# - TELEGRAM_BOT_TOKEN
# - PINATA_API_KEY
# - PINATA_SECRET_KEY
```

4. Deploy the smart contract:
```bash
forge script script/DeployGroupChatNFT.s.sol:DeployGroupChatNFT \
  --rpc-url https://base-mainnet.public.blastapi.io \
  --broadcast \
  --verify
```

5. Build and start the bot:
```bash
npm run build
npm start
```

## Development

For local development:
```bash
npm run dev
```

Run tests:
```bash
forge test
```

## Architecture

- `src/clients/` - External service clients (Telegram, blockchain)
- `src/config/` - Configuration and environment setup
- `src/handlers/` - Telegram bot command handlers
- `src/utils/` - Helper utilities
- `contracts/` - Smart contract code
- `script/` - Deployment scripts

## Commands

- `/start` - Initialize bot and show help
- `/create` - Start NFT creation process
- `/mint` - Mint an NFT to an address
- `/logs` - View minting history
- `/tokens` - View available tokens
- `/admin` - Admin controls (restricted)

## Security

- Role-based access control for minting
- Admin-only functions
- Environment variable protection
- Smart contract security best practices

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

Project Link: [https://github.com/yourusername/group-chat-nft-bot](https://github.com/yourusername/group-chat-nft-bot)

## Acknowledgments

- Base Network team
- OpenZeppelin for smart contract libraries
- Telegram Bot API documentation
- Claude, who wrote most of it 

