import { bot } from '../clients/telegram';
import { userTokenMap } from '../storage/userTokens';
import { publicClient } from '../clients/blockchain';
import { CONTRACT_ADDRESS } from '../config/environment';
import { nftAbi } from '../clients/blockchain';
import { saveUser } from '../storage/users';
import { Message } from 'node-telegram-bot-api';
import { CallbackQuery } from 'node-telegram-bot-api';
export const initializeTokenHandler = () => {

    bot.onText(/\/token (\d+)/, async (msg: Message, match: Array<string | number> | null) => {
        saveUser(msg);

        console.log("token handler, match:", match);
        if (!match) return;
        
        const tokenId = BigInt(match[1]);
        
        try {
            // Get token URI
            const tokenUri = await publicClient.readContract({
                address: CONTRACT_ADDRESS,
                abi: nftAbi,
                functionName: 'uri',
                args: [tokenId]
            });

            if (!tokenUri) {
                bot.sendMessage(msg.chat.id, `Token #${tokenId} does not exist.`);
                return;
            }
            console.log(tokenUri);
            // Convert ipfs:// to https://
            const httpUrl = tokenUri.toString().replace('ipfs://', 'https://ipfs.io/ipfs/');

            // Fetch metadata
            const response = await fetch(httpUrl);
            const metadata = await response.json();

            // Convert image IPFS url to HTTP
            const imageUrl = metadata.image.replace('ipfs://', 'https://ipfs.io/ipfs/');

            // Send image with caption containing name and description
            const caption = `🎨 *Token #${tokenId}*\n\n` +
                          `*Name:* ${metadata.name}\n` +
                          `*Description:* ${metadata.description}`;

            await bot.sendPhoto(msg.chat.id, imageUrl, {
                caption: caption,
                parse_mode: 'Markdown'
            });

        } catch (error) {
            console.error('Error fetching token details:', error);
            bot.sendMessage(msg.chat.id, 'Sorry, there was an error fetching the token details. Please try again.');
        }
    });
    
    bot.onText(/\/token-minters/, async (msg: Message) => {
        saveUser(msg);
        console.log("tokens handler, msg:", msg);
        try {
            // First show registered tokens
            let message = "🎨 Registered User Tokens:\n\n";
            
            console.log(userTokenMap);

            for (const [userId, tokenId] of Object.entries(userTokenMap)) {
                try {
                    // Get user info from Telegram
                    const chatMember = await bot.getChatMember(msg.chat.id, userId);
                    const username = chatMember.user.username || chatMember.user.first_name;
                    message += `@${username}: Token #${tokenId}\n`;
                } catch (e) {
                    message += `User ${userId}: Token #${tokenId}\n`;
                }
            }

            // Add button to see all tokens
            const opts = {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🔍 See All Tokens', callback_data: 'see_all_tokens' }
                    ]]
                }
            };

            bot.sendMessage(msg.chat.id, message, opts);

            // Handle callback for seeing all tokens
            bot.on('callback_query', async (callbackQuery: CallbackQuery) => {
                if (callbackQuery.data === 'see_all_tokens') {
                    let allTokensMessage = "🌟 All Existing Tokens:\n\n";
                    let tokenId = 1n;

                    while (true) {
                        console.log("tokenId:", tokenId);
                        try {
                            // Try to get token URI for current ID
                            await publicClient.readContract({
                                address: CONTRACT_ADDRESS,
                                abi: nftAbi,
                                functionName: 'uri',
                                args: [tokenId]
                            }) as string;

                            allTokensMessage += `Token #${tokenId}\n`;
                            tokenId += 1n;
                            
                        } catch (e) {
                            console.log("Looks like we've reached the end of the tokens:", tokenId)
                            break;
                        }
                    }

                    if (tokenId === 1n) {
                        allTokensMessage += "No tokens found!";
                    }

                    bot.answerCallbackQuery(callbackQuery.id);
                    bot.sendMessage(msg.chat.id, allTokensMessage);
                }
            });

        } catch (error) {
            console.error('Error in token enumeration:', error);
            bot.sendMessage(msg.chat.id, 'Sorry, there was an error listing the tokens. Please try again.');
        }
    });

    bot.onText(/\/mytoken (\d+)/, async (msg: Message, match: Array<string | number> | null) => {
        saveUser(msg);
        console.log("mytoken handler, match:", match);
        if (!match) return;

        // check if the user has a token in their userTokenMap
        if (userTokenMap[msg.from!.id]) {
            bot.sendMessage(msg.chat.id, `Token #${userTokenMap[msg.from!.id]} is your current default token.`);
        }

        const tokenId = Number(match[1]);
        // add tokenid to userTokenMap
        userTokenMap[msg.from!.id] = tokenId;
        bot.sendMessage(msg.chat.id, `Token #${tokenId} is now your default token.`);
    });
};
