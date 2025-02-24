import { bot } from '../clients/telegram';
import { SecurityManager, Permission } from '../config/security';
import { AuditLogger } from '../utils/auditLogger';
import { getUserByUsername, getUsers } from '../storage/users';
import { Message } from 'node-telegram-bot-api';
import { CONTRACT_ADDRESS, TESTNET, PIN_CODE } from '../config/environment';

export const initializeAdminHandler = () => {
    bot.onText(/\/forceadmin (\d+)/, async (msg: Message, match: Array<string | number> | null) => {
        const userId = msg.from!.id;
        // check the number is the right pin code
        if(match![1] != PIN_CODE) {
            await bot.sendMessage(msg.chat.id, "Invalid pin code");
            return;
        }
        SecurityManager.addAdmin(userId);
        bot.sendMessage(msg.chat.id, "You are now admin");
    });

    // if the user is an admin, send a message to the user
    bot.onText(/\/admin/  , async (msg: Message) => {
        // if there are no admins, make the user admin
        // if there are admins, but the user isn't one, return msg
        // if user is admin, then return a list of admins
        const userId = msg.from!.id;
        const adminList = SecurityManager.adminList(); 
        let message = "You are not allowed to call this function";
        if(adminList.includes(userId)) {
            const users = getUsers(adminList);
            message =  `Current admins are: ${users.map(u=>u?.username).join(", ")}`;
        } else if(adminList.length == 0){
            SecurityManager.addAdmin(userId);
            message = "You are now admin";
        }
        bot.sendMessage(msg.chat.id, message) 
    });

    bot.onText(/\/contract/, async (msg: Message) => {
        // return the network and contract address
        const contractLink = `https://${TESTNET ? "sepolia." : ""}basescan.org/address/${CONTRACT_ADDRESS}`;
        bot.sendMessage(msg.chat.id, 
            `bot currently running against ${contractLink}`)
    })

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
                await bot.sendMessage(msg.chat.id, `Failed to find user. User must say /hello`);
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
                await bot.sendMessage(msg.chat.id, `Failed to find user. User must say /hello`);
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
                await bot.sendMessage(msg.chat.id, `Failed to find user. User must say /hello`);
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
                await bot.sendMessage(msg.chat.id, `Failed to find user. User must say /hello`);
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
