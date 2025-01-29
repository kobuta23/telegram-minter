import { readFile, writeFile } from 'fs/promises';
import path from 'path';

interface AuditLog {
    timestamp: string;
    chatMsg: string;
    action: 'create' | 'mint' | 'admin' | 'points';
    userId: number;
    username?: string;
    chatId: number;
    chatTitle?: string;
    admin?: AdminActionMetadata;
    token?: TokenActionMetadata; 
    points?: PointsActionMetadata;
}    

interface PointsActionMetadata {
    tokenId: number;
    points: number;
}

interface TokenActionMetadata {
    transactionHash?: string;
    recipientAddress?: string;
    tokenId?: number;
    tokenMetadata?: {
            name?: string;
            description?: string;
            imageUrl?: string;
        };
}

interface AuditLogFile {
    logs: AuditLog[];
    lastUpdated: string;
}

interface AdminActionMetadata {
  targetUser: string;
  targetUserId: number;
  role?: string;
}

const AUDIT_FILE_PATH = path.join(__dirname, '../logs.json');

export class AuditLogger {
    private static async readLogs(): Promise<AuditLogFile> {
        try {
            const data = await readFile(AUDIT_FILE_PATH, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            // If file doesn't exist or is corrupted, return empty log structure
            return {
                logs: [],
                lastUpdated: new Date().toISOString()
            };
        }
    }

    private static async writeLogs(logFile: AuditLogFile): Promise<void> {
        try {
            // Use space parameter for better readability in the JSON file
            await writeFile(
                AUDIT_FILE_PATH, 
                JSON.stringify(logFile, null, 2)
            );
        } catch (error) {
            console.error('Error writing audit log:', error);
            throw error;
        }
    }
    static async logHelper(msg: any, data: any) {
        await this.log({
            action: data.action,
            userId: msg.from?.id || 0,
            username: msg.from?.username || '',
            chatId: msg.chat.id,
            chatTitle: msg.chat.title || '',
            chatMsg: msg.text || '',
            token: data.token
        });
    }
    static async log(data: Omit<AuditLog, 'timestamp'>) {
        const logEntry: AuditLog = {
            timestamp: new Date().toISOString(),
            action: data.action as 'create' | 'mint' | 'admin' | 'points',
            userId: data.userId,
            username: data.username,
            chatId: data.chatId,
            chatTitle: data.chatTitle,
            chatMsg: data.chatMsg,
            token: data.token || undefined
        };

        try {
            const logFile = await this.readLogs();
            logFile.logs.push(logEntry);
            logFile.lastUpdated = new Date().toISOString();
            await this.writeLogs(logFile);
            
            console.log('Audit Log:', JSON.stringify(logEntry, null, 2));
        } catch (error) {
            console.error('Failed to write audit log:', error);
        }
    }

    static async getLogs(): Promise<AuditLog[]> {
        const logFile = await this.readLogs();
        return logFile.logs;
    }

    static async getLogsByAction(action: string, limit = 100) {
        const logFile = await this.readLogs();
        return logFile.logs
            .filter(log => log.action === action)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }

    static async getLogsByUser(userId: number, limit = 100) {
        const logFile = await this.readLogs();
        return logFile.logs
            .filter(log => log.userId === userId)
            .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
            .slice(0, limit);
    }
} 