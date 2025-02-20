import { bot } from '../clients/telegram';
import { SecurityManager, Permission } from '../config/security';
import { AuditLogger } from '../utils/auditLogger';
import { getUserByUsername } from '../storage/users';
import { Message } from 'node-telegram-bot-api';

export const initializeAdminHandler = () => {
    // Help command for admins
    bot.onText(/\/adminhelp/, async (msg: Message) => {
        const userId = msg.from!.id;
        
        if (!SecurityManager.hasPermission(userId, Permission.ADMIN)) {
            console.log('User does not have admin permissions');
            console.log('User permission check:', SecurityManager.hasPermission(userId, Permission.ADMIN));
            await bot.sendMessage(msg.chat.id, 'You do not have admin permissions.');
            return;
        }

        const helpText = `
Admin Commands:
/addadmin @username - Add a new admin
/removeadmin @username - Remove an admin
/grantrole @username <role> - Grant a role to user
/revokerole @username <role> - Revoke a role from user
/listroles @username - List roles for a user

Available Roles:
- mint: Can mint NFTs
- mint_any: Can mint any NFT
- create: Can create NFTs
- view_logs: Can view audit logs
- view_tokens: Can view token details
- admin: Full admin access

Example:
/grantrole @alice mint_any
`;
        await bot.sendMessage(msg.chat.id, helpText);
    });
    // Add admin command
    bot.onText(/\/addadmin (@\w+)/, async (msg: Message, match: Array<string | number> | null) => {
        const userId = msg.from!.id;
        console.log(match);
        const targetHandle = match![1];
        
        if (!SecurityManager.hasPermission(userId, Permission.ADMIN)) {
            await bot.sendMessage(msg.chat.id, 'You do not have permission to add admins.');
            return;
        }

        try {
            console.log('fetching ID of: ', targetHandle);
            const chatMember = getUserByUsername(targetHandle as string);
            if (!chatMember?.id) {
                await bot.sendMessage(msg.chat.id, `Failed to find user. Say /hello ${targetHandle}`);
                return;
            }
            console.log('ID of: ', chatMember?.id);
            await SecurityManager.addAdmin(chatMember?.id);
            
            await AuditLogger.logHelper(msg, {
                action: 'admin',            
                admin: {
                    targetUser: targetHandle,
                    targetUserId: chatMember.id
                }
            });

            await bot.sendMessage(msg.chat.id, `Successfully added ${targetHandle} as admin.`);
        } catch (error) {
            await bot.sendMessage(msg.chat.id, `Failed to add admin. Make sure the username is correct and the user is in this chat.`);
        }
    });

    // Remove admin command
    bot.onText(/\/removeadmin (@\w+)/, async (msg: Message, match: Array<string | number> | null) => {
        const userId = msg.from!.id;
        const targetHandle = match![1];
        
        if (!SecurityManager.hasPermission(userId, Permission.ADMIN)) {
            await bot.sendMessage(msg.chat.id, 'You do not have permission to remove admins.');
            return;
        }

        try {
            const chatMember = getUserByUsername(targetHandle as string);
            if (!chatMember?.id) {
                await bot.sendMessage(msg.chat.id, `Failed to find user. Say /hello ${targetHandle}`);
                return;
            }
            await SecurityManager.removeAdmin(chatMember?.id);
            
            await AuditLogger.logHelper(msg, {
                action: 'admin',
                admin: {
                    targetUser: targetHandle,
                    targetUserId: chatMember.id
                }
            });

            await bot.sendMessage(msg.chat.id, `Successfully removed ${targetHandle} from admins.`);
        } catch (error) {
            await bot.sendMessage(msg.chat.id, `Failed to remove admin. Make sure the username is correct.`);
        }
    });

    // Grant role command
    bot.onText(/\/grantrole (@\w+) (\w+)/, async (msg: Message, match: Array<string | number> | null) => {
        const userId = msg.from!.id;
        const targetHandle = match![1];
        const role = match![2] as Permission;
        
        if (!SecurityManager.hasPermission(userId, Permission.ADMIN)) {
            await bot.sendMessage(msg.chat.id, 'You do not have permission to grant roles.');
            return;
        }

        if (!Object.values(Permission).includes(role)) {
            await bot.sendMessage(msg.chat.id, `Invalid role. Use /adminhelp to see available roles.`);
            return;
        }

        try {
            const chatMember = getUserByUsername(targetHandle as string);
            if (!chatMember?.id) {
                await bot.sendMessage(msg.chat.id, `Failed to find user. Say /hello ${targetHandle}`);
                return;
            }
            await SecurityManager.whitelistUserWithPermissions(chatMember.id, [role]);
            
            await AuditLogger.logHelper(msg, {
                action: 'admin',            
                admin: {
                    targetUser: targetHandle,
                    targetUserId: chatMember.id,
                    role
                }
            });

            await bot.sendMessage(msg.chat.id, `Successfully granted ${role} role to ${targetHandle}.`);
        } catch (error) {
            await bot.sendMessage(msg.chat.id, `Failed to grant role. Make sure the username is correct.`);
        }
    });

    // List roles command
    bot.onText(/\/listroles (@\w+)/, async (msg: Message, match: Array<string | number> | null) => {
        const userId = msg.from!.id;
        const targetHandle = match![1];
        
        if (!SecurityManager.hasPermission(userId, Permission.ADMIN)) {
            await bot.sendMessage(msg.chat.id, 'You do not have permission to view roles.');
            return;
        }

        try {
            const chatMember = getUserByUsername(targetHandle as string);
            if (!chatMember?.id) {
                await bot.sendMessage(msg.chat.id, `Failed to find user. Say /hello ${targetHandle}`);
                return;
            }
            const roles = await SecurityManager.getPermissions(chatMember.id);
            
            const roleList = roles.length > 0 ? roles.join(', ') : 'No roles assigned';
            await bot.sendMessage(msg.chat.id, `Roles for ${targetHandle}:\n${roleList}`);
        } catch (error) {
            await bot.sendMessage(msg.chat.id, `Failed to list roles. Make sure the username is correct.`);
        }
    });
};
