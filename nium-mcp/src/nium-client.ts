/**
 * Nium API Client
 * Handles authentication and API communication with Nium services
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import type {
  NiumConfig,
  CustomerRequest,
  WalletRequest,
  TransferRequest,
  CardRequest,
  FXQuoteRequest,
  ComplianceCheckRequest,
  NiumResponse
} from './types.js';

export class NiumClient {
  private axiosInstance: AxiosInstance;
  private config: NiumConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: NiumConfig) {
    this.config = config;
    this.axiosInstance = axios.create({
      baseURL: config.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for authentication
    this.axiosInstance.interceptors.request.use(async (config) => {
      await this.ensureValidToken();
      if (this.accessToken) {
        config.headers.Authorization = `Bearer ${this.accessToken}`;
      }
      config.headers['x-api-key'] = this.config.apiKey;
      return config;
    });
  }

  /**
   * Ensure we have a valid access token
   */
  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return;
    }

    try {
      const response = await axios.post(
        `${this.config.baseUrl}/api/v1/client/token`,
        {
          clientId: this.config.clientId,
          clientSecret: this.config.clientSecret,
        },
        {
          headers: {
            'x-api-key': this.config.apiKey,
          },
        }
      );

      this.accessToken = response.data.access_token;
      // Set expiry to 5 minutes before actual expiry for safety
      const expiresIn = response.data.expires_in || 3600;
      this.tokenExpiry = new Date(Date.now() + (expiresIn - 300) * 1000);
    } catch (error) {
      throw new Error(`Failed to authenticate with Nium: ${this.getErrorMessage(error)}`);
    }
  }

  /**
   * Handle API errors
   */
  private handleError<T>(error: unknown): NiumResponse<T> {
    const message = this.getErrorMessage(error);
    const code = (error as AxiosError)?.response?.status?.toString() || 'UNKNOWN';

    return {
      success: false,
      error: {
        code,
        message,
      },
    };
  }

  /**
   * Extract error message from various error types
   */
  private getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.message || error.message;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return String(error);
  }

  /**
   * Customer APIs
   */
  async createCustomer(customer: CustomerRequest): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post('/api/v2/client/customer', customer);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCustomer(customerId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(`/api/v2/client/customer/${customerId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async updateCustomer(customerId: string, updates: Partial<CustomerRequest>): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.patch(
        `/api/v2/client/customer/${customerId}`,
        updates
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Wallet APIs
   */
  async createWallet(wallet: WalletRequest): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v2/client/customer/${wallet.customerId}/wallet`,
        {
          currency: wallet.currency,
          walletType: wallet.walletType || 'DEFAULT',
        }
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getWallet(customerId: string, walletId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/wallet/${walletId}`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getWalletBalance(customerId: string, walletId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/wallet/${walletId}/balance`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listWallets(customerId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/wallets`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Transfer/Payment APIs
   */
  async createTransfer(transfer: TransferRequest): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post('/api/v2/client/transfer', transfer);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTransfer(transferId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(`/api/v2/client/transfer/${transferId}`);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listTransfers(customerId: string, params?: {
    startDate?: string;
    endDate?: string;
    status?: string;
  }): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/transfers`,
        { params }
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Card APIs
   */
  async issueCard(card: CardRequest): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v2/client/customer/${card.customerId}/card`,
        card
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getCard(customerId: string, cardId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/card/${cardId}`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async activateCard(customerId: string, cardId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v2/client/customer/${customerId}/card/${cardId}/activate`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async blockCard(customerId: string, cardId: string, reason?: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v2/client/customer/${customerId}/card/${cardId}/block`,
        { reason }
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async listCards(customerId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/cards`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * FX (Foreign Exchange) APIs
   */
  async getFXQuote(quote: FXQuoteRequest): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post('/api/v2/client/fx/quote', quote);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getExchangeRates(baseCurrency: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get('/api/v2/client/fx/rates', {
        params: { baseCurrency },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  /**
   * Compliance APIs
   */
  async submitKYC(customerId: string, document: ComplianceCheckRequest): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.post(
        `/api/v2/client/customer/${customerId}/kyc`,
        document
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getKYCStatus(customerId: string): Promise<NiumResponse> {
    try {
      const response = await this.axiosInstance.get(
        `/api/v2/client/customer/${customerId}/kyc/status`
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }
}
