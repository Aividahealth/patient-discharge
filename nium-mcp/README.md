# Nium MCP Server

A Model Context Protocol (MCP) server that provides seamless integration with Nium's payment and banking APIs. This server enables AI assistants like Claude to interact with Nium's comprehensive financial services platform.

## Features

This MCP server provides access to the following Nium API capabilities:

### Customer Management
- Create new customers
- Retrieve customer details
- Update customer information

### Wallet Management
- Create multi-currency wallets
- Get wallet details and balances
- List all customer wallets
- Support for default and savings wallets

### Payment & Transfers
- Create transfers between wallets
- External account transfers
- Track transfer status
- List transaction history

### Card Issuance
- Issue physical and virtual cards
- Activate cards
- Block/freeze cards
- Manage card lifecycle

### Foreign Exchange
- Get real-time FX quotes
- Fetch exchange rates
- Multi-currency support

### Compliance
- Submit KYC documents
- Check KYC verification status
- Compliance management

## Installation

1. Clone the repository and navigate to the nium-mcp directory:
```bash
cd nium-mcp
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file with your Nium API credentials:
```bash
cp .env.example .env
```

4. Edit `.env` and add your Nium credentials:
```env
NIUM_API_KEY=your_api_key_here
NIUM_CLIENT_ID=your_client_id_here
NIUM_CLIENT_SECRET=your_client_secret_here
NIUM_BASE_URL=https://api-sandbox.nium.com
NIUM_ENVIRONMENT=sandbox
```

5. Build the project:
```bash
npm run build
```

## Usage

### Running the MCP Server

Start the server using:
```bash
npm start
```

The server runs on stdio and communicates using the Model Context Protocol.

### Configuring with Claude Desktop

Add this server to your Claude Desktop configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nium": {
      "command": "node",
      "args": ["/absolute/path/to/nium-mcp/dist/index.js"],
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

### Using with Other MCP Clients

This server is compatible with any MCP client. Configure your client to run:
```bash
node /path/to/nium-mcp/dist/index.js
```

## Available Tools

### Customer Management

#### `create_customer`
Create a new customer in Nium.
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "mobile": "+1234567890",
  "countryCode": "US",
  "dateOfBirth": "1990-01-01",
  "nationality": "US",
  "address": {
    "addressLine1": "123 Main St",
    "city": "New York",
    "state": "NY",
    "country": "US",
    "postcode": "10001"
  }
}
```

#### `get_customer`
Retrieve customer details by ID.
```json
{
  "customerId": "CUST123456"
}
```

#### `update_customer`
Update customer information.
```json
{
  "customerId": "CUST123456",
  "updates": {
    "email": "newemail@example.com",
    "mobile": "+1987654321"
  }
}
```

### Wallet Management

#### `create_wallet`
Create a new wallet for a customer.
```json
{
  "customerId": "CUST123456",
  "currency": "USD",
  "walletType": "DEFAULT"
}
```

#### `get_wallet_balance`
Get current wallet balance.
```json
{
  "customerId": "CUST123456",
  "walletId": "WALLET123"
}
```

#### `list_wallets`
List all wallets for a customer.
```json
{
  "customerId": "CUST123456"
}
```

### Transfers

#### `create_transfer`
Create a money transfer.
```json
{
  "sourceWalletId": "WALLET123",
  "destinationWalletId": "WALLET456",
  "amount": 100.50,
  "currency": "USD",
  "purpose": "Payment for services",
  "remarks": "Invoice #12345"
}
```

#### `get_transfer`
Get transfer status and details.
```json
{
  "transferId": "TXN123456"
}
```

#### `list_transfers`
List customer transfers with optional filters.
```json
{
  "customerId": "CUST123456",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "status": "COMPLETED"
}
```

### Card Management

#### `issue_card`
Issue a new card.
```json
{
  "customerId": "CUST123456",
  "walletId": "WALLET123",
  "cardType": "VIRTUAL"
}
```

#### `activate_card`
Activate a card.
```json
{
  "customerId": "CUST123456",
  "cardId": "CARD123456"
}
```

#### `block_card`
Block/freeze a card.
```json
{
  "customerId": "CUST123456",
  "cardId": "CARD123456",
  "reason": "Lost card"
}
```

### Foreign Exchange

#### `get_fx_quote`
Get an FX quote for currency conversion.
```json
{
  "sourceCurrency": "USD",
  "destinationCurrency": "EUR",
  "amount": 1000,
  "amountType": "SOURCE"
}
```

#### `get_exchange_rates`
Get current exchange rates.
```json
{
  "baseCurrency": "USD"
}
```

### Compliance

#### `submit_kyc`
Submit KYC documents.
```json
{
  "customerId": "CUST123456",
  "documentType": "PASSPORT",
  "documentNumber": "AB123456",
  "documentCountry": "US"
}
```

#### `get_kyc_status`
Check KYC verification status.
```json
{
  "customerId": "CUST123456"
}
```

## API Authentication

The server handles authentication automatically using OAuth 2.0:
- Automatically requests and manages access tokens
- Refreshes tokens before expiry
- Includes API key in all requests

## Error Handling

All tools return responses in a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

## Development

### Project Structure
```
nium-mcp/
├── src/
│   ├── index.ts          # Main MCP server
│   ├── nium-client.ts    # Nium API client
│   └── types.ts          # TypeScript type definitions
├── dist/                 # Compiled JavaScript (generated)
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

### Building
```bash
npm run build
```

### Development Mode
Watch for changes and rebuild automatically:
```bash
npm run dev
```

## Environment Variables

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `NIUM_API_KEY` | Yes | Your Nium API key | - |
| `NIUM_CLIENT_ID` | Yes | OAuth client ID | - |
| `NIUM_CLIENT_SECRET` | Yes | OAuth client secret | - |
| `NIUM_BASE_URL` | No | Nium API base URL | `https://api.nium.com` |
| `NIUM_ENVIRONMENT` | No | Environment (sandbox/production) | `sandbox` |

## Security Best Practices

1. **Never commit credentials**: Keep your `.env` file out of version control
2. **Use sandbox for testing**: Always test with sandbox credentials first
3. **Rotate credentials regularly**: Update API keys and secrets periodically
4. **Monitor API usage**: Track API calls for unusual activity
5. **Implement rate limiting**: Respect Nium's API rate limits

## Nium Resources

- [Nium API Documentation](https://docs.nium.com/docs/reference/api-overview)
- [Nium Playbooks](https://playbook.nium.com/)
- [Nium Developer Portal](https://developer.nium.com/)

## Support

For issues related to:
- **This MCP server**: Open an issue in this repository
- **Nium API**: Contact Nium support or check their documentation
- **MCP Protocol**: See the [Model Context Protocol documentation](https://modelcontextprotocol.io/)

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Changelog

### Version 1.0.0
- Initial release
- Support for customer management
- Wallet operations
- Transfer/payment processing
- Card issuance and management
- Foreign exchange operations
- Compliance and KYC tools
