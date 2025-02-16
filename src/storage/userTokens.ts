import fs from 'fs';
import path from 'path';

const DB_PATH = path.join(__dirname, '../userTokens.json');

export let userTokenMap: Record<number, number> = {};

// Load existing mapping if file exists
try {
    if (fs.existsSync(DB_PATH)) {
        const data = fs.readFileSync(DB_PATH, 'utf8');
        userTokenMap = JSON.parse(data);
    } else {
        fs.writeFileSync(DB_PATH, JSON.stringify({}));
    }
} catch (error) {
    console.error('Error loading user-token mapping:', error);
}

export const updateUserToken = (userId: number, tokenId: number) => {
    userTokenMap[userId] = tokenId;
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(userTokenMap, null, 2));
    } catch (error) {
        console.error('Error saving user-token mapping:', error);
    }
};

// Store pending NFT creations
export const pendingNFTs = new Map<number, {
    image?: Buffer,
    name?: string,
    description?: string,
    previewMessageId?: number,
    instructionMessageId?: number
}>(); 