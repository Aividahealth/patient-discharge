# Nium MCP Server - Quick Start Guide

Get up and running with the Nium MCP server in 5 minutes!

## Prerequisites

- Node.js 18 or higher
- npm or yarn
- Nium API credentials (API key, Client ID, Client Secret)

## Setup Steps

### 1. Install Dependencies

```bash
cd nium-mcp
npm install
```

### 2. Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your Nium credentials:
```env
NIUM_API_KEY=your_api_key_here
NIUM_CLIENT_ID=your_client_id_here
NIUM_CLIENT_SECRET=your_client_secret_here
NIUM_BASE_URL=https://api-sandbox.nium.com
NIUM_ENVIRONMENT=sandbox
```

**Important**: Use sandbox credentials for testing!

### 3. Build the Project

```bash
npm run build
```

### 4. Test the Server

Test that the server starts correctly:
```bash
npm start
```

You should see: `Nium MCP Server running on stdio`

Press Ctrl+C to stop the server.

## Using with Claude Desktop

### 1. Locate Your Config File

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`
**Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Add Nium Server Configuration

Open the config file and add:

```json
{
  "mcpServers": {
    "nium": {
      "command": "node",
      "args": ["/ABSOLUTE/PATH/TO/nium-mcp/dist/index.js"],
      "env": {
        "NIUM_API_KEY": "your_api_key",
        "NIUM_CLIENT_ID": "your_client_id",
        "NIUM_CLIENT_SECRET": "your_client_secret",
        "NIUM_BASE_URL": "https://api-sandbox.nium.com",
        "NIUM_ENVIRONMENT": "sandbox"
      }
    }
  }
}
```

**Replace `/ABSOLUTE/PATH/TO/` with the actual path to your nium-mcp directory!**

To get the absolute path:
```bash
cd nium-mcp
pwd
```

### 3. Restart Claude Desktop

Quit Claude Desktop completely and restart it.

### 4. Verify Installation

In Claude Desktop, try asking:
```
List the available Nium tools
```

You should see all 22 tools listed!

## First API Call

Let's create a test customer:

```
Using the Nium MCP server, create a test customer:
- First name: Test
- Last name: User
- Email: test@example.com
- Mobile: +6591234567
- Country code: SG
```

Claude will use the `create_customer` tool and show you the response!

## Common Issues

### "Command not found" Error
- Make sure you used the absolute path to `dist/index.js`
- Verify the file exists: `ls /path/to/nium-mcp/dist/index.js`

### "Authentication failed" Error
- Double-check your API credentials in the config
- Ensure you're using sandbox credentials for testing
- Verify credentials are correct in your Nium dashboard

### "Module not found" Error
- Run `npm install` again in the nium-mcp directory
- Make sure the build completed: check that `dist/` directory exists

### Server Not Showing in Claude
- Verify your config file syntax is valid JSON
- Restart Claude Desktop completely (not just close the window)
- Check Claude's logs for error messages

## Next Steps

1. **Read the Examples**: Check `EXAMPLES.md` for practical usage examples
2. **Review the API**: See `README.md` for complete API documentation
3. **Test Workflows**: Try the complete customer onboarding flow
4. **Explore Tools**: Experiment with different Nium API capabilities

## Available Tools Overview

The server provides 22 tools across 6 categories:

### Customer Management (3 tools)
- create_customer, get_customer, update_customer

### Wallet Management (4 tools)
- create_wallet, get_wallet, get_wallet_balance, list_wallets

### Transfers (3 tools)
- create_transfer, get_transfer, list_transfers

### Card Management (5 tools)
- issue_card, get_card, activate_card, block_card, list_cards

### Foreign Exchange (2 tools)
- get_fx_quote, get_exchange_rates

### Compliance (2 tools)
- submit_kyc, get_kyc_status

## Getting Help

- **Server Issues**: Check the README.md troubleshooting section
- **Nium API Questions**: Visit https://docs.nium.com
- **MCP Protocol**: See https://modelcontextprotocol.io
- **Claude Desktop**: Check Anthropic's documentation

## Security Reminder

⚠️ **Never commit your `.env` file or share your API credentials!**

The `.gitignore` file is already configured to exclude sensitive files.

---

Happy building with Nium! 🚀
