import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export enum Permission {
    MINT = 'mint',
    MINT_ANY = 'mint_any',
    CREATE = 'create',
    VIEW_LOGS = 'view_logs',
    VIEW_TOKENS = 'view_tokens',
    ADMIN = 'admin'
}

interface SecurityConfig {
    admins: number[];  // Telegram user IDs of admins
    whitelistedGroups: number[];  // Telegram group IDs that can use the bot
    whitelistedUsers: {
        userId: number;
        permissions: Permission[];
    }[];
    lastUpdated: string;
}

const CONFIG_FILE_PATH = path.join(__dirname, '../config.json');

export class SecurityManager {
    private static config: SecurityConfig = {
        admins: [],
        whitelistedGroups: [],
        whitelistedUsers: [],
        lastUpdated: new Date().toISOString()
    };

    static async loadConfig() {
        try {
            const data = await readFile(CONFIG_FILE_PATH, 'utf8');
            this.config = JSON.parse(data);
        } catch (error) {
            // If file doesn't exist, create it with default config
            await this.saveConfig();
        }
    }

    private static async saveConfig() {
        try {
            await writeFile(
                CONFIG_FILE_PATH,
                JSON.stringify(this.config, null, 2)
            );
        } catch (error) {
            console.error('Error saving security config:', error);
            throw error;
        }
    }

    static async addAdmin(userId: number) {
        if (!this.config.admins.includes(userId)) {
            this.config.admins.push(userId);
            this.config.lastUpdated = new Date().toISOString();
            await this.saveConfig();
        }
    }

    static async removeAdmin(userId: number) {
        this.config.admins = this.config.admins.filter(id => id !== userId);
        this.config.lastUpdated = new Date().toISOString();
        await this.saveConfig();
    }

    static async whitelistGroup(groupId: number) {
        if (!this.config.whitelistedGroups.includes(groupId)) {
            this.config.whitelistedGroups.push(groupId);
            this.config.lastUpdated = new Date().toISOString();
            await this.saveConfig();
        }
    }

    static async removeWhitelistedGroup(groupId: number) {
        this.config.whitelistedGroups = this.config.whitelistedGroups.filter(id => id !== groupId);
        this.config.lastUpdated = new Date().toISOString();
        await this.saveConfig();
    }

    static async whitelistUser(userId: number) {
        const userExists = this.config.whitelistedUsers.some(u => u.userId === userId);
        if (!userExists) {
            this.config.whitelistedUsers.push({ userId, permissions: [] });
            this.config.lastUpdated = new Date().toISOString();
            await this.saveConfig();
        }
    }

    static async removeWhitelistedUser(userId: number) {
        this.config.whitelistedUsers = this.config.whitelistedUsers.filter(u => u.userId !== userId);
        this.config.lastUpdated = new Date().toISOString();
        await this.saveConfig();
    }

    static isAdmin(userId: number): boolean {
        return this.config.admins.includes(userId);
    }

    static isWhitelisted(userId: number, chatId: number): boolean {
        return (
            this.isAdmin(userId) ||
            this.config.whitelistedUsers.some(u => u.userId === userId) ||
            this.config.whitelistedGroups.includes(chatId)
        );
    }

    static async whitelistUserWithPermissions(userId: number, permissions: Permission[]) {
        const existingUser = this.config.whitelistedUsers.find(u => u.userId === userId);
        if (existingUser) {
            existingUser.permissions = [...new Set([...existingUser.permissions, ...permissions])];
        } else {
            this.config.whitelistedUsers.push({ userId, permissions });
        }
        this.config.lastUpdated = new Date().toISOString();
        await this.saveConfig();
    }

    static hasPermission(userId: number, permission: Permission): boolean {
        if (this.isAdmin(userId)) return true;
        
        const user = this.config.whitelistedUsers.find(u => u.userId === userId);
        return user ? user.permissions.includes(permission) : false;
    }

    /**
     * Get all permissions for a given user
     * @param userId The Telegram user ID
     * @returns Array of permissions assigned to the user
     */
    public static async getPermissions(userId: number): Promise<Permission[]> {
        const userPermissions: Permission[] = [];
        
        // Check each permission type
        for (const permission of Object.values(Permission)) {
            if (await this.hasPermission(userId, permission)) {
                userPermissions.push(permission);
            }
        }
        
        return userPermissions;
    }
}