#!/usr/bin/env node

/**
 * Nium MCP Server
 * Model Context Protocol server for Nium payment and banking APIs
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { NiumClient } from './nium-client.js';
import type { NiumConfig } from './types.js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Validate required environment variables
const requiredEnvVars = [
  'NIUM_API_KEY',
  'NIUM_CLIENT_ID',
  'NIUM_CLIENT_SECRET',
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} is required but not set`);
    process.exit(1);
  }
}

// Initialize Nium configuration
const niumConfig: NiumConfig = {
  apiKey: process.env.NIUM_API_KEY!,
  clientId: process.env.NIUM_CLIENT_ID!,
  clientSecret: process.env.NIUM_CLIENT_SECRET!,
  baseUrl: process.env.NIUM_BASE_URL || 'https://api.nium.com',
  environment: (process.env.NIUM_ENVIRONMENT as 'sandbox' | 'production') || 'sandbox',
};

// Initialize Nium client
const niumClient = new NiumClient(niumConfig);

// Define available tools
const tools: Tool[] = [
  // Customer Management Tools
  {
    name: 'create_customer',
    description: 'Create a new customer in Nium. This is the first step in onboarding a customer for payment services.',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'Customer first name' },
        lastName: { type: 'string', description: 'Customer last name' },
        email: { type: 'string', description: 'Customer email address' },
        mobile: { type: 'string', description: 'Customer mobile number' },
        countryCode: { type: 'string', description: 'Two-letter country code (e.g., US, GB, SG)' },
        dateOfBirth: { type: 'string', description: 'Date of birth in YYYY-MM-DD format' },
        nationality: { type: 'string', description: 'Two-letter nationality code' },
        address: {
          type: 'object',
          properties: {
            addressLine1: { type: 'string' },
            addressLine2: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
            postcode: { type: 'string' },
          },
          required: ['addressLine1', 'city', 'country', 'postcode'],
        },
      },
      required: ['firstName', 'lastName', 'email', 'mobile', 'countryCode'],
    },
  },
  {
    name: 'get_customer',
    description: 'Retrieve customer details by customer ID',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Unique customer identifier' },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'update_customer',
    description: 'Update existing customer information',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Unique customer identifier' },
        updates: {
          type: 'object',
          description: 'Fields to update (email, mobile, address, etc.)',
        },
      },
      required: ['customerId', 'updates'],
    },
  },

  // Wallet Management Tools
  {
    name: 'create_wallet',
    description: 'Create a new wallet for a customer in a specific currency',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        currency: { type: 'string', description: 'Three-letter currency code (e.g., USD, EUR, SGD)' },
        walletType: {
          type: 'string',
          enum: ['DEFAULT', 'SAVINGS'],
          description: 'Type of wallet to create',
        },
      },
      required: ['customerId', 'currency'],
    },
  },
  {
    name: 'get_wallet',
    description: 'Get wallet details',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        walletId: { type: 'string', description: 'Wallet ID' },
      },
      required: ['customerId', 'walletId'],
    },
  },
  {
    name: 'get_wallet_balance',
    description: 'Get the current balance of a wallet',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        walletId: { type: 'string', description: 'Wallet ID' },
      },
      required: ['customerId', 'walletId'],
    },
  },
  {
    name: 'list_wallets',
    description: 'List all wallets for a customer',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
      },
      required: ['customerId'],
    },
  },

  // Transfer/Payment Tools
  {
    name: 'create_transfer',
    description: 'Create a money transfer between wallets or to external accounts',
    inputSchema: {
      type: 'object',
      properties: {
        sourceWalletId: { type: 'string', description: 'Source wallet ID' },
        destinationWalletId: { type: 'string', description: 'Destination wallet ID (for internal transfers)' },
        destinationAccount: {
          type: 'object',
          description: 'External account details (for external transfers)',
          properties: {
            accountNumber: { type: 'string' },
            routingNumber: { type: 'string' },
            accountType: { type: 'string' },
          },
        },
        amount: { type: 'number', description: 'Transfer amount' },
        currency: { type: 'string', description: 'Currency code' },
        purpose: { type: 'string', description: 'Transfer purpose' },
        remarks: { type: 'string', description: 'Additional remarks' },
      },
      required: ['sourceWalletId', 'amount', 'currency'],
    },
  },
  {
    name: 'get_transfer',
    description: 'Get transfer details and status',
    inputSchema: {
      type: 'object',
      properties: {
        transferId: { type: 'string', description: 'Transfer ID' },
      },
      required: ['transferId'],
    },
  },
  {
    name: 'list_transfers',
    description: 'List transfers for a customer with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        status: { type: 'string', description: 'Filter by status' },
      },
      required: ['customerId'],
    },
  },

  // Card Management Tools
  {
    name: 'issue_card',
    description: 'Issue a new physical or virtual card for a customer',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        walletId: { type: 'string', description: 'Wallet ID to link the card to' },
        cardType: {
          type: 'string',
          enum: ['PHYSICAL', 'VIRTUAL'],
          description: 'Type of card to issue',
        },
        cardProgram: { type: 'string', description: 'Card program name' },
        deliveryAddress: {
          type: 'object',
          description: 'Delivery address for physical cards',
          properties: {
            addressLine1: { type: 'string' },
            city: { type: 'string' },
            state: { type: 'string' },
            country: { type: 'string' },
            postcode: { type: 'string' },
          },
        },
      },
      required: ['customerId', 'walletId', 'cardType'],
    },
  },
  {
    name: 'get_card',
    description: 'Get card details',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        cardId: { type: 'string', description: 'Card ID' },
      },
      required: ['customerId', 'cardId'],
    },
  },
  {
    name: 'activate_card',
    description: 'Activate a card',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        cardId: { type: 'string', description: 'Card ID' },
      },
      required: ['customerId', 'cardId'],
    },
  },
  {
    name: 'block_card',
    description: 'Block/freeze a card',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        cardId: { type: 'string', description: 'Card ID' },
        reason: { type: 'string', description: 'Reason for blocking' },
      },
      required: ['customerId', 'cardId'],
    },
  },
  {
    name: 'list_cards',
    description: 'List all cards for a customer',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
      },
      required: ['customerId'],
    },
  },

  // Foreign Exchange Tools
  {
    name: 'get_fx_quote',
    description: 'Get a foreign exchange quote for currency conversion',
    inputSchema: {
      type: 'object',
      properties: {
        sourceCurrency: { type: 'string', description: 'Source currency code' },
        destinationCurrency: { type: 'string', description: 'Destination currency code' },
        amount: { type: 'number', description: 'Amount to convert' },
        amountType: {
          type: 'string',
          enum: ['SOURCE', 'DESTINATION'],
          description: 'Whether amount is in source or destination currency',
        },
      },
      required: ['sourceCurrency', 'destinationCurrency', 'amount'],
    },
  },
  {
    name: 'get_exchange_rates',
    description: 'Get current exchange rates for a base currency',
    inputSchema: {
      type: 'object',
      properties: {
        baseCurrency: { type: 'string', description: 'Base currency code (e.g., USD)' },
      },
      required: ['baseCurrency'],
    },
  },

  // Compliance Tools
  {
    name: 'submit_kyc',
    description: 'Submit KYC (Know Your Customer) documents for compliance verification',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
        documentType: {
          type: 'string',
          description: 'Type of document (e.g., PASSPORT, DRIVERS_LICENSE)',
        },
        documentNumber: { type: 'string', description: 'Document number' },
        documentCountry: { type: 'string', description: 'Issuing country code' },
      },
      required: ['customerId', 'documentType', 'documentNumber', 'documentCountry'],
    },
  },
  {
    name: 'get_kyc_status',
    description: 'Check the KYC verification status for a customer',
    inputSchema: {
      type: 'object',
      properties: {
        customerId: { type: 'string', description: 'Customer ID' },
      },
      required: ['customerId'],
    },
  },
];

// Create MCP server
const server = new Server(
  {
    name: 'nium-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (!args) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: { message: 'Missing arguments' },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    let result;

    switch (name) {
      // Customer Management
      case 'create_customer':
        result = await niumClient.createCustomer(args as any);
        break;
      case 'get_customer':
        result = await niumClient.getCustomer(args.customerId as string);
        break;
      case 'update_customer':
        result = await niumClient.updateCustomer(
          args.customerId as string,
          args.updates as any
        );
        break;

      // Wallet Management
      case 'create_wallet':
        result = await niumClient.createWallet(args as any);
        break;
      case 'get_wallet':
        result = await niumClient.getWallet(
          args.customerId as string,
          args.walletId as string
        );
        break;
      case 'get_wallet_balance':
        result = await niumClient.getWalletBalance(
          args.customerId as string,
          args.walletId as string
        );
        break;
      case 'list_wallets':
        result = await niumClient.listWallets(args.customerId as string);
        break;

      // Transfers
      case 'create_transfer':
        result = await niumClient.createTransfer(args as any);
        break;
      case 'get_transfer':
        result = await niumClient.getTransfer(args.transferId as string);
        break;
      case 'list_transfers':
        result = await niumClient.listTransfers(args.customerId as string, {
          startDate: args.startDate as string | undefined,
          endDate: args.endDate as string | undefined,
          status: args.status as string | undefined,
        });
        break;

      // Cards
      case 'issue_card':
        result = await niumClient.issueCard(args as any);
        break;
      case 'get_card':
        result = await niumClient.getCard(
          args.customerId as string,
          args.cardId as string
        );
        break;
      case 'activate_card':
        result = await niumClient.activateCard(
          args.customerId as string,
          args.cardId as string
        );
        break;
      case 'block_card':
        result = await niumClient.blockCard(
          args.customerId as string,
          args.cardId as string,
          args.reason as string | undefined
        );
        break;
      case 'list_cards':
        result = await niumClient.listCards(args.customerId as string);
        break;

      // Foreign Exchange
      case 'get_fx_quote':
        result = await niumClient.getFXQuote(args as any);
        break;
      case 'get_exchange_rates':
        result = await niumClient.getExchangeRates(args.baseCurrency as string);
        break;

      // Compliance
      case 'submit_kyc':
        result = await niumClient.submitKYC(args.customerId as string, args as any);
        break;
      case 'get_kyc_status':
        result = await niumClient.getKYCStatus(args.customerId as string);
        break;

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: {
                message: error instanceof Error ? error.message : String(error),
              },
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Nium MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
