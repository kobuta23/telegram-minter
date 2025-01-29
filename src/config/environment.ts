import dotenv from 'dotenv';
dotenv.config();

export const PINATA_JWT = process.env.PINATA_JWT!;
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS! as `0x${string}`;
export const PRIVATE_KEY = process.env.PRIVATE_KEY! as `0x${string}`;
export const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
export const TESTNET = process.env.TESTNET!; 
export const RPC_URL = `https://base-${TESTNET? 'sepolia' : 'mainnet'}.rpc.x.superfluid.dev/`
export const MAINNET_RPC_URL = `https://eth-mainnet.rpc.x.superfluid.dev/`;
export const ADMIN_ID = Number(process.env.ADMIN_ID!);
export const STACK_API_KEY = process.env.STACK_API_KEY!;
export const POINT_SYSTEM_ID = process.env.POINT_SYSTEM_ID!;