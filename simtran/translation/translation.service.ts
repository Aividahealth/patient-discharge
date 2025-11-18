import { v2 } from '@google-cloud/translate';
import { TranslationError, TranslationRequest, TranslationResponse } from './common/types';
import { getConfig } from './common/utils/config';
import { createLogger } from './common/utils/logger';

const logger = createLogger('TranslationService');

/**
 * Service for translating medical content using Google Translate
 */
export class TranslationService {
  private translateClient: v2.Translate;
  private config = getConfig();

  constructor() {
    this.translateClient = new v2.Translate({
      projectId: this.config.projectId,
    });
    logger.info('Translation Service initialized', { projectId: this.config.projectId });
  }

  /**
   * Translate simplified discharge summary to target language
   */
  async translateContent(request: TranslationRequest): Promise<TranslationResponse> {
    const startTime = Date.now();

    logger.info('Starting translation', {
      fileName: request.fileName,
      targetLanguage: request.targetLanguage,
      contentLength: request.content.length,
    });

    try {
      const result = await this.callTranslateWithRetry(request);
      const processingTime = Date.now() - startTime;

      logger.info('Translation completed successfully', {
        fileName: request.fileName,
        targetLanguage: request.targetLanguage,
        originalLength: request.content.length,
        translatedLength: result.translatedContent.length,
        processingTimeMs: processingTime,
      });

      return result;
    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Translation failed', error as Error, {
        fileName: request.fileName,
        targetLanguage: request.targetLanguage,
        processingTimeMs: processingTime,
      });

      throw error;
    }
  }

  /**
   * Call Google Translate API with retry logic
   */
  private async callTranslateWithRetry(
    request: TranslationRequest,
    attemptNumber: number = 1
  ): Promise<TranslationResponse> {
    try {
      logger.debug(`Translate API call attempt ${attemptNumber}`, {
        fileName: request.fileName,
        targetLanguage: request.targetLanguage,
        maxRetries: this.config.maxRetries,
      });

      const response = await this.callTranslate(request);
      return response;
    } catch (error) {
      const isRetryable = this.isRetryableError(error);
      const shouldRetry = isRetryable && attemptNumber < this.config.maxRetries;

      if (shouldRetry) {
        const delay = this.config.retryDelayMs * attemptNumber; // Exponential backoff
        logger.warning(`Retrying Translate API call after ${delay}ms`, {
          fileName: request.fileName,
          targetLanguage: request.targetLanguage,
          attemptNumber,
          error: error instanceof Error ? error.message : 'Unknown error',
        });

        await this.sleep(delay);
        return this.callTranslateWithRetry(request, attemptNumber + 1);
      }

      // No more retries or non-retryable error
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TranslationError(`Translate API call failed after ${attemptNumber} attempts: ${errorMessage}`, false);
    }
  }

  /**
   * Call Google Translate API
   */
  private async callTranslate(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const [translation] = await this.translateClient.translate(request.content, {
        from: 'en', // Source language (English)
        to: request.targetLanguage,
        format: 'text',
      });

      if (!translation || translation.trim().length === 0) {
        throw new TranslationError('Empty translation response from Google Translate', false);
      }

      return {
        translatedContent: translation.trim(),
        sourceLanguage: 'en',
        targetLanguage: request.targetLanguage,
      };
    } catch (error) {
      if (error instanceof TranslationError) {
        throw error;
      }

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new TranslationError(`Google Translate API error: ${errorMessage}`, this.isRetryableError(error));
    }
  }

  /**
   * Determine if an error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof TranslationError) {
      return error.retryable;
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase();

      // Retryable error patterns
      const retryablePatterns = [
        'timeout',
        'econnreset',
        'econnrefused',
        'etimedout',
        'rate limit',
        'quota exceeded',
        'service unavailable',
        'internal error',
        '429',
        '500',
        '503',
        '504',
      ];

      return retryablePatterns.some((pattern) => message.includes(pattern));
    }

    return false;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Validate that content looks like a simplified discharge summary
   */
  validateSimplifiedContent(content: string): boolean {
    // Check for simplified discharge summary structure
    const simplifiedKeywords = [
      'overview',
      'medications',
      'appointments',
      'diet',
      'activity',
      'warning signs',
      'reasons for hospital stay',
      'what happened during your stay',
    ];

    const contentLower = content.toLowerCase();
    const keywordCount = simplifiedKeywords.filter((keyword) => contentLower.includes(keyword)).length;

    // Require at least 2 simplified keywords
    const isValid = keywordCount >= 2;

    logger.debug('Simplified content validation', {
      keywordCount,
      isValid,
      contentLength: content.length,
    });

    return isValid;
  }

  /**
   * Get supported languages
   */
  async getSupportedLanguages(): Promise<string[]> {
    try {
      const [languages] = await this.translateClient.getLanguages();
      return languages.map((lang: any) => lang.code);
    } catch (error) {
      logger.error('Failed to get supported languages', error as Error);
      // Return common languages as fallback
      return ['es', 'fr', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'];
    }
  }

  /**
   * Detect language of content
   */
  async detectLanguage(content: string): Promise<string> {
    try {
      const [detection] = await this.translateClient.detect(content);
      return detection.language;
    } catch (error) {
      logger.error('Failed to detect language', error as Error);
      return 'en'; // Default to English
    }
  }
}
