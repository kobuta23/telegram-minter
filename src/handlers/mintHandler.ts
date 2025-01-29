import { bot } from '../clients/telegram';
import { userTokenMap } from '../storage/userTokens';
import { CONTRACT_ADDRESS } from '../config/environment';
import { publicClient, walletClient, ensClient } from '../clients/blockchain';
import { nftAbi, account, explorerLink } from '../clients/blockchain';
import { AuditLogger } from '../utils/auditLogger';
import { SecurityManager, Permission } from '../config/security';
import { saveUser } from '../storage/users';

export const initializeMintHandler = () => {
    
    bot.onText(/^\/mint\s+([^\s]+)(?:\s+(\d+))?$/, async (msg, match) => {
        console.log("minting for user called", match);
        saveUser(msg);
        const chatId = msg.chat.id;
        const userId = msg.from!.id;
        
        if (!SecurityManager.hasPermission(userId, Permission.MINT_ANY) || !SecurityManager.hasPermission(userId, Permission.MINT)) {
            await bot.sendMessage(chatId, 'You do not have permission to mint NFTs.');
            return;
        }
        
        if (!match) {
            await bot.sendMessage(chatId, 'Invalid command format. Use: /mint <address or ENS> [tokenId]');
            return;
        }
        
        const recipient = match[1];
        console.log("minting for user ", recipient);
        const specifiedTokenId = match[2] ? parseInt(match[2]) : null;
        if (specifiedTokenId && !SecurityManager.hasPermission(userId, Permission.MINT_ANY)) {
            await bot.sendMessage(chatId, 'You do not have permission to mint a specific NFT.');
            return;
        }
        console.log('Minting NFT to:', recipient);
        console.log('Specified token ID:', specifiedTokenId);
        const tokenId = specifiedTokenId || userTokenMap[userId];
        // Check if user has a token to mint
        if (!tokenId) {
            bot.sendMessage(msg.chat.id, `You don't have any NFT to mint. Create one first with /create`);
            return;
        } else {
            // send back a message with the token id, and the recipient address, mentioning it's pending
            bot.sendMessage(msg.chat.id, `NFT ${tokenId} is being minted to ${recipient}! Pending...`);
        }
        
        let address = '0x0' as `0x${string}`;
        if (recipient.endsWith('.eth')) {
            console.log("recipient has an ens-looking name")
            try {
                console.log("getting ens address")
                console.log("ensClient: ", ensClient.chain.rpcUrls);
                address = await ensClient.getEnsAddress({ name: recipient }) as `0x${string}`;
            } catch (error) {
                console.log('Error getting ENS address', error);
                bot.sendMessage(msg.chat.id, `Error getting ENS address`);
                return;
            }
        } else if (/^0x[0-9a-fA-F]{40}$/.test(recipient)) {
            console.log("recipient is a valid address")
            address = recipient as `0x${string}`;
        } else {
            console.log('Invalid address or ENS name');
            bot.sendMessage(msg.chat.id, `Invalid address or ENS name`);
            return;
        }
        let request: any;
        try {
            ({ request } = await publicClient.simulateContract({
            address: CONTRACT_ADDRESS,
            abi: nftAbi,
            functionName: 'mint',
            account: account.address,
            args: [address, BigInt(tokenId), 1n]
            }));
            console.log('Simulation successful, proceeding with transaction');
        } catch (error) {
            console.log('Error simulating transaction:', error);
            return;
        }
        try {
            const hash = await walletClient.writeContract({...request, account});
            console.log('Transaction sent:', hash);
            bot.sendMessage(msg.chat.id, `Minted NFT ${tokenId} to ${recipient}! Tx: ${explorerLink(hash)}`);

            // After successful mint, log the audit
            await AuditLogger.logHelper(msg, {
                action: 'mint',
                token: {
                    tokenId: Number(tokenId),
                    recipientAddress: address,
                    transactionHash: hash
                }
            });
            return;
        } catch (error) {
            console.log('Error sending transaction:', error);
            bot.sendMessage(msg.chat.id, `Error minting NFT ${tokenId} to ${recipient}!`);
            return;
        }
    });
}; 