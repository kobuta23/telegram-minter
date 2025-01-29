import { bot } from '../clients/telegram';
import { SecurityManager, Permission } from '../config/security';
import { publicClient, CONTRACT_ADDRESS, nftAbi } from '../clients/blockchain';

export const initializeTokensHandler = () => {
    bot.onText(/\/tokens/, async (msg) => {
        const chatId = msg.chat.id;
        const userId = msg.from!.id;

        if (!SecurityManager.hasPermission(userId, Permission.VIEW_TOKENS)) {
            await bot.sendMessage(chatId, 'You do not have permission to view tokens.');
            return;
        }

        try {
            const totalSupply = await publicClient.readContract({
                address: CONTRACT_ADDRESS as `0x${string}`,
                abi: nftAbi,
                functionName: 'totalSupply'
            });

            let tokenList = 'Token List:\n\n';
            for (let i = 0; i < Number(totalSupply); i++) {
                const owner = await publicClient.readContract({
                    address: CONTRACT_ADDRESS as `0x${string}`,
                    abi: nftAbi,
                    functionName: 'ownerOf',
                    args: [BigInt(i)]
                });
                
                tokenList += `Token ID: ${i}\nOwner: ${owner}\n---\n`;
            }

            await bot.sendMessage(chatId, tokenList);
        } catch (error) {
            console.error('Error fetching tokens:', error);
            await bot.sendMessage(chatId, 'Error fetching token information.');
        }
    });
}; 