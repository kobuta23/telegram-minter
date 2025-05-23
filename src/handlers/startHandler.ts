import { bot } from '../clients/telegram';
import { saveUser } from '../storage/users';
import { Message } from 'node-telegram-bot-api';

export const initializeStartHandler = () => {
    bot.onText(/\/start/, async (msg: Message) => {
        bot.sendMessage(msg.chat.id, 'Welcome to the GroupChat NFT creator! Use /create to create an NFT.');
        bot.sendMessage(msg.chat.id, 'After your NFT is created, use /mint <address | ens-name> to mint an NFT to someone else.');
        bot.sendMessage(msg.chat.id, 'You can also use /mint <address | ens-name> <token-id> to mint an NFT to someone else with a specific token ID.');
        saveUser(msg);
    });

    bot.onText(/\/hello/, async (msg: Message) => {
        bot.sendMessage(msg.chat.id, 'Hello!');
        // Save user ID to local storage
        saveUser(msg);
    });
}; 
