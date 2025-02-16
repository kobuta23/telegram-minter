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
        import { givePointsToNFTHolders } from '../clients/stack';
        import { saveUser } from '../storage/users';
        import { uploadToIPFS } from '../utils/ipfs';
        import { NFTPreview } from '../types/customTypes';
        import { Message } from 'node-telegram-bot-api';
        import { CallbackQuery } from 'node-telegram-bot-api';


        export const initializeCreateHandler = () => {
        
            bot.onText(/\/create/, async (msg: Message) => {
                saveUser(msg);
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
                            inline_keyboard: [[
                                { text: 'Create new', callback_data: `create_existing_${userId}` },
                                { text: 'Keep existing', callback_data: `keep_existing_${userId}` }
                            ]],
                            selective: true
                        },
                        reply_to_message_id: msg.message_id
                    };
                    bot.sendMessage(
                        chatId, 
                        `You already have an NFT with token ID ${userTokenMap[userId]}. Would you like to create a new one? This will replace your existing NFT.`,
                        opts
                    );
                    return;
                }
                
                pendingNFTs.set(userId, {});
                const opts = {
                    reply_markup: {
                        force_reply: true,
                        selective: true
                    },
                    reply_to_message_id: msg.message_id,
                    caption: '🖼 Please send your image for the NFT'
                };
                bot.sendMessage(chatId, 'Let\'s create your NFT! Please send an image.', opts);
            });
            
            // Handle callback for NFT creation choice
            bot.on('callback_query', async (query: CallbackQuery) => {
                console.log('Unified callback handler received:', query.data);
                
                const userId = query.from.id;
                const chatId = query.message!.chat.id;
                const [action, type, targetUserId, ...params] = (query.data || '').split('_');
                
                console.log('Parsed data:', { action, type, targetUserId, userId, params });
                
                // Verify the user is the one who initiated the action
                if (userId.toString() !== targetUserId) {
                    console.log('Permission denied');
                    bot.answerCallbackQuery(query.id, {
                        text: 'This action is not for you',
                        show_alert: true
                    });
                    return;
                }

                // Remove the inline keyboard for all actions
                const removeKeyboard = async () => {
                    await bot.editMessageReplyMarkup(
                        { inline_keyboard: [] },
                        {
                            chat_id: chatId,
                            message_id: query.message?.message_id
                        }
                    );
                };

                try {
                    switch(type) {
                        case 'existing': {
                            if (action === 'create') {
                                pendingNFTs.set(userId, {});
                                const opts = {
                                    reply_markup: {
                                        force_reply: true,
                                        selective: true
                                    },
                                    reply_to_message_id: query.message?.message_id
                                };
                                await bot.sendMessage(chatId, 'Let\'s create your new NFT! Please send an image.', opts);
                            } else if (action === 'keep') {
                                await bot.sendMessage(chatId, 'Keeping your existing NFT.');
                            }
                            await removeKeyboard();
                            break;
                        }

                        case 'nft': {
                            if (action === 'confirm') {
                                const pending = pendingNFTs.get(userId);
                                if (!pending || !pending.image || !pending.name || !pending.description) {
                                    await bot.sendMessage(chatId, 'Error: Missing NFT information. Please start over with /create');
                                    return;
                                }
                                await bot.deleteMessage(chatId, query.message?.message_id.toString() || '');
                                const loadingMessage = await bot.sendMessage(chatId, 'Creating your NFT...');
                                
                                const imageIpfsUrl = await uploadToIPFS(pending.image!, { 
                                    filename: `${pending.name}-image.jpg`, 
                                    contentType: 'image/jpeg' 
                                });
                                console.log('imageIpfsUrl:', imageIpfsUrl);
                        
                                const tokenMetadata = {
                                    name: pending.name,
                                    description: pending.description,
                                    image: imageIpfsUrl
                                };

                                const metadataIpfsUrl = await uploadToIPFS(tokenMetadata, { 
                                    filename: `${pending.name}-metadata.json`, 
                                    contentType: 'application/json' 
                                });
                                console.log('metadataIpfsUrl:', metadataIpfsUrl);

                                const { request, result } = await publicClient.simulateContract({
                                    address: CONTRACT_ADDRESS,
                                    abi: nftAbi,
                                    functionName: 'createToken',
                                    account: account.address,
                                    args: [metadataIpfsUrl]
                                });
                                const hash = await walletClient.writeContract({...request, account});
                                const tokenId = Number(result);
                                try {
                                    const receipt = await publicClient.waitForTransactionReceipt({ hash });
                                } catch (error) {
                                    console.error('Error in waitForTransactionReceipt:', error);
                                    await bot.sendMessage(chatId, 'Error: Failed to create NFT. Please try again.');
                                    return;
                                }
                                
                                updateUserToken(userId, tokenId);
                                
                                await AuditLogger.logHelper(query.message, {
                                    action: 'create',
                                    token: {
                                        tokenId,
                                        transactionHash: hash
                                    }
                                });
                                await bot.deleteMessage(chatId, loadingMessage.message_id.toString());
                                await bot.sendMessage(
                                    chatId, 
                                    `✨ NFT created successfully!\n\nToken ID: ${tokenId}\nTransaction: ${hash}\n\nUse /mint to mint it to an address.`
                                );
                            } else if (action === 'cancel') {
                                pendingNFTs.delete(userId);
                                await removeKeyboard();
                                await bot.sendMessage(chatId, 'NFT creation cancelled.');
                            }
                            break;
                        }

                        case 'points': {
                            if (action === 'confirm') {
                                const [tokenId, points] = params.map(Number);
                                const result = await givePointsToNFTHolders(tokenId, points);
                                
                                await removeKeyboard();
                                await bot.sendMessage(chatId, result, {
                                    reply_to_message_id: query.message?.message_id,
                                    parse_mode: 'Markdown' as const
                                });

                                await AuditLogger.log({
                                    action: 'points',
                                    userId: query.from.id,
                                    username: query.from.username || '',
                                    chatId: query.message!.chat.id,
                                    chatTitle: query.message!.chat.title || '',
                                    chatMsg: query.message!.text || '',
                                    points: {
                                        tokenId,
                                        points
                                    }
                                });
                            } else if (action === 'cancel') {
                                await removeKeyboard();
                                await bot.sendMessage(chatId, 'Points assignment cancelled.', {
                                    reply_to_message_id: query.message?.message_id
                                });
                            }
                            break;
                        }
                    }
                } catch (error) {
                    console.error('Error in callback handler:', error);
                    await bot.sendMessage(chatId, 'An error occurred. Please try again.');
                }
            });
            
            // Handle image uploads
            bot.on('photo', async (msg: Message) => {
                saveUser(msg);
                const userId = msg.from!.id;
                const pending = pendingNFTs.get(userId);
                
                if (!pending) return;
            
                const photo = msg.photo![msg.photo!.length - 1];
                
                // Validate image dimensions
                if (photo.width < 400 || photo.height < 400) {
                    bot.sendMessage(msg.chat.id, '❌ Image is too small. Please send an image that is at least 400x400 pixels.', {
                        reply_to_message_id: msg.message_id
                    });
                    return;
                }

                if (photo.width > 3000 || photo.height > 3000) {
                    bot.sendMessage(msg.chat.id, '❌ Image is too large. Please send an image that is no larger than 3000x3000 pixels.', {
                        reply_to_message_id: msg.message_id
                    });
                    return;
                }

                // Validate file size
                const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
                if (photo.file_size && photo.file_size > MAX_FILE_SIZE) {
                    bot.sendMessage(msg.chat.id, '❌ File is too large. Please send an image under 5MB.', {
                        reply_to_message_id: msg.message_id
                    });
                    return;
                }

                try {
                    const file = await bot.getFile(photo.file_id);
                    // Validate file type
                    const response = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${file.file_path}`);
                    const contentType = response.headers.get('content-type');
                    console.log('contentType:', contentType);
                    console.log('file path:', file.file_path);

                    // Get file extension from the file path
                    const fileExtension = file.file_path?.split('.').pop()?.toLowerCase();
                    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

                    if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
                        bot.sendMessage(msg.chat.id, '❌ Unsupported image format. Please send a JPEG, PNG, or WebP image.', {
                            reply_to_message_id: msg.message_id
                        });
                        return;
                    }

                    // Since Telegram has already validated this is an image, and we've checked the extension,
                    // we can proceed with getting the image data
                    const imageBuffer = Buffer.from(await response.arrayBuffer());
                    
                    pending.image = imageBuffer;

                    // Send success message and ask for name
                    const imageSizeInMB = (imageBuffer.length / (1024 * 1024)).toFixed(2);
                    const successMessage = `✅ Image accepted!\n` +
                        `📏 Dimensions: ${photo.width}x${photo.height}\n` +
                        `📦 Size: ${imageSizeInMB}MB\n` +
                        `🖼 Format: ${fileExtension.toUpperCase()}\n\n`

                    const opts = {
                        reply_markup: {
                            force_reply: true,
                            selective: true,
                            input_field_placeholder: "Enter a name for your NFT",
                            parse_mode: 'Markdown' as const
                        },
                        reply_to_message_id: msg.message_id
                    };

                    const message = (await bot.sendNFTPreview({
                        chatId: msg.chat.id,
                        nft: {
                            image: imageBuffer
                        }
                    }))
                    if(typeof message !== 'boolean') pending.previewMessageId = message.message_id;
                    pending.previewMessageId 
                    pendingNFTs.set(userId, pending);
                    pending.instructionMessageId = (await bot.sendMessage(msg.chat.id, 'What would you like to name your NFT?', opts)).message_id;
                } catch (error) {
                    console.error('Error processing image:', error);
                    bot.sendMessage(msg.chat.id, '❌ Error processing image. Please try again with a different image.', {
                        reply_to_message_id: msg.message_id
                    });
                    pendingNFTs.delete(userId);
                }
            });
            
            // Handle name reply
            bot.on('message', async (msg: Message) => {
                if (!msg.reply_to_message) return;
                if (!msg.text) return;
                
                const userId = msg.from!.id;
                const pending = pendingNFTs.get(userId);
                if (!pending || !pending.image) return;

                // Check if this is a reply to our name question
                if (msg.reply_to_message.text?.includes('What would you like to name your NFT?')) {
                    const name = msg.text.trim();
                    
                    // Validate name
                    if (name.length < 3 || name.length > 50) {
                        const opts = {
                            reply_markup: {
                                force_reply: true,
                                selective: true,
                                input_field_placeholder: "Enter a name (3-50 characters)"
                            },
                            reply_to_message_id: msg.message_id
                        };
                        bot.sendMessage(msg.chat.id, '❌ Name must be between 3 and 50 characters. Please try again:', opts);
                        return;
                    }

                    pending.name = name;
                    pendingNFTs.set(userId, pending);

                    // Ask for description
                    const opts = {
                        reply_markup: {
                            force_reply: true,
                            selective: true,
                            input_field_placeholder: "Describe your NFT"
                        }
                    };
                    await bot.sendNFTPreview({
                        chatId: msg.chat.id,
                        nft: {
                            name: pending.name
                        },
                        editMessageId: pending.previewMessageId
                    });
                    bot.deleteMessage(msg.chat.id, msg.message_id.toString()); // Delete the name message
                    bot.deleteMessage(msg.chat.id, pending.instructionMessageId?.toString() || '');
                    pending.instructionMessageId = (await bot.sendMessage(msg.chat.id, 'Great name! Now, please provide a description for your NFT:', opts)).message_id;
                    pendingNFTs.set(userId, pending);
                }
                // Check if this is a reply to our description question
                else if (msg.reply_to_message.text?.includes('provide a description')) {
                    const description = msg.text.trim();
                    
                    // Validate description
                    if (description.length < 10 || description.length > 500) {
                        const opts = {
                            reply_markup: {
                                force_reply: true,
                                selective: true,
                                input_field_placeholder: "Enter a description (10-500 characters)"
                            },
                            reply_to_message_id: msg.message_id
                        };
                        bot.sendMessage(msg.chat.id, '❌ Description must be between 10 and 500 characters. Please try again:', opts);
                        return;
                    }

                    pending.description = description;
                    const newCaption = `📝 *NFT Information*\n\n` +
                        `*Name:* ${pending.name}\n` +
                        `*Description:* ${pending.description}\n\n`;
                    await bot.editMessageCaption(newCaption, {
                        chat_id: msg.chat.id,
                        message_id: pending.previewMessageId,
                        parse_mode: 'Markdown' as const
                    });
                    await bot.deleteMessage(msg.chat.id, msg.message_id.toString());
                    await bot.deleteMessage(msg.chat.id, pending.instructionMessageId?.toString() || '');

                    const opts = {
                        reply_markup: {
                            inline_keyboard: [[
                                { text: '✅ Confirm', callback_data: `confirm_nft_${userId}` },
                                { text: '❌ Cancel', callback_data: `cancel_nft_${userId}` }
                            ]],
                            selective: true,
                            input_field_placeholder: "Is this correct?",
                            force_reply: true
                        },
                        parse_mode: 'Markdown' as const,
                    };
                    
                    // Then send the confirmation message
                    pending.instructionMessageId = (await bot.sendMessage(msg.chat.id, 'Is this correct?', opts)).message_id;
                    pendingNFTs.set(userId, pending);
                }
            });

            bot.onText(/\/points (\d+) (\d+)/, async (msg: Message, match: RegExpMatchArray | null) => {
                saveUser(msg);

                const userId = msg.from!.id;
                // Check permissions
                if (!SecurityManager.hasPermission(userId, Permission.ADMIN)) {
                    await bot.sendMessage(msg.chat.id, 'You do not have permission to give points.');
                    return;
                }

                const tokenId = Number(match![1]);
                const points = Number(match![2]);
                const chatId = msg.chat.id;
                const confirmMessage = `🎯 *Points Distribution*\n\n` +
                    `Are you sure you want to give *${points} points* to NFT holders of token ID *${tokenId}*?`;
                const opts = {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '✅ Confirm', callback_data: `confirm_points_${userId}_${tokenId}_${points}` },
                            { text: '❌ Cancel', callback_data: `cancel_points_${userId}` }
                        ]],
                        selective: true
                    },
                    parse_mode: 'Markdown' as const,
                    reply_to_message_id: msg.message_id
                };
                
                await bot.sendMessage(chatId, confirmMessage, opts);
            });
        };