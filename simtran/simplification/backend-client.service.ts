import axios from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { createLogger } from './common/utils/logger';

const logger = createLogger('BackendClientService');

export interface TenantConfig {
  tenantId: string;
  name: string;
  status: string;
  buckets: {
    rawBucket: string;
    simplifiedBucket: string;
    translatedBucket: string;
  };
  simplificationConfig: {
    modelName: string;
    location: string;
    temperature: number;
    enabled: boolean;
  };
  translationConfig: {
    enabled: boolean;
    targetLanguages: string[];
  };
}

export interface SimplifiedContent {
  dischargeSummary?: {
    content: string;
    gcsPath: string;
  };
  dischargeInstructions?: {
    content: string;
    gcsPath: string;
  };
}

/**
 * Service for communicating with Backend APIs
 */
export class BackendClientService {
  private baseUrl: string;
  private auth: GoogleAuth;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.BACKEND_API_URL || 'http://localhost:3000';
    this.auth = new GoogleAuth();

    logger.info('BackendClientService initialized', { baseUrl: this.baseUrl });
  }

  /**
   * Get tenant configuration from Backend
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    const url = `${this.baseUrl}/api/tenants/${tenantId}/config`;

    logger.info('Fetching tenant config from Backend', { tenantId, url });

    try {
      const idToken = await this.getIdToken();

      const response = await axios.get<TenantConfig>(url, {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
        timeout: 10000,
      });

      logger.info('Tenant config fetched successfully', { tenantId });
      return response.data;
    } catch (error) {
      // If Backend API doesn't exist yet, return default config
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.response?.status === 404)) {
        logger.warning('Backend API not available, using default tenant config', { tenantId });
        return this.getDefaultTenantConfig(tenantId);
      }

      logger.error('Failed to fetch tenant config', error as Error, { tenantId });
      throw error;
    }
  }

  /**
   * Write simplified content back to FHIR via Backend API
   */
  async writeSimplifiedToFhir(
    compositionId: string,
    tenantId: string,
    simplifiedContent: SimplifiedContent
  ): Promise<void> {
    const url = `${this.baseUrl}/api/fhir/composition/${compositionId}/simplified`;

    logger.info('Writing simplified content to FHIR', { compositionId, tenantId });

    try {
      const idToken = await this.getIdToken();

      await axios.post(
        url,
        {
          tenantId,
          compositionId,
          simplifiedContent,
        },
        {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
          timeout: 30000,
        }
      );

      logger.info('Simplified content written to FHIR successfully', { compositionId });
    } catch (error) {
      // If Backend API doesn't exist yet, just log warning
      if (axios.isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.response?.status === 404)) {
        logger.warning('Backend API not available, skipping FHIR write-back', { compositionId });
        return;
      }

      logger.error('Failed to write simplified content to FHIR', error as Error, { compositionId });
      throw error;
    }
  }

  /**
   * Get ID token for authenticating to Backend
   */
  private async getIdToken(): Promise<string> {
    try {
      const client = await this.auth.getIdTokenClient(this.baseUrl);
      const tokenResponse = await client.idTokenProvider.fetchIdToken(this.baseUrl);
      return tokenResponse;
    } catch (error) {
      logger.error('Failed to get identity token', error as Error);
      throw error;
    }
  }

  /**
   * Return default tenant configuration (for when Backend API doesn't exist yet)
   */
  private getDefaultTenantConfig(tenantId: string): TenantConfig {
    return {
      tenantId: tenantId || 'default',
      name: `${tenantId} Tenant`,
      status: 'active',
      buckets: {
        rawBucket: `discharge-summaries-raw-${tenantId}`,
        simplifiedBucket: `discharge-summaries-simplified-${tenantId}`,
        translatedBucket: `discharge-summaries-translated-${tenantId}`,
      },
      simplificationConfig: {
        modelName: process.env.MODEL_NAME || 'gemini-2.5-pro',
        location: process.env.LOCATION || 'us-central1',
        temperature: 0.7,
        enabled: true,
      },
      translationConfig: {
        enabled: true,
        targetLanguages: ['es', 'zh'],
      },
    };
  }
}
