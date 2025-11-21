# Nium MCP Server - Usage Examples

This document provides practical examples of using the Nium MCP server through Claude or other MCP clients.

## Complete Customer Onboarding Workflow

### Step 1: Create a Customer
```
Using the Nium MCP server, create a new customer with these details:
- Name: Jane Smith
- Email: jane.smith@example.com
- Mobile: +6591234567
- Country: Singapore (SG)
- Date of Birth: 1985-03-15
- Address: 123 Orchard Road, Singapore, 238858
```

### Step 2: Submit KYC Documents
```
Submit KYC documents for the customer we just created:
- Document Type: PASSPORT
- Document Number: E1234567
- Issuing Country: SG
```

### Step 3: Create a Wallet
```
Create a USD wallet for this customer
```

### Step 4: Issue a Virtual Card
```
Issue a virtual card linked to the USD wallet
```

## Multi-Currency Payment Flow

### Example: USD to EUR Transfer with FX

```
I need to send 1000 USD to a EUR wallet. Can you:
1. Get me an FX quote for USD to EUR
2. Show me the expected EUR amount
3. Create the transfer
```

The MCP server will:
1. Call `get_fx_quote` with sourceCurrency=USD, destinationCurrency=EUR, amount=1000
2. Display the exchange rate and converted amount
3. Call `create_transfer` with the appropriate details

## Card Management Scenarios

### Lost Card Workflow
```
A customer reported their card as lost. The card ID is CARD789012.
Please block this card with reason "Lost card - customer reported"
```

### Card Activation
```
Activate the card with ID CARD456789 for customer CUST123456
```

## Transaction Monitoring

### List Recent Transactions
```
Show me all transfers for customer CUST123456 from the last 30 days
```

### Check Transfer Status
```
What's the status of transfer TXN987654?
```

## Wallet Management

### Multi-Currency Wallets
```
Create three wallets for customer CUST123456:
1. USD wallet
2. EUR wallet
3. SGD wallet

Then show me the balances of all wallets
```

## Compliance Checks

### Verify KYC Status
```
Check the KYC verification status for customer CUST123456
```

### Complete Customer Profile
```
Get the complete customer profile for CUST123456 including:
- Personal details
- All wallets and balances
- All issued cards
- KYC status
```

## Business Use Cases

### Remittance Platform
```
I'm building a remittance platform. Help me:
1. Create a sender customer in the US
2. Create a USD wallet for them
3. Get FX rates for USD to PHP (Philippine Peso)
4. Calculate fees and total cost for sending $500 to Philippines
```

### Expense Management System
```
For an expense management system:
1. Create a corporate customer
2. Issue 5 virtual cards for different employees
3. Set up USD, EUR, and GBP wallets
4. Show me how to track spending across all cards
```

### Digital Banking App
```
For a digital banking application:
1. Onboard a new customer with full KYC
2. Create a default checking wallet (USD)
3. Create a savings wallet (USD)
4. Issue a physical card for the checking wallet
5. Set up the customer profile dashboard
```

## Advanced Queries

### Reconciliation Report
```
Generate a reconciliation report for customer CUST123456:
- All transfers in December 2024
- Current balance in each wallet
- All card transactions
- Total inflow and outflow by currency
```

### Currency Exchange Analysis
```
Compare exchange rates for converting 10,000 USD to:
- EUR
- GBP
- SGD
- JPY

Show me which gives the best rate today
```

### Customer Support Scenarios
```
A customer CUST123456 is calling about a missing transfer:
1. Look up their recent transfers
2. Check the status of transfer TXN555666
3. Show their current wallet balances
4. Check if there are any failed transactions
```

## Testing Scenarios

### Sandbox Testing Flow
```
In sandbox mode, help me test the complete flow:
1. Create a test customer
2. Submit test KYC documents
3. Create a test wallet with 1000 USD
4. Issue a virtual test card
5. Simulate a transfer of 100 USD
6. Check all statuses
```

### Error Handling
```
Try to:
1. Create a transfer with insufficient funds
2. Activate an already active card
3. Get details of a non-existent customer

Show me how the server handles these errors
```

## Integration Examples

### Webhook Processing
```
When I receive a webhook notification that a transfer is completed:
1. Get the transfer details using the transferId
2. Update the customer's wallet balance
3. Send a confirmation notification
```

### Batch Operations
```
Process a batch of 10 transfers:
- Create transfers from the CSV data
- Track each transfer ID
- Generate a summary report of successful/failed transfers
```

## Best Practices

### Customer Onboarding
```
What's the recommended order for onboarding a customer?
Include all necessary API calls and validation steps.
```

### Security Checks
```
Before processing a large transfer (>10,000 USD):
1. Verify customer KYC status is approved
2. Check wallet balance
3. Get FX quote if cross-currency
4. Validate beneficiary details
5. Create the transfer
```

### Error Recovery
```
If a transfer fails:
1. Get the transfer details to see the error
2. Check wallet balance
3. Verify customer status
4. Suggest corrective actions
```

## Performance Optimization

### Bulk Customer Creation
```
I need to onboard 100 customers from a CSV file.
What's the most efficient way to do this using the Nium MCP server?
```

### Caching Strategy
```
For frequently accessed data like exchange rates:
- How often should I refresh?
- Which endpoints support caching?
- What's the rate limit?
```

## Troubleshooting Examples

### Authentication Issues
```
I'm getting authentication errors. Can you:
1. Verify my credentials are configured correctly
2. Check if the API key is valid
3. Test connectivity to the Nium API
```

### API Errors
```
I received error code 4001. What does this mean and how do I resolve it?
```

## Notes

- Replace customer IDs, wallet IDs, card IDs, and transfer IDs with actual values from your responses
- Always use sandbox credentials for testing
- Refer to the README.md for complete tool parameter specifications
- Check Nium's API documentation for the latest endpoint details and rate limits
