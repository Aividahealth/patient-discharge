import axios, { AxiosError } from 'axios';
import { FHIRBinariesResponse, FHIRAPIError } from '../common/types';
import { createLogger } from '../common/utils/logger';

const logger = createLogger('FHIRAPIService');

/**
 * Service for interacting with FHIR API endpoints
 */
export class FHIRAPIService {
  private readonly baseUrl: string;
  private readonly timeout: number = 30000; // 30 seconds

  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    logger.info('FHIRAPIService initialized', { baseUrl });
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
      const response = await axios.get<FHIRBinariesResponse>(url, {
        timeout: this.timeout,
        headers: {
          'Accept': 'application/json',
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

          throw new FHIRAPIError(
            `API request failed with status ${status}: ${axiosError.message}`,
            retryable
          );
        } else if (axiosError.request) {
          // The request was made but no response was received
          throw new FHIRAPIError(
            `No response received from API for composition ${compositionId}: ${axiosError.message}`,
            true // Retryable
          );
        }
      }

      // Generic error
      throw new FHIRAPIError(
        `Failed to fetch binaries for composition ${compositionId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        false
      );
    }
  }

  /**
   * Validate that the response contains required data
   */
  validateBinariesResponse(response: FHIRBinariesResponse): boolean {
    if (!response.dischargeSummaries || response.dischargeSummaries.length === 0) {
      logger.warning('No discharge summaries found in response', {
        compositionId: response.compositionId,
      });
      return false;
    }

    if (!response.dischargeInstructions || response.dischargeInstructions.length === 0) {
      logger.warning('No discharge instructions found in response', {
        compositionId: response.compositionId,
      });
      return false;
    }

    return true;
  }
}
