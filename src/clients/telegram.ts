import TelegramBot from 'node-telegram-bot-api';
import { BOT_TOKEN } from '../config/environment';
import { NFTPreview, TelegramBotTypes } from '../types/customTypes';

// Initialize Telegram Bot with offset  
export const bot = new TelegramBot(BOT_TOKEN, { 
    polling: {
        interval: 300,
        autoStart: true,
        params: {
            offset: -1,
            timeout: 30
        }
    }
}) as TelegramBot & { sendNFTPreview: TelegramBotTypes['sendNFTPreview'] };

// Add custom method
bot.sendNFTPreview = async function(options): Promise<TelegramBot.Message | boolean> {
    const { chatId, nft, editMessageId, replyToMessageId } = options;
    const caption = `📝 *NFT ${nft.tokenId ? `#${nft.tokenId}` : '**preview**'}*\n\n` +
      `${nft.name ? `Name: *${nft.name}*\n` : 'pending...'}` +
      `${nft.description ? `Description: *${nft.description}*\n` : 'pending...'}`;
  
    const photoOptions = {
      caption,
      parse_mode: 'Markdown' as const,
      reply_to_message_id: replyToMessageId
    };
  
    if (editMessageId && !nft.image) {
      return this.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: editMessageId,
        parse_mode: 'Markdown'
      });
    } else if (editMessageId && nft.image) {
      await this.deleteMessage(chatId, editMessageId.toString());
      return this.sendPhoto(chatId, nft.image, photoOptions);
    } else {
      return this.sendPhoto(chatId, nft.image || '', photoOptions);
    }
};

// Add error handling for polling errors
bot.on('polling_error', (error: any) => {
    console.error('Polling error:', error);
    bot.stopPolling().then(() => {
        bot.startPolling();
    });
});

// Add reconnection logic
bot.on('error', (error: any) => {
    console.error('Bot error:', error);
    if (typeof error === 'object' && error && 'code' in error) {
        if (error.code === 'ETELEGRAM') {
            bot.stopPolling().then(() => {
                setTimeout(() => {
                    bot.startPolling();
                }, 5000);
            });
        }
    }
}); 