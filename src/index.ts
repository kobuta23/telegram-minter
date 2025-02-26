import { account } from './clients/blockchain';
import { SecurityManager } from './config/security';
import { initializeStartHandler } from './handlers/startHandler';
import { initializeCreateHandler } from './handlers/createHandler';
import { initializeMintHandler } from './handlers/mintHandler';
import { initializeLogsHandler } from './handlers/logsHandler';
import { initializeTokensHandler } from './handlers/tokensHandler';
import { initializeAdminHandler } from './handlers/adminHandler';
import { initializeUserTokenHandler } from './handlers/userTokenHandler';
import { ADMIN_ID } from './config/environment';

async function main() {
    // Initialize security
    await SecurityManager.loadConfig();

    console.log('BOT address:', account.address);

    // Initialize handlers
    initializeStartHandler();
    initializeCreateHandler();
    initializeMintHandler();
    initializeLogsHandler();
    initializeTokensHandler();
    initializeAdminHandler();
    initializeUserTokenHandler();

    // add admin to the bot
    SecurityManager.addAdmin(ADMIN_ID);

    console.log('Bot started!');
}

main().catch(console.error);