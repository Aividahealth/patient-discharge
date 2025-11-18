import { createLogger } from './common/utils/logger';
import { TenantConfig } from './common/types';

const logger = createLogger('BackendClientService');

/**
 * Service for interacting with the Backend API
 */
export class BackendClientService {
  private apiBaseUrl: string;

  constructor(apiBaseUrl: string) {
    this.apiBaseUrl = apiBaseUrl;
    logger.info('BackendClientService initialized', { apiBaseUrl });
  }

  /**
   * Get tenant configuration from Backend API
   */
  async getTenantConfig(tenantId: string): Promise<TenantConfig> {
    logger.info('Fetching tenant configuration', { tenantId });

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/tenants/${tenantId}/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tenant config: ${response.statusText}`);
      }

      const config = (await response.json()) as TenantConfig;

      logger.info('Tenant configuration fetched successfully', {
        tenantId,
        translationEnabled: config.translationConfig?.enabled,
      });

      return config;
    } catch (error) {
      logger.error('Failed to fetch tenant configuration', error as Error, { tenantId });
      throw error;
    }
  }

  /**
   * Get simplified content from FHIR via Backend API
   */
  async getSimplifiedFromFhir(
    compositionId: string,
    tenantId: string
  ): Promise<{
    dischargeSummary?: { content: string };
    dischargeInstructions?: { content: string };
  }> {
    logger.info('Fetching simplified content from FHIR', {
      compositionId,
      tenantId,
    });

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/google/fhir/Composition/${compositionId}/simplified`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch simplified content from FHIR: ${response.statusText}`);
      }

      const data = (await response.json()) as any;

      // Extract simplified content from the response
      const result: {
        dischargeSummary?: { content: string };
        dischargeInstructions?: { content: string };
      } = {};

      // Find simplified discharge summary
      const simplifiedSummary = data.dischargeSummaries?.find((summary: any) =>
        summary.tags?.some((tag: any) => tag.code === 'simplified-content')
      );
      if (simplifiedSummary?.text) {
        result.dischargeSummary = { content: simplifiedSummary.text };
      }

      // Find simplified discharge instructions
      const simplifiedInstructions = data.dischargeInstructions?.find((instr: any) =>
        instr.tags?.some((tag: any) => tag.code === 'simplified-content')
      );
      if (simplifiedInstructions?.text) {
        result.dischargeInstructions = { content: simplifiedInstructions.text };
      }

      logger.info('Simplified content fetched from FHIR successfully', {
        compositionId,
        tenantId,
        hasDischargeSummary: !!result.dischargeSummary,
        hasDischargeInstructions: !!result.dischargeInstructions,
      });

      return result;
    } catch (error) {
      logger.error('Failed to fetch simplified content from FHIR', error as Error, {
        compositionId,
        tenantId,
      });
      throw error;
    }
  }

  /**
   * Write translated content back to FHIR via Backend API
   */
  async writeTranslatedToFhir(
    compositionId: string,
    tenantId: string,
    translatedContent: {
      dischargeSummary?: {
        content: string;
        language: string;
        gcsPath: string;
      };
      dischargeInstructions?: {
        content: string;
        language: string;
        gcsPath: string;
      };
    }
  ): Promise<void> {
    logger.info('Writing translated content to FHIR', {
      compositionId,
      tenantId,
      hasDischargeSummary: !!translatedContent.dischargeSummary,
      hasDischargeInstructions: !!translatedContent.dischargeInstructions,
    });

    try {
      const response = await fetch(
        `${this.apiBaseUrl}/api/fhir/composition/${compositionId}/translated`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-ID': tenantId,
          },
          body: JSON.stringify({
            tenantId,
            translatedContent,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to write translated content to FHIR: ${response.statusText} - ${errorText}`);
      }

      logger.info('Translated content written to FHIR successfully', {
        compositionId,
        tenantId,
      });
    } catch (error) {
      logger.error('Failed to write translated content to FHIR', error as Error, {
        compositionId,
        tenantId,
      });
      throw error;
    }
  }
}
