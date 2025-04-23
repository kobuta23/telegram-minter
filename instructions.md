# Telegram NFT Minter Bot Instruction Manual

## Getting Started
- `/start` - Welcome message and introduction
- `/hello` - Register yourself with the bot

## User Token Management
- `/token <token_id>` - View details for a specific token
- `/token-minters` - View all registered user tokens
- `/mytoken <token_id>` - Set a token as your default

## Creating NFTs
1. `/create` - Start NFT creation process
2. Send an image (400x400 to 3000x3000 pixels, under 5MB)
3. Enter name (3-50 characters)
4. Enter description (10-500 characters)
5. Confirm creation

## Minting NFTs
- `/mint <address or ENS name>` - Mint your default NFT to an address
- `/mint <address or ENS name> <token_id>` - Mint a specific NFT (requires permission)

## Admin Commands
- `/admin` - Check admin status or become admin if none exist
- `/forceadmin <pin_code>` - Force admin access with security pin
- `/adminhelp` - View admin command help
- `/addadmin @username` - Add admin
- `/removeadmin @username` - Remove admin
- `/grantrole @username <role>` - Grant permission role
- `/revokerole @username <role>` - Revoke permission role
- `/listroles @username` - List user's roles

## Available Roles
- `mint` - Can mint their own NFTs
- `mint_any` - Can mint any NFT
- `create` - Can create NFTs
- `view_logs` - Can view audit logs
- `view_tokens` - Can view token details
- `admin` - Full admin access

## Token Information
- `/tokens` - View all tokens and their owners (requires permission)
- `/contract` - View contract address and network

## Miscellaneous
- `/points <token_id> <points>` - Give points to holders of a specific token (admin only)
- `/logs` - View audit logs (requires permission)

## Notes
- All images must be JPG, PNG, or WebP format
- Users must have appropriate permissions for certain actions
- ENS names can be used for minting destinations
