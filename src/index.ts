import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { TelegramBot } from 'node-telegram-bot-api';
import { create } from 'ipfs-http-client';
import dotenv from 'dotenv';
import { abi } from './abi';
import { ethers } from 'ethers';

dotenv.config();

const PINATA_JWT = process.env.PINATA_JWT!;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS!;
const PRIVATE_KEY = process.env.PRIVATE_KEY!;
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;

// Initialize Telegram Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Initialize Viem clients
const publicClient = createPublicClient({
  chain: base,
  transport: http('https://base-mainnet.public.blastapi.io')
});

const account = privateKeyToAccount(PRIVATE_KEY);

const walletClient = createWalletClient({
  account,
  chain: base,
  transport: http('https://base-mainnet.public.blastapi.io')
});

// Initialize IPFS client (Pinata)
const pinata = create({
  url: 'https://api.pinata.cloud',
  headers: {
    Authorization: `Bearer ${PINATA_JWT}`
  }
});

// Store pending NFT creations
const pendingNFTs = new Map<number, {
  image?: Buffer,
  name?: string,
  description?: string
}>();

// Command handlers
bot.onText(/\/create/, async (msg) => {
  const chatId = msg.chat.id;
  pendingNFTs.set(msg.from!.id, {});
  bot.sendMessage(chatId, 'Let\'s create your NFT! Please send an image.');
});

// Handle image uploads
bot.on('photo', async (msg) => {
  const userId = msg.from!.id;
  const pending = pendingNFTs.get(userId);
  
  if (!pending) return;

  const photo = msg.photo![msg.photo!.length - 1];
  const file = await bot.getFile(photo.file_id);
  const imageBuffer = await downloadImage(file.file_path!);
  
  pending.image = imageBuffer;
  pendingNFTs.set(userId, pending);
  
  bot.sendMessage(msg.chat.id, 'Great! Now send the name for your NFT with /name <name>');
});

bot.onText(/\/name (.+)/, async (msg, match) => {
  const userId = msg.from!.id;
  const pending = pendingNFTs.get(userId);
  
  if (!pending) return;
  
  pending.name = match![1];
  pendingNFTs.set(userId, pending);
  
  bot.sendMessage(msg.chat.id, 'Excellent! Now send the description with /description <description>');
});

bot.onText(/\/description (.+)/, async (msg, match) => {
  const userId = msg.from!.id;
  const pending = pendingNFTs.get(userId);
  
  if (!pending || !pending.image || !pending.name) return;
  
  pending.description = match![1];
  
  // Upload to IPFS
  const imageResult = await pinata.add(pending.image);
  
  const metadata = {
    name: pending.name,
    description: pending.description,
    image: `ipfs://${imageResult.cid}`
  };
  
  const metadataResult = await pinata.add(JSON.stringify(metadata));
  
  // Create token on contract
  const { request } = await publicClient.simulateContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'createToken',
    args: [`ipfs://${metadataResult.cid}`]
  });

  const hash = await walletClient.writeContract(request);
  
  bot.sendMessage(msg.chat.id, `NFT created! TokenID will be available after transaction confirms. Tx: ${hash}`);
  pendingNFTs.delete(userId);
});

bot.onText(/\/mint (.+) (.+)/, async (msg, match) => {
  const tokenId = parseInt(match![1]);
  const recipient = match![2];
  
  let address;
  if (recipient.endsWith('.eth')) {
    address = await resolveENS(recipient);
  } else {
    address = recipient;
  }
  
  const { request } = await publicClient.simulateContract({
    address: CONTRACT_ADDRESS,
    abi,
    functionName: 'mint',
    args: [address, tokenId, 1n]
  });

  const hash = await walletClient.writeContract(request);
  
  bot.sendMessage(msg.chat.id, `Minting NFT ${tokenId} to ${recipient}! Tx: ${hash}`);
});

// Helper functions
async function downloadImage(filePath: string): Promise<Buffer> {
  const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
  return Buffer.from(await response.arrayBuffer());
}

async function resolveENS(name: string): Promise<string> {
  const provider = new ethers.providers.JsonRpcProvider('https://base-mainnet.public.blastapi.io');
  return await provider.resolveName(name) || name;
}

console.log('Bot started!'); 