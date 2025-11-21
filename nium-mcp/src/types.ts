/**
 * Nium MCP Server Types
 */

export interface NiumConfig {
  apiKey: string;
  clientId: string;
  clientSecret: string;
  baseUrl: string;
  environment: 'sandbox' | 'production';
}

export interface CustomerRequest {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  countryCode: string;
  dateOfBirth?: string;
  nationality?: string;
  address?: {
    addressLine1: string;
    addressLine2?: string;
    city: string;
    state?: string;
    country: string;
    postcode: string;
  };
}

export interface WalletRequest {
  customerId: string;
  currency: string;
  walletType?: 'DEFAULT' | 'SAVINGS';
}

export interface TransferRequest {
  sourceWalletId: string;
  destinationWalletId?: string;
  destinationAccount?: {
    accountNumber: string;
    routingNumber: string;
    accountType: string;
  };
  amount: number;
  currency: string;
  purpose?: string;
  remarks?: string;
}

export interface CardRequest {
  customerId: string;
  walletId: string;
  cardType: 'PHYSICAL' | 'VIRTUAL';
  cardProgram?: string;
  deliveryAddress?: {
    addressLine1: string;
    city: string;
    state: string;
    country: string;
    postcode: string;
  };
}

export interface FXQuoteRequest {
  sourceCurrency: string;
  destinationCurrency: string;
  amount: number;
  amountType?: 'SOURCE' | 'DESTINATION';
}

export interface ComplianceCheckRequest {
  customerId: string;
  documentType: string;
  documentNumber: string;
  documentCountry: string;
}

export interface NiumResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
