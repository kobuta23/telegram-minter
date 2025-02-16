import { bot } from '../clients/telegram';
import { SecurityManager, Permission } from '../config/security';
import { AuditLogger } from '../utils/auditLogger';
import { Message } from 'node-telegram-bot-api';
import { CallbackQuery } from 'node-telegram-bot-api';

export const initializeLogsHandler = () => {
    bot.onText(/\/logs/, async (msg: Message) => {
        const chatId = msg.chat.id;
        const userId = msg.from!.id;

        if (!SecurityManager.hasPermission(userId, Permission.VIEW_LOGS)) {
            await bot.sendMessage(chatId, 'You do not have permission to view logs.');
            return;
        }

        try {
            const logs = await AuditLogger.getLogs();
            const formattedLogs = logs
                .map(log => {
                    return `Action: ${log.action}\n` +
                           `User: ${log.username} (${log.userId})\n` +
                           `Chat: ${log.chatTitle || 'Private'} (${log.chatId})\n` +
                           `Time: ${new Date(log.timestamp).toLocaleString()}\n` +
                           `${log.token?.tokenId ? `TokenId: ${log.token.tokenId}\n` : ''}` +
                           `${log.token?.transactionHash ? `Tx: ${log.token.transactionHash}\n` : ''}\n`;
                })
                .join('---\n');

            await bot.sendMessage(chatId, formattedLogs || 'No logs found.');
        } catch (error) {
            console.error('Error fetching logs:', error);
            await bot.sendMessage(chatId, 'Error fetching logs.');
        }
    });

    // Handle "Show More" button clicks
    bot.on('callback_query', async (query: CallbackQuery) => {
        if (!query.data?.startsWith('show_more_logs_')) return;
        
        const chatId = query.message!.chat.id;
        const limit = parseInt(query.data.split('_').pop()!);
        const logs = await AuditLogger.getLogs();
        const lastLogs = logs.slice(-limit).reverse();

        const message = lastLogs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            let logMessage = `📝 ${timestamp}\n`;
            logMessage += `Action: ${log.action}\n`;
            logMessage += `User ID: ${log.userId}\n`;
            if (log.username) logMessage += `Username: ${log.username}\n`;
            if (log.token?.tokenId) logMessage += `Token ID: ${log.token.tokenId}\n`;
            if (log.token?.recipientAddress) logMessage += `Recipient: ${log.token.recipientAddress}\n`;
            if (log.token?.transactionHash) logMessage += `TX: ${log.token.transactionHash}\n`;
            return logMessage;
        }).join('\n');

        const opts = logs.length > limit ? {
            reply_markup: {
                inline_keyboard: [[
                    { text: 'Show More', callback_data: `show_more_logs_${limit + 5}` }
                ]]
            }
        } : undefined;

        // Edit the existing message instead of sending a new one
        bot.editMessageText(message, {
            chat_id: chatId,
            message_id: query.message!.message_id,
            reply_markup: opts?.reply_markup
        });
    });
};
