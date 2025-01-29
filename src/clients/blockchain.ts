import { createPublicClient, createWalletClient, http } from 'viem';
import { base, baseSepolia, mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { PRIVATE_KEY, TESTNET, RPC_URL, MAINNET_RPC_URL } from '../config/environment';
import nftArtifact from '../../out/GroupChatNFT.sol/GroupChatNFT.json';

export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;
export const nftAbi = nftArtifact.abi;

const httpRpc = http(RPC_URL);

export const publicClient = createPublicClient({
    chain: TESTNET? baseSepolia : base,
    transport: httpRpc
});

export const ensClient = createPublicClient({
    chain: mainnet,
    transport: http(MAINNET_RPC_URL)
});

export const account = privateKeyToAccount(PRIVATE_KEY);

export const walletClient = createWalletClient({
    account,
    chain: TESTNET? baseSepolia : base,
    transport: httpRpc
}); 

export const explorerLink = (hash: string) => {
    return `https://${TESTNET? 'sepolia.' : ''}basescan.org/tx/${hash}`;
}