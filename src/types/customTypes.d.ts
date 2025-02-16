import TelegramBot from 'node-telegram-bot-api';

export interface NFTPreview {
    image?: Buffer | string;
    name?: string;
    description?: string;
    tokenId?: number;
}

export interface TelegramBotTypes {
    sendNFTPreview(options: {
        chatId: number | string;
        nft: NFTPreview;
        replyToMessageId?: number;
        editMessageId?: number;
    }): Promise<TelegramBot.Message | boolean>;
}
export type SendNFTPreviewOptions = TelegramBotTypes['sendNFTPreview'];

export {};
  