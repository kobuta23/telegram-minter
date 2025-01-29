import TelegramBot from 'node-telegram-bot-api';
import { BOT_TOKEN } from '../config/environment';

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
});

// Add error handling for polling errors
bot.on('polling_error', (error) => {
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