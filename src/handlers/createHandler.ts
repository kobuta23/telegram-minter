    import { bot } from '../clients/telegram';
    import { userTokenMap, pendingNFTs } from '../storage/userTokens';
    import { nftAbi, account, publicClient, walletClient } from '../clients/blockchain';
    import { updateUserToken } from '../storage/userTokens';
    import { Readable } from 'stream';
    import axios from 'axios';
    import { PINATA_JWT, CONTRACT_ADDRESS, TESTNET, BOT_TOKEN } from '../config/environment';
    import FormData from 'form-data';
    import { AuditLogger } from '../utils/auditLogger';
    import { SecurityManager, Permission } from '../config/security';

    export const initializeCreateHandler = () => {
    
        bot.onText(/\/create/, async (msg) => {
            const chatId = msg.chat.id;
            const userId = msg.from!.id;
            
            // Check permissions
            if (!SecurityManager.hasPermission(userId, Permission.CREATE)) {
                await bot.sendMessage(chatId, 'You do not have permission to create NFTs.');
                return;
            }
            
            // Check if user already has a token
            if (userTokenMap[userId]) {
                const opts = {
                reply_markup: {
                    inline_keyboard: [
                    [
                        { text: 'Create new', callback_data: 'create_new' },
                        { text: 'Keep existing', callback_data: 'keep_existing' }
                    ]
                    ]
                }
                };
                bot.sendMessage(
                chatId, 
                `You already have an NFT with token ID ${userTokenMap[userId]}. Would you like to create a new one? This will replace your existing NFT.`,
                opts
                );
                return;
            }
            
            pendingNFTs.set(userId, {});
            bot.sendMessage(chatId, 'Let\'s create your NFT! Please send an image.');
        });
        
        // Handle callback for NFT creation choice
        bot.on('callback_query', async (query) => {
            const userId = query.from.id;
            const chatId = query.message!.chat.id;
        
            if (query.data === 'create_new') {
                pendingNFTs.set(userId, {});
                bot.sendMessage(chatId, 'Let\'s create your new NFT! Please send an image.');
            } else if (query.data === 'keep_existing') {
                bot.sendMessage(chatId, 'Keeping your existing NFT.');
            }
            
            // Remove the inline keyboard
            bot.editMessageReplyMarkup(
                { inline_keyboard: [] }, 
                { chat_id: chatId, message_id: query.message!.message_id }
            );
        });
        
        // Handle image uploads
        bot.on('photo', async (msg) => {
            const userId = msg.from!.id;
            const pending = pendingNFTs.get(userId);
            
            if (!pending) return;
        
            const photo = msg.photo![msg.photo!.length - 1];
            console.log('Received photo:', photo); // Debug log
            
            const file = await bot.getFile(photo.file_id);
            console.log('File info:', file); // Debug log
            
            const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
            const imageBuffer = Buffer.from(await response.arrayBuffer());
            console.log('Image buffer size:', imageBuffer.length); // Debug log
            
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
            let ipfsUrl = '';
            // send back a message with the image, name and description, asking for confirmation. The user can send /confirm to confirm, or /cancel to cancel
            bot.sendMessage(msg.chat.id, `Image: ${pending.image}, Name: ${pending.name}, Description: ${pending.description}. Is this correct? /confirm /cancel`);
            
            bot.onText(/\/confirm/, async (confirmMsg) => {
                bot.sendMessage(msg.chat.id, 'Confirmed!');
                bot.sendMessage(msg.chat.id, 'Creating NFT...');
                
                try {
                    // Create a readable stream from the buffer
                    const imageStream = Readable.from(pending.image!);
                    
                    // Upload image to IPFS
                    const formData = new FormData();
                    formData.append('file', imageStream, {
                        filename: `${pending.name}-image.jpg`,
                        contentType: 'image/jpeg'
                    });
                    
                    console.log('Uploading image to Pinata...'); // Debug log
                    const imageResult = await axios.post(
                        'https://api.pinata.cloud/pinning/pinFileToIPFS',
                        formData,
                        {
                            headers: {
                                'Authorization': `Bearer ${PINATA_JWT}`,
                                ...formData.getHeaders() // Important: get headers from form-data
                            },
                            maxBodyLength: Infinity
                        }
                    );
            
                    // Create and upload metadata
                    const metadata = {
                        name: pending.name,
                        description: pending.description,
                        image: `ipfs://${imageResult.data.IpfsHash}`
                    };
            
                    const metadataFormData = new FormData();
                    const metadataStream = Readable.from(Buffer.from(JSON.stringify(metadata)));
                    metadataFormData.append('file', metadataStream, {
                        filename: `${pending.name}-metadata.json`,
                        contentType: 'application/json'
                    });
            
                    console.log('Uploading metadata to Pinata...'); // Debug log
                    const metadataResult = await axios.post(
                        'https://api.pinata.cloud/pinning/pinFileToIPFS',
                        metadataFormData,
                        {
                            headers: {
                                'Authorization': `Bearer ${PINATA_JWT}`,
                                ...metadataFormData.getHeaders() // Important: get headers from form-data
                            },
                            maxBodyLength: Infinity
                        }
                    );
                    
                    console.log("Uploaded metadata to Pinata");
                    console.log("Creating token on contract");
                    ipfsUrl = `ipfs://${metadataResult.data.IpfsHash}`;
                    console.log("IPFS url: ", ipfsUrl);
                    
                    // First simulate the transaction
                    const { request, result } = await publicClient.simulateContract({
                        address: CONTRACT_ADDRESS,
                        abi: nftAbi,
                        functionName: 'createToken',
                        account: account.address,
                        args: [ipfsUrl],
                        value: 0n
                    });
                    
                    console.log('Simulation successful, proceeding with transaction');
            
                    // Execute the actual transaction using the simulated request
                    const hash = await walletClient.writeContract({...request, account});
                    console.log('Transaction sent:', hash);
            
                    // Wait for transaction to be mined
                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                    console.log('Transaction mined:', receipt.transactionHash);
                    
                    // The token ID is returned directly from createToken function
                    const tokenId = result;
                    console.log('Token ID:', tokenId);
            
                    // Update user token mapping
                    updateUserToken(userId, Number(tokenId));
            
                    bot.sendMessage(msg.chat.id, `NFT created! TokenID: ${tokenId}. Tx: https://${TESTNET? 'sepolia.' : ''}basescan.org/tx/${hash}`);
                    bot.sendMessage(msg.chat.id, `It is recorded as your default NFT. Mint it to someone else with /mint <address | ens-name>`);
                    bot.sendMessage(msg.chat.id, `Anyone in the group can mint it to anyone else with /mint <address | ens-name> <token-id>`);

                    // After successful NFT creation, log the audit
                    await AuditLogger.logHelper(msg, {
                        action: 'create',
                        token: {
                            tokenId: Number(tokenId),
                            transactionHash: receipt.transactionHash,
                            tokenMetadata: {
                                name: pending.name,
                                description: pending.description,
                                imageUrl: ipfsUrl
                            }
                        }
                    });
                    
                    pendingNFTs.delete(userId);
                    
                } catch (error: any) { // Type assertion for error handling
                    console.error('Error in NFT creation:', {
                        name: error?.name,
                        message: error?.message,
                        config: error?.config,
                        response: error?.response?.data
                    });
                    bot.sendMessage(msg.chat.id, 'Sorry, there was an error creating your NFT. Please try again.');
                    pendingNFTs.delete(userId);
                }
            });
            
            bot.onText(/\/cancel/, async (cancelMsg) => {
                bot.sendMessage(msg.chat.id, 'Cancelled!');
                pendingNFTs.delete(userId);
                bot.sendMessage(msg.chat.id, 'NFT creation cancelled.');
            });
        });
    };