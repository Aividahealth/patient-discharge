import axios, { AxiosError } from 'axios';
import { GoogleAuth } from 'google-auth-library';
import { FHIRBinariesResponse, FHIRAPIError } from './common/types';
import { createLogger } from './common/utils/logger';

const logger = createLogger('FHIRAPIService');

/**
 * Service for interacting with FHIR API endpoints
 */
export class FHIRAPIService {
  private readonly baseUrl: string;
  private readonly timeout: number = 30000; // 30 seconds
  private readonly auth: GoogleAuth;

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.auth = new GoogleAuth();
    logger.info('FHIRAPIService initialized', { baseUrl });
  }

  /**
   * Get an identity token for authenticating to Cloud Run services
   */
  private async getIdToken(): Promise<string> {
    try {
      const client = await this.auth.getIdTokenClient(this.baseUrl);
      const tokenResponse = await client.idTokenProvider.fetchIdToken(this.baseUrl);
      return tokenResponse;
    } catch (error) {
      logger.error('Failed to get identity token', error as Error);
      throw new FHIRAPIError('Failed to authenticate to FHIR API', false);
    }
  }

  /**
   * Fetch binaries (discharge summaries and instructions) for a composition
   * @param compositionId - The Google FHIR Composition ID
   * @returns Promise<FHIRBinariesResponse> - The binaries response
   */
  async fetchBinaries(compositionId: string): Promise<FHIRBinariesResponse> {
    const url = `${this.baseUrl}/google/fhir/Composition/${compositionId}/binaries`;

    logger.info('Fetching binaries from FHIR API', {
      compositionId,
      url
    });

    try {
      // Get identity token for authentication
      const idToken = await this.getIdToken();

      const response = await axios.get<FHIRBinariesResponse>(url, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!response.data.success) {
        throw new FHIRAPIError(
          `API returned unsuccessful response for composition ${compositionId}`,
          false
        );
      }

      logger.info('Successfully fetched binaries', {
        compositionId,
        dischargeSummaries: response.data.dischargeSummaries.length,
        dischargeInstructions: response.data.dischargeInstructions.length,
        totalBinaries: response.data.totalBinaries,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;

        // Handle different error scenarios
        if (axiosError.code === 'ECONNABORTED') {
          throw new FHIRAPIError(
            `Request timeout while fetching binaries for composition ${compositionId}`,
            true // Retryable
          );
        }

        if (axiosError.response) {
          // The request was made and the server responded with a status code
          // that falls out of the range of 2xx
          const status = axiosError.response.status;
          const retryable = status >= 500 || status === 429; // Retry on server errors and rate limits

          logger.error('FHIR API request failed', error as Error, {
            compositionId,
            status,
            statusText: axiosError.response.statusText,
            responseData: JSON.stringify(axiosError.response.data).substring(0, 500),
          });

          throw new FHIRAPIError(
            `API request failed with status ${status}: ${JSON.stringify(axiosError.response.data)}`,
            retryable
          );
        } else if (axiosError.request) {
          // The request was made but no response was received
          logger.error('No response from FHIR API', error as Error, {
            compositionId,
            message: axiosError.message,
          });

          throw new FHIRAPIError(
            `No response received from API for composition ${compositionId}: ${axiosError.message}`,
            true // Retryable
          );
        }
      }

      // Generic error
      logger.error('Unexpected error fetching binaries', error as Error, {
        compositionId,
      });

      throw new FHIRAPIError(
        `Failed to fetch binaries for composition ${compositionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      );
    }
  }

  /**
   * Validate that the response contains at least some data
   * Lenient validation: accepts response if at least one type of binary exists
   */
  validateBinariesResponse(response: FHIRBinariesResponse): boolean {
    const hasSummaries = response.dischargeSummaries && response.dischargeSummaries.length > 0;
    const hasInstructions = response.dischargeInstructions && response.dischargeInstructions.length > 0;

    if (!hasSummaries && !hasInstructions) {
      logger.warning('No discharge summaries or instructions found in response', {
        compositionId: response.compositionId,
      });
      return false;
    }

    if (!hasSummaries) {
      logger.info('No discharge summaries found, will process instructions only', {
        compositionId: response.compositionId,
      });
    }

    if (!hasInstructions) {
      logger.info('No discharge instructions found, will process summaries only', {
        compositionId: response.compositionId,
      });
    }

    return true;
  }
}
