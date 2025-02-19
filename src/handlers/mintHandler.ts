import { bot } from '../clients/telegram';
import { userTokenMap } from '../storage/userTokens';
import { CONTRACT_ADDRESS } from '../config/environment';
import { publicClient, walletClient, ensClient } from '../clients/blockchain';
import { nftAbi, account, explorerLink } from '../clients/blockchain';
import { AuditLogger } from '../utils/auditLogger';
import { SecurityManager, Permission } from '../config/security';
import { saveUser } from '../storage/users';
import { Message } from 'node-telegram-bot-api';
import { CallbackQuery } from 'node-telegram-bot-api';

export const initializeMintHandler = () => {

    const pendingMintRequests = new Map<string, {
        from: string; // telegram id of the user who initiated the request
        to: `0x${string}`; // address of the user who is receiving the NFT
        recipient: string; // ENS name or address of the user who is receiving the NFT
        tokenId: number;
    }>();
    
    bot.onText(/^\/mint\s+([^\s]+)(?:\s+(\d+))?$/, async (msg: Message, match: Array<string | number> | null) => {
        console.log("minting for user called", match);
        saveUser(msg);
        const chatId = msg.chat.id;
        const userId = msg.from!.id;
        
        if (!SecurityManager.hasPermission(userId, Permission.MINT_ANY) && !SecurityManager.hasPermission(userId, Permission.MINT)) {
            await bot.sendMessage(chatId, 'You do not have permission to mint NFTs.');
            return;
        }
        
        if (!match) {
            await bot.sendMessage(chatId, 'Invalid command format. Use like this: /mint <address or ENS> <tokenId (optional)>');
            return;
        }
        
        const recipient = match[1];
        let address = '0x0' as `0x${string}`;

        console.log("minting for user ", recipient);
        const specifiedTokenId = match[2] ? parseInt(match[2].toString()) : null;
        if (specifiedTokenId && !SecurityManager.hasPermission(userId, Permission.MINT_ANY)) {
            await bot.sendMessage(chatId, 'You do not have permission to mint a specific NFT.');
            return;
        }

        const tokenId = specifiedTokenId || userTokenMap[userId];
        // Check if user has a token to mint
        if (!tokenId) {
            bot.sendMessage(msg.chat.id, `You don't have any NFT to mint. Create one first with /create`);
            return;
        }
        
        if (recipient.toString().endsWith('.eth')) {
            console.log("recipient has an ens-looking name")
            try {
                console.log("getting ens address")
                address = await ensClient.getEnsAddress({ name: recipient as string }) as `0x${string}`;
                if (!address) {
                    bot.sendMessage(msg.chat.id, `Could not resolve ENS name ${recipient}`);
                    return;
                }
                console.log("ens address found: ", address);
            } catch (error) {
                console.log('Error getting ENS address', error);
                bot.sendMessage(msg.chat.id, `Error resolving ENS name ${recipient}`);
                return;
            }
        } else if (/^0x[0-9a-fA-F]{40}$/.test(recipient.toString())) {
            address = recipient as `0x${string}`;
        } else {
            console.log('Invalid address or ENS name');
            bot.sendMessage(msg.chat.id, `Invalid address or ENS name`);
            return;
        }

        // Get token metadata for confirmation
        try {
            const tokenUri = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: nftAbi,
                functionName: 'uri',
                args: [BigInt(tokenId)]
            }) as string;

            const httpUrl = tokenUri.replace('ipfs://', 'https://ipfs.io/ipfs/');
            const response = await fetch(httpUrl);
            const metadata = await response.json();

            await bot.sendNFTPreview({
                chatId: chatId,
                nft: {
                    image: metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/'),
                    name: metadata.name,
                    description: metadata.description,
                    tokenId: tokenId
                },
                replyToMessageId: msg.message_id
            });
            // Create confirmation message with NFT details
            const confirmMessage = 
                `Mint NFT #${tokenId} to *${recipient !== address 
                                            ? (recipient + ` (${address})`) 
                                            : recipient}*?`;

            // generate a random id for the request
            const requestId = Math.random().toString(36).substring(2, 15);
            const buttonData = `confirm_mint_${userId}_${requestId}`;
            pendingMintRequests.set(requestId, {
                from: userId.toString(),
                to: address,
                recipient: recipient.toString(),
                tokenId: tokenId
            });
            console.log("button data: ", buttonData);
            const opts = {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '✅ Confirm', callback_data: buttonData },
                        { text: '❌ Cancel', callback_data: `cancel_mint_${userId}` }
                    ]],
                    selective: true
                },
                parse_mode: 'Markdown' as const
            };
            // Send confirmation message
            await bot.sendMessage(chatId, confirmMessage, opts);
        } catch (error) {
            console.error('Error fetching token details:', error);
            bot.sendMessage(chatId, 'Error preparing mint. Please try again.');
            return;
        }
    });

    // Handle mint confirmation
    bot.on('callback_query', async (query: CallbackQuery) => {
        const [action, type, senderId, requestId] = (query.data || '').split('_');
        const userId = query.from.id;
        const chatId = query.message!.chat.id;

        // Verify the user is the one who initiated the action
        if (userId.toString() !== senderId) {
            bot.answerCallbackQuery(query.id, {
                text: 'This action is not for you',
                show_alert: true
            });
            return;
        }
        
        if (type === 'mint') {
            if (action === 'confirm') {
                const request = pendingMintRequests.get(requestId);
                if (!request) {
                    await bot.sendMessage(chatId, 'No mint request found.');
                    return;
                }
                const { to, recipient, tokenId } = request;
                
                const loadingMessage = await bot.sendMessage(chatId, `Minting NFT ${tokenId} to ${recipient}...`);
                try {
                    const { request } = await publicClient.simulateContract({
                        address: CONTRACT_ADDRESS,
                        abi: nftAbi,
                        functionName: 'mint',
                        account: account.address,
                        args: [to as `0x${string}`, BigInt(tokenId), 1n]
                    });
                    
                    const hash = await walletClient.writeContract({...request, account});
                    await bot.editMessageText(`Minted NFT ${tokenId} to ${recipient}! Transaction hash: ${hash}`, { //TODO: add link to explorer
                        chat_id: chatId,
                        message_id: loadingMessage.message_id
                    });

                    // Log the mint
                    await AuditLogger.logHelper(query.message, {
                        action: 'mint',
                        token: {
                            tokenId: Number(tokenId),
                            recipientAddress: to,
                            transactionHash: hash
                        }
                    });
                } catch (error) {
                    console.error('Error minting:', error);
                    await bot.sendMessage(chatId, `Error minting NFT. Please try again.`);
                }
            } else if (action === 'cancel') {
                await bot.sendMessage(chatId, 'Minting cancelled.');
            }

            // Remove the inline keyboard
            bot.editMessageReplyMarkup(
                { inline_keyboard: [] },
                {
                    chat_id: chatId,
                    message_id: query.message?.message_id
                }
            );
        }
    });
}; 